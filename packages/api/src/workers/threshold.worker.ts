import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { Threshold, Alert } from '../models';
import { getQueues } from '../queues';
import { datadogMetrics, startTimer } from '../config/datadog';
import { logger } from '../utils/logger';

interface ThresholdJobData {
  deviceId: string;
  readings: Array<{
    sensorType: string;
    value: number;
    timestamp: string;
    unit: string;
    location: string;
  }>;
}

/**
 * ThresholdWorker: Compares incoming sensor readings against configured thresholds.
 * 
 * For each reading that exceeds a threshold, it dispatches a job to the alert queue.
 * This separation (ingest → threshold check → alert) keeps the API response fast
 * while ensuring no threshold violation is missed.
 */
export function startThresholdWorker(): Worker {
  const connection = getRedisConnection();

  const worker = new Worker<ThresholdJobData>(
    'threshold-check',
    async (job: Job<ThresholdJobData>) => {
      const endTimer = startTimer();
      const { deviceId, readings } = job.data;

      logger.info('Checking thresholds', { deviceId, readingCount: readings.length });

      // Fetch thresholds for this device (or wildcard "*")
      const thresholds = await Threshold.find({
        deviceId: { $in: [deviceId, '*'] },
        enabled: true,
      }).lean();

      for (const reading of readings) {
        const threshold =
          thresholds.find((t) => t.deviceId === deviceId && t.sensorType === reading.sensorType) ||
          thresholds.find((t) => t.deviceId === '*' && t.sensorType === reading.sensorType);

        if (!threshold) continue;

        // Check CRITICAL threshold
        if (
          threshold.critical.max !== null &&
          reading.value > threshold.critical.max
        ) {
          const { alertQueue } = getQueues();
          await alertQueue.add('critical-alert', {
            deviceId,
            sensorType: reading.sensorType,
            value: reading.value,
            thresholdValue: threshold.critical.max,
            severity: 'critical',
            timestamp: reading.timestamp,
          });

          datadogMetrics.increment('sensor.threshold.exceeded', 1, [
            `device:${deviceId}`,
            `sensor_type:${reading.sensorType}`,
            `severity:critical`,
          ]);

          logger.warn('Critical threshold exceeded', {
            deviceId,
            sensorType: reading.sensorType,
            value: reading.value,
            threshold: threshold.critical.max,
          });
        }
        // Check WARNING threshold
        else if (
          threshold.warning.max !== null &&
          reading.value > threshold.warning.max
        ) {
          const { alertQueue } = getQueues();
          await alertQueue.add('warning-alert', {
            deviceId,
            sensorType: reading.sensorType,
            value: reading.value,
            thresholdValue: threshold.warning.max,
            severity: 'warning',
            timestamp: reading.timestamp,
          });

          datadogMetrics.increment('sensor.threshold.exceeded', 1, [
            `device:${deviceId}`,
            `sensor_type:${reading.sensorType}`,
            `severity:warning`,
          ]);
        }
      }

      endTimer('queue.job.duration', { queue: 'threshold-check' });
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    logger.debug('Threshold check completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Threshold check failed', {
      jobId: job?.id,
      error: err.message,
    });
  });

  logger.info('✅ ThresholdWorker started');
  return worker;
}
