import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // Ignore in case environment restricts custom DNS
}

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
      // Connection pool tuning for IoT workload
      maxPoolSize: 20,
      minPoolSize: 5,
      // Timeout settings
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('✅ MongoDB connected', {
      database: env.MONGODB_DB_NAME,
      host: mongoose.connection.host,
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
  } catch (error) {
    logger.error('❌ MongoDB connection failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected gracefully');
}
