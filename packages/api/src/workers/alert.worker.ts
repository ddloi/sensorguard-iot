import type { Types } from 'mongoose';
import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { Alert, Device, Incident } from '../models';
import { getQueues } from '../queues';
import { datadogMetrics, sendDatadogLog, startTimer } from '../config/datadog';
import { wsManager } from '../utils/websocket';
import { logger } from '../utils/logger';

const REMEDIATION_DELAY_MS = 5000;

interface AlertJobData {
  deviceId: string;
  sensorType: string;
  value: number;
  thresholdValue: number;
  severity: 'warning' | 'critical';
  timestamp: string;
}

export function startAlertWorker(): Worker {
  const connection = createRedisConnection();

  const worker = new Worker<AlertJobData>(
    'alert-process',
    async (job: Job<AlertJobData>) => {
      const endTimer = startTimer();
      await processAlert(job.data);

      endTimer('queue.job.duration', { queue: 'alert-process' });
    },
    {
      connection,
      concurrency: 5, // Process up to 5 alerts concurrently without global queue freeze
    },
  );

  worker.on('failed', (job, err) => {
    logger.error('Alert processing failed', {
      jobId: job?.id,
      error: err.message,
    });
  });

  logger.info('✅ AlertWorker started');
  return worker;
}

async function processAlert(data: AlertJobData) {
  const { deviceId, sensorType, value, thresholdValue, severity } = data;

  const message = `${severity.toUpperCase()}: ${sensorType} on ${deviceId} = ${value} (threshold: ${thresholdValue})`;

  const alert = await Alert.create({
    deviceId,
    sensorType,
    severity,
    status: 'active',
    triggerValue: value,
    thresholdValue,
    message,
    metadata: {
      movingAverage5m: null,
      trend: 'unknown',
      correlatedAlerts: [],
    },
  });

  logger.warn('Alert created', {
    alertId: alert._id,
    deviceId,
    sensorType,
    severity,
    value,
    threshold: thresholdValue,
  });

  await sendDatadogLog(severity === 'critical' ? 'error' : 'warn', message, {
    alertId: alert._id.toString(),
    deviceId,
    sensorType,
    value,
    threshold: thresholdValue,
  });

  datadogMetrics.increment('sensor.alert.triggered', 1, [
    `device:${deviceId}`,
    `sensor_type:${sensorType}`,
    `severity:${severity}`,
  ]);

  datadogMetrics.gauge('sensor.reading.alert_value', value, [
    `device:${deviceId}`,
    `sensor_type:${sensorType}`,
  ]);

  const newStatus = severity === 'critical' ? 'critical' : 'warning';
  await Device.updateOne({ _id: deviceId }, { $set: { status: newStatus } });

  // Broadcast alert and device status to live clients
  wsManager.broadcast('alert', alert);
  wsManager.broadcast('device_status', { deviceId, status: newStatus });

  datadogMetrics.increment('device.status.change', 1, [
    `device:${deviceId}`,
    `new_status:${newStatus}`,
  ]);

  if (severity === 'critical') await handleCriticalAlert(data, { alertId: alert._id, message });
}

async function handleCriticalAlert(
  data: AlertJobData,
  alert: { alertId: Types.ObjectId; message: string },
) {
  const { deviceId, sensorType, value, timestamp } = data;
  const { alertId, message } = alert;
  const activeIncident = await Incident.findOne({
    deviceId,
    status: { $in: ['open', 'investigating', 'mitigating'] },
  }).sort({ createdAt: -1 });

  if (activeIncident) {
    // Deduplicate incident: append to existing timeline without spawning duplicate remediation
    await Incident.updateOne(
      { _id: activeIncident._id },
      {
        $push: {
          timeline: {
            timestamp: new Date(),
            event: 'alert_triggered',
            details: message,
            alertId,
          },
        },
      },
    );
    logger.info('Appended alert to existing active incident (deduplicated)', {
      incidentId: activeIncident._id,
      deviceId,
    });
    wsManager.broadcast('incident', { action: 'updated', incidentId: activeIncident._id });
    return;
  }

  const incident = await Incident.create({
    title: `${sensorType.charAt(0).toUpperCase() + sensorType.slice(1)} alert on ${deviceId}`,
    status: 'open',
    severity: 'critical',
    deviceId,
    timeline: [
      {
        timestamp: new Date(timestamp),
        event: 'anomaly_detected',
        details: `${sensorType} value ${value} detected above normal range`,
      },
      {
        timestamp: new Date(),
        event: 'alert_triggered',
        details: message,
        alertId,
      },
    ],
    rootCause: null,
    resolution: null,
    duration: null,
  });

  wsManager.broadcast('incident', { action: 'created', incident });

  // Dispatch remediation job with 5s delay (safety buffer)
  const { remediationQueue } = getQueues();
  await remediationQueue.add(
    'auto-remediate',
    {
      deviceId,
      sensorType,
      value,
      incidentId: incident._id.toString(),
      alertId: alertId.toString(),
    },
    {
      delay: REMEDIATION_DELAY_MS,
      jobId: `remediate-${incident._id.toString()}`, // Prevent duplicate remediation jobs
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  );

  logger.info('Incident created, remediation scheduled', {
    incidentId: incident._id,
    deviceId,
    delay: '5s',
  });
}
