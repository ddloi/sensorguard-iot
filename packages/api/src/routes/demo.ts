import { FastifyInstance } from 'fastify';
import { ingestTelemetry } from './ingest';
import { logger } from '../utils/logger';

/** One overheat sample for the dashboard demo; MOTOR-001 critical threshold is 85°C. */
export const OVERHEAT_SAMPLE = {
  deviceId: 'MOTOR-001',
  readings: [
    { sensorType: 'temperature' as const, value: 92.4, unit: 'celsius', quality: 'good' as const },
    { sensorType: 'vibration' as const, value: 6.8, unit: 'mm/s', quality: 'good' as const },
    { sensorType: 'rpm' as const, value: 1450, unit: 'rpm', quality: 'good' as const },
  ],
};

/**
 * POST /api/demo/overheat — the server injects the demo sample itself, so the browser never
 * needs the device key. The payload is fixed: callers cannot write arbitrary telemetry here.
 */
export async function demoRoutes(fastify: FastifyInstance) {
  fastify.post('/api/demo/overheat', async (_request, reply) => {
    try {
      const result = await ingestTelemetry(OVERHEAT_SAMPLE);
      if (result.status === 'not_found') {
        return reply
          .status(404)
          .send({ error: 'Demo device MOTOR-001 not found; run npm run seed' });
      }
      return reply.status(202).send(result);
    } catch (error) {
      logger.error('Demo overheat failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return reply.status(500).send({ error: 'Demo overheat failed' });
    }
  });
}
