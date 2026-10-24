import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { Alert, Device, Incident } from '../models';
import { getQueues } from '../queues';
import { datadogMetrics, sendDatadogLog, startTimer } from '../config/datadog';
import { logger } from '../utils/logger';

interface AlertJobData {
  deviceId: string;
  sensorType: string;
  value: number;
  thresholdValue: number;
  severity: 'warning' | 'critical';
  timestamp: string;
}

/**
 * AlertWorker: Creates alert records and triggers downstream actions.
 * 
 * On critical alerts, it also:
 * - Updates the device status
 * - Creates an incident record
 * - Dispatches a remediation job
 * - Sends metrics to Datadog
 */
export function startAlertWorker(): Worker {
  const connection = getRedisConnection();

  const worker = new Worker<AlertJobData>(
    'alert-process',
    async (job: Job<AlertJobData>) => {
      const endTimer = startTimer();
      const { deviceId, sensorType, value, thresholdValue, severity, timestamp } = job.data;

      const message = `${severity.toUpperCase()}: ${sensorType} on ${deviceId} = ${value} (threshold: ${thresholdValue})`;

      // 1. Create alert in MongoDB
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

      // Send to Datadog Logs
      await sendDatadogLog(severity === 'critical' ? 'error' : 'warn', message, {
        alertId: alert._id.toString(),
        deviceId,
        sensorType,
        value,
        threshold: thresholdValue,
      });

      // 2. Send metric to Datadog
      datadogMetrics.increment('sensor.alert.triggered', 1, [
        `device:${deviceId}`,
        `sensor_type:${sensorType}`,
        `severity:${severity}`,
      ]);

      datadogMetrics.gauge('sensor.reading.alert_value', value, [
        `device:${deviceId}`,
        `sensor_type:${sensorType}`,
      ]);

      // 3. Update device status
      const newStatus = severity === 'critical' ? 'critical' : 'warning';
      await Device.updateOne(
        { _id: deviceId },
        { $set: { status: newStatus } },
      );

      datadogMetrics.increment('device.status.change', 1, [
        `device:${deviceId}`,
        `new_status:${newStatus}`,
      ]);

      // 4. For CRITICAL alerts: create incident + trigger remediation
      if (severity === 'critical') {
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
              alertId: alert._id,
            },
          ],
          rootCause: null,
          resolution: null,
          duration: null,
        });

        // Dispatch remediation job with 5s delay (safety buffer)
        const { remediationQueue } = getQueues();
        await remediationQueue.add(
          'auto-remediate',
          {
            deviceId,
            sensorType,
            value,
            incidentId: incident._id.toString(),
            alertId: alert._id.toString(),
          },
          { delay: 5000 }, // Wait 5s before acting
        );

        logger.info('Incident created, remediation scheduled', {
          incidentId: incident._id,
          deviceId,
          delay: '5s',
        });
      }

      endTimer('queue.job.duration', { queue: 'alert-process' });
    },
    {
      connection,
      concurrency: 3,
      limiter: {
        max: 10,        // Max 10 alerts per...
        duration: 60000, // ...60 seconds per device (prevent alert storm)
      },
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
