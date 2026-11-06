import { FastifyInstance } from 'fastify';
import { ingestSchema, type IngestPayload } from '../domain/telemetry';
import { SensorData, Device } from '../models';
import { getQueues } from '../queues';
import { datadogMetrics } from '../config/datadog';
import { wsManager } from '../utils/websocket';
import { logger } from '../utils/logger';

interface CachedDevice {
  location: string;
  cachedAt: number;
}
const deviceLocationCache = new Map<string, CachedDevice>();
const lastSeenThrottleCache = new Map<string, number>();
const DEVICE_CACHE_TTL_MS = 60_000; // 1 minute cache for static device location
const LAST_SEEN_THROTTLE_MS = 15_000; // Throttle lastSeen updates to once every 15s per device

export async function ingestRoutes(fastify: FastifyInstance) {
  fastify.post('/api/ingest', async (request, reply) => {
    const parseResult = ingestSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid payload',
        details: parseResult.error.issues,
      });
    }

    const { deviceId, readings } = parseResult.data;
    const now = new Date();

    try {
      const deviceLocation = await getDeviceLocation(deviceId);
      if (deviceLocation === undefined)
        return reply.status(404).send({ error: 'Device ' + deviceId + ' not found' });

      await persistReadings({ deviceId, readings }, { location: deviceLocation, timestamp: now });

      await dispatchReadings({ deviceId, readings }, { location: deviceLocation, timestamp: now });

      datadogMetrics.increment('sensor.ingest.count', readings.length, [`device:${deviceId}`]);

      return reply.status(200).send({
        status: 'ok',
        deviceId,
        readingsCount: readings.length,
        timestamp: now.toISOString(),
      });
    } catch (error) {
      logger.error('Ingest failed', {
        deviceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return reply.status(500).send({ error: 'Ingest failed' });
    }
  });
}

async function getDeviceLocation(deviceId: string): Promise<string | undefined> {
  let cached = deviceLocationCache.get(deviceId);
  if (!cached || Date.now() - cached.cachedAt > DEVICE_CACHE_TTL_MS) {
    const device = await Device.findById(deviceId).lean();
    if (!device) return undefined;
    cached = { location: device.location, cachedAt: Date.now() };
    deviceLocationCache.set(deviceId, cached);
  }

  return cached.location;
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

async function dispatchReadings(
  payload: IngestPayload,
  context: { location: string; timestamp: Date },
) {
  const { deviceId, readings } = payload;
  const { location: deviceLocation, timestamp: now } = context;
  for (const reading of readings) {
    datadogMetrics.gauge('sensor.reading.value', reading.value, [
      `device:${deviceId}`,
      `sensor_type:${reading.sensorType}`,
      `location:${deviceLocation}`,
    ]);
  }

  wsManager.broadcast('telemetry', {
    deviceId,
    readings,
    timestamp: now.toISOString(),
  });

  const { thresholdQueue } = getQueues();
  await thresholdQueue.add(
    `check-${deviceId}`,
    {
      deviceId,
      readings: readings.map((r) => ({
        ...r,
        timestamp: now.toISOString(),
        location: deviceLocation,
      })),
    },
    {
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50,
    },
  );
}
