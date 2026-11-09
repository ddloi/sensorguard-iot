import { timingSafeEqual } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { ingestSchema, type IngestPayload } from '../domain/telemetry';
import { needsThresholdCheck } from '../domain/threshold';
import { SensorData, Device, Threshold, Alert, type IThreshold } from '../models';
import { getQueues } from '../queues';
import { env } from '../config/env';
import { datadogMetrics } from '../config/datadog';
import { wsManager } from '../utils/websocket';
import { logger } from '../utils/logger';

interface DeviceContext {
  location: string;
  type: string;
  status: string;
  hasActiveWarning: boolean;
  cachedAt: number;
}
interface CachedThresholds {
  rules: IThreshold[];
  cachedAt: number;
}
const deviceContextCache = new Map<string, DeviceContext>();
const thresholdCache = new Map<string, CachedThresholds>();
const lastSeenThrottleCache = new Map<string, number>();
// Device status changes during an incident, so it is refreshed often.
const DEVICE_CONTEXT_TTL_MS = 5_000;
// Threshold edits take effect on the ingest filter within this window.
const THRESHOLD_CACHE_TTL_MS = 30_000;
const LAST_SEEN_THROTTLE_MS = 15_000; // Throttle lastSeen updates to once every 15s per device

export type IngestResult =
  | { status: 'ok'; deviceId: string; readingsCount: number; timestamp: string; queued: boolean }
  | { status: 'not_found'; deviceId: string };

/** Constant-time comparison of the x-device-key header with DEVICE_API_KEY. */
export function isDeviceKeyValid(expected: string | undefined, provided: unknown): boolean {
  if (!expected) return true;
  if (typeof provided !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function ingestRoutes(fastify: FastifyInstance) {
  if (!env.DEVICE_API_KEY) {
    logger.warn('DEVICE_API_KEY is not set: POST /api/ingest accepts any caller (local demo only)');
  }

  fastify.post('/api/ingest', async (request, reply) => {
    if (!isDeviceKeyValid(env.DEVICE_API_KEY, request.headers['x-device-key'])) {
      return reply.status(401).send({ error: 'Missing or invalid device key' });
    }

    const parseResult = ingestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid payload',
        details: parseResult.error.issues,
      });
    }

    try {
      const result = await ingestTelemetry(parseResult.data);
      if (result.status === 'not_found') {
        return reply.status(404).send({ error: 'Device ' + result.deviceId + ' not found' });
      }
      return reply.status(200).send(result);
    } catch (error) {
      logger.error('Ingest failed', {
        deviceId: parseResult.data.deviceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return reply.status(500).send({ error: 'Ingest failed' });
    }
  });
}

/** Store, broadcast and (when needed) queue one validated batch. Shared by ingest and demo. */
export async function ingestTelemetry(payload: IngestPayload): Promise<IngestResult> {
  const { deviceId, readings } = payload;
  const now = new Date();
  const device = await getDeviceContext(deviceId);
  if (!device) return { status: 'not_found', deviceId };

  await persistReadings(payload, { location: device.location, timestamp: now });
  const queued = await dispatchReadings(payload, device, now);
  datadogMetrics.increment('sensor.ingest.count', readings.length, [`device:${deviceId}`]);

  return {
    status: 'ok',
    deviceId,
    readingsCount: readings.length,
    timestamp: now.toISOString(),
    queued,
  };
}

async function getDeviceContext(deviceId: string): Promise<DeviceContext | undefined> {
  const cached = deviceContextCache.get(deviceId);
  if (cached && Date.now() - cached.cachedAt <= DEVICE_CONTEXT_TTL_MS) return cached;

  const [device, activeWarning] = await Promise.all([
    Device.findById(deviceId).lean(),
    Alert.exists({ deviceId, status: 'active', severity: 'warning' }),
  ]);
  if (!device) return undefined;
  const context: DeviceContext = {
    location: device.location,
    type: device.type,
    status: device.status,
    hasActiveWarning: Boolean(activeWarning),
    cachedAt: Date.now(),
  };
  deviceContextCache.set(deviceId, context);
  return context;
}

async function getThresholds(deviceId: string, deviceType: string): Promise<IThreshold[]> {
  const cached = thresholdCache.get(deviceId);
  if (cached && Date.now() - cached.cachedAt <= THRESHOLD_CACHE_TTL_MS) return cached.rules;
  const rules = await Threshold.find({
    $or: [{ deviceId }, { deviceId: '*', deviceType }],
    enabled: true,
  }).lean<IThreshold[]>();
  thresholdCache.set(deviceId, { rules, cachedAt: Date.now() });
  return rules;
}

async function persistReadings(
  payload: IngestPayload,
  context: { location: string; timestamp: Date },
) {
  const { deviceId, readings } = payload;
  const { location: deviceLocation, timestamp: now } = context;
  const documents = readings.map((reading) => ({
    timestamp: now,
    metadata: {
      deviceId,
      sensorType: reading.sensorType,
      location: deviceLocation,
      unit: reading.unit,
    },
    value: reading.value,
    quality: reading.quality,
  }));

  await SensorData.insertMany(documents, { ordered: false });

  const lastSeenTime = lastSeenThrottleCache.get(deviceId) || 0;
  if (Date.now() - lastSeenTime > LAST_SEEN_THROTTLE_MS) {
    lastSeenThrottleCache.set(deviceId, Date.now());
    Device.updateOne({ _id: deviceId }, { $set: { lastSeen: now } }).catch((err) => {
      logger.warn('Failed to update device lastSeen', { deviceId, error: err.message });
    });
  }
}

/** Returns true when a threshold job was queued. */
async function dispatchReadings(
  payload: IngestPayload,
  device: DeviceContext,
  now: Date,
): Promise<boolean> {
  const { deviceId, readings } = payload;
  for (const reading of readings) {
    datadogMetrics.gauge('sensor.reading.value', reading.value, [
      `device:${deviceId}`,
      `sensor_type:${reading.sensorType}`,
      `location:${device.location}`,
    ]);
  }

  wsManager.broadcast('telemetry', {
    deviceId,
    readings,
    timestamp: now.toISOString(),
  });

  const thresholds = await getThresholds(deviceId, device.type);
  const needed = needsThresholdCheck(readings, {
    deviceId,
    deviceType: device.type,
    deviceStatus: device.status,
    hasActiveWarning: device.hasActiveWarning,
    thresholds,
  });
  if (!needed) return false;

  // The worker may change device status; refresh it on the next batch.
  deviceContextCache.delete(deviceId);

  const { thresholdQueue } = getQueues();
  await thresholdQueue.add(
    `check-${deviceId}`,
    {
      deviceId,
      readings: readings.map((r) => ({
        ...r,
        timestamp: now.toISOString(),
        location: device.location,
      })),
    },
    {
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50,
    },
  );
  return true;
}
