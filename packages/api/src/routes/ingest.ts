import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SensorData, Device } from '../models';
import { getQueues } from '../queues';
import { datadogMetrics } from '../config/datadog';
import { wsManager } from '../utils/websocket';
import { logger } from '../utils/logger';

// In-memory cache for device metadata to avoid repeated DB reads on high-throughput ingest
interface CachedDevice {
  location: string;
  cachedAt: number;
}
const deviceLocationCache = new Map<string, CachedDevice>();
const lastSeenThrottleCache = new Map<string, number>();
const DEVICE_CACHE_TTL_MS = 60_000; // 1 minute cache for static device location
const LAST_SEEN_THROTTLE_MS = 15_000; // Throttle lastSeen updates to once every 15s per device

/**
 * INGEST ROUTE — The heart of SensorGuard.
 *
 * Flow: Sensor Simulator → POST /api/ingest → MongoDB + BullMQ
 *
 * This is the entry point for ALL sensor data. Every 5 seconds,
 * each simulated device sends a batch of readings here.
 *
 * What happens on each request:
 * 1. Validate incoming data (zod schema)
 * 2. Insert readings into MongoDB Time Series Collection
 * 3. Update device's lastSeen timestamp
 * 4. Dispatch BullMQ job to check thresholds (async)
 * 5. Return 200 OK immediately (fast response for IoT devices)
 */

// Validation schema for incoming sensor data
const ingestSchema = z.object({
  deviceId: z.string().min(1),
  readings: z
    .array(
      z.object({
        sensorType: z.enum(['temperature', 'vibration', 'pressure', 'rpm']),
        value: z.number(),
        unit: z.string(),
        quality: z.enum(['good', 'degraded', 'bad', 'unknown']).default('good'),
      }),
    )
    .min(1),
});

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
      // 1. Fetch device to get location info (with 60s memory cache to avoid DB hit per packet)
      let cached = deviceLocationCache.get(deviceId);
      if (!cached || Date.now() - cached.cachedAt > DEVICE_CACHE_TTL_MS) {
        const device = await Device.findById(deviceId).lean();
        if (!device) {
          return reply.status(404).send({ error: `Device ${deviceId} not found` });
        }
        cached = { location: device.location, cachedAt: Date.now() };
        deviceLocationCache.set(deviceId, cached);
      }
      const deviceLocation = cached.location;

      // 2. Transform readings into Time Series documents
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

      // 3. Bulk insert into Time Series Collection (fast)
      await SensorData.insertMany(documents, { ordered: false });

      // 4. Throttled update of device lastSeen (max once every 15s)
      const lastSeenTime = lastSeenThrottleCache.get(deviceId) || 0;
      if (Date.now() - lastSeenTime > LAST_SEEN_THROTTLE_MS) {
        lastSeenThrottleCache.set(deviceId, Date.now());
        Device.updateOne({ _id: deviceId }, { $set: { lastSeen: now } }).catch((err) => {
          logger.warn('Failed to update device lastSeen', { deviceId, error: err.message });
        });
      }

      // 5. Send current values to Datadog as gauge metrics
      for (const reading of readings) {
        datadogMetrics.gauge('sensor.reading.value', reading.value, [
          `device:${deviceId}`,
          `sensor_type:${reading.sensorType}`,
          `location:${deviceLocation}`,
        ]);
      }

      // Broadcast live telemetry to connected WebSocket clients
      wsManager.broadcast('telemetry', {
        deviceId,
        readings,
        timestamp: now.toISOString(),
      });

      // 6. Dispatch async threshold check via BullMQ
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
