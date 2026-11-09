import IORedis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

/** TLS follows the URL scheme unless REDIS_TLS forces it on or off. */
export function shouldUseTls(url: string, mode: 'auto' | 'true' | 'false'): boolean {
  if (mode === 'true') return true;
  if (mode === 'false') return false;
  return url.startsWith('rediss://');
}

/**
 * Creates an IORedis connection for BullMQ.
 *
 * Upstash: rediss://default:<token>@<endpoint>:6379 (TLS).
 * Local Redis for rehearsals: redis://localhost:6379 (no TLS, no command quota).
 */
export function createRedisConnection(): IORedis {
  const tls = shouldUseTls(env.UPSTASH_REDIS_URL, env.REDIS_TLS);
  const connection = new IORedis(env.UPSTASH_REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false, // Upstash doesn't support CLUSTER INFO
    ...(tls ? { tls: {} } : {}),
  });

  connection.on('connect', () => {
    logger.info(tls ? '✅ Redis connected (TLS)' : '✅ Redis connected (local, no TLS)');
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
