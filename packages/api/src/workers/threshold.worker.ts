import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { Threshold, Device, Alert, Incident } from '../models';
import { getQueues } from '../queues';
import { datadogMetrics, startTimer } from '../config/datadog';
import { logger } from '../utils/logger';
import { selectThreshold } from '../domain/threshold';
import { wsManager } from '../utils/websocket';

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
  const connection = createRedisConnection();

  const worker = new Worker<ThresholdJobData>(
    'threshold-check',
    async (job: Job<ThresholdJobData>) => {
      const endTimer = startTimer();
      const { deviceId, readings } = job.data;

      logger.info('Checking thresholds', { deviceId, readingCount: readings.length });

      const device = await Device.findById(deviceId).lean();
      if (!device) return;

      // Wildcard thresholds are scoped to the equipment type, not the entire fleet.
      const thresholds = await Threshold.find({
        $or: [{ deviceId }, { deviceId: '*', deviceType: device.type }],
        enabled: true,
      }).lean();

      let hasViolation = false;
      for (const reading of readings) {
        const threshold = selectThreshold(thresholds, deviceId, device.type, reading.sensorType);

        if (!threshold) continue;

        // Check CRITICAL threshold (both max and min)
        const isCriticalMax =
          threshold.critical.max !== null && reading.value >= threshold.critical.max;
        const isCriticalMin =
          threshold.critical.min !== null && reading.value <= threshold.critical.min;

        if (isCriticalMax || isCriticalMin) {
          hasViolation = true;
          const thresholdValue = isCriticalMax ? threshold.critical.max! : threshold.critical.min!;
          const debounceWindow = Math.floor(Date.now() / 10000); // 10s deduplication window
          const { alertQueue } = getQueues();

          await alertQueue.add(
            'critical-alert',
            {
              deviceId,
              sensorType: reading.sensorType,
              value: reading.value,
              thresholdValue,
              severity: 'critical',
              timestamp: reading.timestamp,
            },
            {
              jobId: `alert-${deviceId}-${reading.sensorType}-critical-${debounceWindow}`,
              removeOnComplete: 100,
              removeOnFail: 50,
            },
          );

          datadogMetrics.increment('sensor.threshold.exceeded', 1, [
            `device:${deviceId}`,
            `sensor_type:${reading.sensorType}`,
            `severity:critical`,
          ]);

          logger.warn('Critical threshold exceeded', {
            deviceId,
            sensorType: reading.sensorType,
            value: reading.value,
            threshold: thresholdValue,
          });
        }
        // Check WARNING threshold (both max and min)
        else {
          const isWarningMax =
            threshold.warning.max !== null && reading.value >= threshold.warning.max;
          const isWarningMin =
            threshold.warning.min !== null && reading.value <= threshold.warning.min;

          if (isWarningMax || isWarningMin) {
            hasViolation = true;
            const thresholdValue = isWarningMax ? threshold.warning.max! : threshold.warning.min!;
            const debounceWindow = Math.floor(Date.now() / 10000);
            const { alertQueue } = getQueues();

            await alertQueue.add(
              'warning-alert',
              {
                deviceId,
                sensorType: reading.sensorType,
                value: reading.value,
                thresholdValue,
                severity: 'warning',
                timestamp: reading.timestamp,
              },
              {
                jobId: `alert-${deviceId}-${reading.sensorType}-warning-${debounceWindow}`,
                removeOnComplete: 100,
                removeOnFail: 50,
              },
            );

            datadogMetrics.increment('sensor.threshold.exceeded', 1, [
              `device:${deviceId}`,
              `sensor_type:${reading.sensorType}`,
              `severity:warning`,
            ]);
          } else {
            await Alert.updateMany(
              { deviceId, sensorType: reading.sensorType, severity: 'warning', status: 'active' },
              {
                $set: { status: 'resolved', resolvedAt: new Date(), resolvedBy: 'auto' },
              },
            );
          }
        }
      }

      // A normal new packet clears a warning/offline state, while active incidents
      // remain owned by the remediation workflow.
      if (
        !hasViolation &&
        ['warning', 'offline'].includes(device.status) &&
        !(await Incident.exists({ deviceId, status: { $ne: 'resolved' } }))
      ) {
        const result = await Device.updateOne(
          { _id: deviceId, status: { $in: ['warning', 'offline'] } },
          {
            $set: { status: 'online' },
          },
        );
        if (result.modifiedCount)
          wsManager.broadcast('device_status', { deviceId, status: 'online' });
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
