import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import mongoose from 'mongoose';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { initQueues, getQueues } from './queues';
import { startThresholdWorker } from './workers/threshold.worker';
import { startAlertWorker } from './workers/alert.worker';
import { startRemediationWorker } from './workers/remediation.worker';
import { startDeviceHealthWorker } from './workers/deviceHealth.worker';
import { ingestRoutes } from './routes/ingest';
import { deviceRoutes } from './routes/devices';
import { alertRoutes } from './routes/alerts';
import { incidentRoutes } from './routes/incidents';
import { analyticsRoutes } from './routes/analytics';
import { websocketRoutes } from './routes/ws';
import { logger } from './utils/logger';
import { getRedisConnection } from './config/redis';
import { getServiceHealth } from './services/health';

/**
 * SERVER SETUP — Fastify application assembly.
 *
 * Boot sequence:
 * 1. Create Fastify instance
 * 2. Register CORS (for Next.js dashboard)
 * 3. Connect MongoDB
 * 4. Initialize BullMQ queues + Upstash Redis
 * 5. Start BullMQ workers
 * 6. Register API routes
 * 7. Set up repeatable jobs (device health check)
 * 8. Listen on port
 */
export async function buildServer() {
  const fastify = Fastify({
    logger: false, // We use Winston instead
  });

  // 1. CORS — allow dashboard to call API
  await fastify.register(cors, {
    origin: true, // Allow all origins in dev
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  // 1.1 WebSocket support for real-time live telemetry
  await fastify.register(websocket);

  // 2. Health check
  fastify.get('/health', async (_request, reply) => {
    const health = await getServiceHealth({
      pingMongo: async () => {
        if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
          throw new Error('MongoDB disconnected');
        }
        await mongoose.connection.db.admin().ping();
      },
      pingRedis: async () => {
        const redis = getRedisConnection();
        if (redis.status !== 'ready') throw new Error('Redis disconnected');
        await redis.ping();
      },
      datadogConfigured: Boolean(env.DD_API_KEY),
      uptime: process.uptime(),
    });
    return reply.code(health.status === 'ok' ? 200 : 503).send(health);
  });

  // 3. Connect MongoDB
  await connectDatabase();

  // 4. Initialize BullMQ queues
  initQueues();

  // 5. Start workers
  startThresholdWorker();
  startAlertWorker();
  startRemediationWorker();
  startDeviceHealthWorker();

  // 6. Register routes
  await fastify.register(ingestRoutes);
  await fastify.register(deviceRoutes);
  await fastify.register(alertRoutes);
  await fastify.register(incidentRoutes);
  await fastify.register(analyticsRoutes);
  await fastify.register(websocketRoutes);

  // 7. Set up repeatable device health check job (every 30s)
  const { deviceHealthQueue } = getQueues();
  await deviceHealthQueue.add(
    'health-check',
    {},
    {
      repeat: { every: 30_000 }, // Every 30 seconds
      removeOnComplete: 10,
      removeOnFail: 5,
    },
  );

  logger.info('✅ Repeatable device health check scheduled (every 30s)');

  return fastify;
}

export async function startServer() {
  const fastify = await buildServer();

  try {
    await fastify.listen({ port: env.API_PORT, host: env.API_HOST });
    logger.info(`🚀 SensorGuard API running on http://${env.API_HOST}:${env.API_PORT}`);
  } catch (err) {
    logger.error('Failed to start server', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down...`);
      await fastify.close();
      process.exit(0);
    });
  }
}
