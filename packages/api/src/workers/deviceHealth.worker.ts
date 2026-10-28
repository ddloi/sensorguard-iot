import { Worker } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { Device } from '../models';
import { datadogMetrics } from '../config/datadog';
import { logger } from '../utils/logger';

const OFFLINE_THRESHOLD_MS = 30_000; // 30 seconds without data = offline

/**
 * DeviceHealthWorker: Periodically checks for offline devices.
 * 
 * Runs as a repeatable job (every 30s). Compares each device's
 * lastSeen timestamp against the current time. Devices that haven't
 * reported in 30+ seconds are marked offline.
 */
export function startDeviceHealthWorker(): Worker {
  const connection = createRedisConnection();

  const worker = new Worker(
    'device-health',
    async () => {
      const now = Date.now();
      const cutoff = new Date(now - OFFLINE_THRESHOLD_MS);

      // Find devices that are not already offline/maintenance
      // but haven't sent data recently
      const staleDevices = await Device.find({
        status: { $in: ['online', 'warning'] },
        lastSeen: { $lt: cutoff },
      }).lean();

      for (const device of staleDevices) {
        await Device.updateOne(
          { _id: device._id },
          { $set: { status: 'offline' } },
        );

        datadogMetrics.increment('device.status.change', 1, [
          `device:${device._id}`,
          `new_status:offline`,
        ]);

        logger.warn('Device marked offline (no data)', {
          deviceId: device._id,
          lastSeen: device.lastSeen,
          offlineFor: `${Math.round((now - device.lastSeen.getTime()) / 1000)}s`,
        });
      }

      // Also check: devices that were offline but are now sending data again
      const recentCutoff = new Date(now - 10_000); // within last 10s
      const recoveredDevices = await Device.find({
        status: 'offline',
        lastSeen: { $gte: recentCutoff },
      }).lean();

      for (const device of recoveredDevices) {
        await Device.updateOne(
          { _id: device._id },
          { $set: { status: 'online' } },
        );

        datadogMetrics.increment('device.status.change', 1, [
          `device:${device._id}`,
          `new_status:online`,
        ]);

        logger.info('Device recovered (back online)', {
          deviceId: device._id,
        });
      }

      // Gauge: current device counts by status
      const statusCounts = await Device.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);

      for (const { _id: status, count } of statusCounts) {
        datadogMetrics.gauge('device.count', count, [`status:${status}`]);
      }
    },
    {
      connection,
      concurrency: 1,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error('Device health check failed', { error: err.message });
  });

  logger.info('✅ DeviceHealthWorker started');
  return worker;
}
