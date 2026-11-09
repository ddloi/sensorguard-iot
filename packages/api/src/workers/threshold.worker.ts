import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { WORKER_TUNING } from '../config/bullmq';
import { Threshold, Device, Alert, Incident } from '../models';
import { getQueues } from '../queues';
import { datadogMetrics, startTimer } from '../config/datadog';
import { logger } from '../utils/logger';
import { selectThreshold, findThresholdViolation } from '../domain/threshold';
import { wsManager } from '../utils/websocket';

const ALERT_DEBOUNCE_MS = 10_000;

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

        const violation = findThresholdViolation(reading.value, threshold);
        if (!violation) {
          await Alert.updateMany(
            { deviceId, sensorType: reading.sensorType, severity: 'warning', status: 'active' },
            { $set: { status: 'resolved', resolvedAt: new Date(), resolvedBy: 'auto' } },
          );
          continue;
        }
        hasViolation = true;
        await enqueueThresholdAlert(deviceId, reading, violation);
      }

      if (!hasViolation) await restoreDeviceStatus(deviceId, device.status);

      endTimer('queue.job.duration', { queue: 'threshold-check' });
    },
    {
      connection,
      ...WORKER_TUNING,
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

async function enqueueThresholdAlert(
  deviceId: string,
  reading: ThresholdJobData['readings'][number],
  violation: NonNullable<ReturnType<typeof findThresholdViolation>>,
) {
  const { severity, thresholdValue } = violation;
  const debounceWindow = Math.floor(Date.now() / ALERT_DEBOUNCE_MS);
  await getQueues().alertQueue.add(
    `${severity}-alert`,
    {
      deviceId,
      sensorType: reading.sensorType,
      value: reading.value,
      thresholdValue,
      severity,
      timestamp: reading.timestamp,
    },
    {
      jobId: `alert-${deviceId}-${reading.sensorType}-${severity}-${debounceWindow}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  );
  datadogMetrics.increment('sensor.threshold.exceeded', 1, [
    `device:${deviceId}`,
    `sensor_type:${reading.sensorType}`,
    `severity:${severity}`,
  ]);
  if (severity === 'critical') {
    logger.warn('Critical threshold exceeded', {
      deviceId,
      sensorType: reading.sensorType,
      value: reading.value,
      threshold: thresholdValue,
    });
  }
}
async function restoreDeviceStatus(deviceId: string, status: string) {
  if (
    ['warning', 'offline'].includes(status) &&
    !(await Incident.exists({ deviceId, status: { $ne: 'resolved' } }))
  ) {
    const result = await Device.updateOne(
      { _id: deviceId, status: { $in: ['warning', 'offline'] } },
      {
        $set: { status: 'online' },
      },
    );
    if (result.modifiedCount) wsManager.broadcast('device_status', { deviceId, status: 'online' });
  }
}
