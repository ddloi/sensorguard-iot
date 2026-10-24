import IORedis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

/**
 * Creates an IORedis connection to Upstash Redis.
 * 
 * Upstash provides a Redis-compatible endpoint over TLS.
 * BullMQ requires IORedis instances (not node-redis).
 * 
 * Connection format: rediss://default:<token>@<endpoint>:6379
 * The "rediss://" scheme indicates TLS is required.
 */
export function createRedisConnection(): IORedis {
  const connection = new IORedis(env.UPSTASH_REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,     // Upstash doesn't support CLUSTER INFO
    tls: {},                     // Required for Upstash (TLS)
  });

  connection.on('connect', () => {
    logger.info('✅ Upstash Redis connected');
  });

  connection.on('error', (err) => {
    logger.error('Redis connection error', { error: err.message });
  });

  return connection;
}

/**
 * Shared connection for BullMQ queues and workers.
 * BullMQ reuses this connection internally.
 */
let sharedConnection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!sharedConnection) {
    sharedConnection = createRedisConnection();
  }
  return sharedConnection;
}

export async function disconnectRedis(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
    logger.info('Redis disconnected gracefully');
  }
}
