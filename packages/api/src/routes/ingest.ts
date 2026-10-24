import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SensorData, Device } from '../models';
import { getQueues } from '../queues';
import { datadogMetrics } from '../config/datadog';
import { logger } from '../utils/logger';

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
  readings: z.array(
    z.object({
      sensorType: z.enum(['temperature', 'vibration', 'pressure', 'rpm']),
      value: z.number(),
      unit: z.string(),
      quality: z.enum(['good', 'degraded', 'bad', 'unknown']).default('good'),
    }),
  ).min(1),
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
      // 1. Fetch device to get location info
      const device = await Device.findById(deviceId).lean();
      if (!device) {
        return reply.status(404).send({ error: `Device ${deviceId} not found` });
      }

      // 2. Transform readings into Time Series documents
      const documents = readings.map((reading) => ({
        timestamp: now,
        metadata: {
          deviceId,
          sensorType: reading.sensorType,
          location: device.location,
          unit: reading.unit,
        },
        value: reading.value,
        quality: reading.quality,
      }));

      // 3. Bulk insert into Time Series Collection (fast)
      await SensorData.insertMany(documents, { ordered: false });

      // 4. Update device lastSeen
      await Device.updateOne(
        { _id: deviceId },
        { $set: { lastSeen: now } },
      );

      // 5. Send current values to Datadog as gauge metrics
      for (const reading of readings) {
        datadogMetrics.gauge('sensor.reading.value', reading.value, [
          `device:${deviceId}`,
          `sensor_type:${reading.sensorType}`,
          `location:${device.location}`,
        ]);
      }

      // 6. Dispatch async threshold check via BullMQ
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

      datadogMetrics.increment('sensor.ingest.count', readings.length, [
        `device:${deviceId}`,
      ]);

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
