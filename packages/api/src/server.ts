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
import { demoRoutes } from './routes/demo';
import { registerDashboard } from './routes/dashboard';
import { logger } from './utils/logger';
import { getRedisConnection } from './config/redis';
import { getServiceHealth } from './services/health';

export async function buildServer() {
  const fastify = Fastify({
    logger: false,
  });

  await fastify.register(cors, {
    origin: true, // Allow all origins in dev
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  await fastify.register(websocket);

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

  await connectDatabase();

  initQueues();

  startThresholdWorker();
  startAlertWorker();
  startRemediationWorker();
  startDeviceHealthWorker();

  await fastify.register(ingestRoutes);
  await fastify.register(deviceRoutes);
  await fastify.register(alertRoutes);
  await fastify.register(incidentRoutes);
  await fastify.register(analyticsRoutes);
  await fastify.register(websocketRoutes);
  await fastify.register(demoRoutes);
  // Called directly (not as a plugin) so the SPA not-found handler applies to the root.
  if (env.SERVE_DASHBOARD === 'true') await registerDashboard(fastify);

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

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down...`);
      await fastify.close();
      process.exit(0);
    });
  }
}
