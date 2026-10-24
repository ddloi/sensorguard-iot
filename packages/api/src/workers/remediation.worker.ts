import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { Device, Incident, Alert } from '../models';
import { datadogMetrics, sendDatadogLog, startTimer } from '../config/datadog';
import { logger } from '../utils/logger';

interface RemediationJobData {
  deviceId: string;
  sensorType: string;
  value: number;
  incidentId: string;
  alertId: string;
}

/**
 * RemediationWorker: Executes auto-fix actions for critical alerts.
 * 
 * In a real system, this would send commands to the IoT device.
 * In this demo, it simulates the remediation and updates the
 * incident timeline to show the full Detect → Investigate → Respond cycle.
 */
export function startRemediationWorker(): Worker {
  const connection = getRedisConnection();

  const worker = new Worker<RemediationJobData>(
    'remediation',
    async (job: Job<RemediationJobData>) => {
      const endTimer = startTimer();
      const { deviceId, sensorType, value, incidentId, alertId } = job.data;

      logger.info('Remediation started', { deviceId, sensorType, incidentId });

      // 1. Update incident timeline: investigation started
      await Incident.updateOne(
        { _id: incidentId },
        {
          $set: { status: 'investigating' },
          $push: {
            timeline: {
              timestamp: new Date(),
              event: 'investigation_started',
              details: `Investigating ${sensorType} anomaly on ${deviceId}. Current value: ${value}. Checking correlated sensors.`,
            },
          },
        },
      );

      // Simulate investigation delay (2 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 2. Determine root cause and remediation action
      const rootCause = getSimulatedRootCause(sensorType);
      const remediationAction = getSimulatedRemediation(sensorType);

      // 3. Update incident: remediation triggered
      await Incident.updateOne(
        { _id: incidentId },
        {
          $set: {
            status: 'mitigating',
            rootCause,
          },
          $push: {
            timeline: {
              timestamp: new Date(),
              event: 'remediation_triggered',
              details: `Auto-remediation: ${remediationAction}`,
            },
          },
        },
      );

      // 4. Update device status to maintenance/cooling
      await Device.updateOne(
        { _id: deviceId },
        { $set: { status: 'maintenance' } },
      );

      logger.info('Remediation action executed', {
        deviceId,
        action: remediationAction,
        rootCause,
      });

      datadogMetrics.increment('remediation.executed', 1, [
        `device:${deviceId}`,
        `sensor_type:${sensorType}`,
        `action:${remediationAction.substring(0, 30)}`,
      ]);

      // 5. Simulate recovery wait (sensor values expected to drop)
      // In a real system, we'd watch the data stream.
      // For demo: wait 15 seconds then mark as recovered.
      await new Promise((resolve) => setTimeout(resolve, 15000));

      // 6. Mark recovery
      const now = new Date();
      const incident = await Incident.findById(incidentId);
      const duration = incident
        ? Math.round((now.getTime() - incident.createdAt.getTime()) / 1000)
        : 0;

      await Incident.updateOne(
        { _id: incidentId },
        {
          $set: {
            status: 'resolved',
            resolution: remediationAction,
            duration,
            resolvedAt: now,
          },
          $push: {
            timeline: {
              $each: [
                {
                  timestamp: new Date(now.getTime() - 2000),
                  event: 'recovery_confirmed' as const,
                  details: `${sensorType} values returning to normal range on ${deviceId}`,
                },
                {
                  timestamp: now,
                  event: 'resolved' as const,
                  details: `Incident resolved. Duration: ${duration}s. Auto-remediation successful.`,
                },
              ],
            },
          },
        },
      );

      // 7. Resolve alert
      await Alert.updateOne(
        { _id: alertId },
        {
          $set: {
            status: 'resolved',
            resolvedAt: now,
            resolvedBy: 'auto',
          },
        },
      );

      // 8. Restore device status
      await Device.updateOne(
        { _id: deviceId },
        { $set: { status: 'online' } },
      );

      // 9. Metrics
      datadogMetrics.histogram('incident.duration', duration, [
        `device:${deviceId}`,
        `severity:critical`,
        `resolution:auto`,
      ]);

      datadogMetrics.increment('device.status.change', 1, [
        `device:${deviceId}`,
        `new_status:online`,
      ]);

      logger.info('Incident resolved', {
        incidentId,
        deviceId,
        duration,
        resolution: remediationAction,
      });

      await sendDatadogLog('info', `✅ INCIDENT RESOLVED on ${deviceId}: ${remediationAction} (Duration: ${duration}s)`, {
        incidentId,
        deviceId,
        duration,
        resolution: remediationAction,
      });

      endTimer('queue.job.duration', { queue: 'remediation' });
    },
    {
      connection,
      concurrency: 2,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error('Remediation failed', {
      jobId: job?.id,
      error: err.message,
    });
  });

  logger.info('✅ RemediationWorker started');
  return worker;
}

function getSimulatedRootCause(sensorType: string): string {
  const causes: Record<string, string> = {
    temperature: 'Bearing lubrication degradation causing increased friction and heat buildup',
    vibration: 'Rotor imbalance detected, possibly due to worn bearings or misalignment',
    pressure: 'Outlet blockage or valve malfunction causing pressure buildup',
    rpm: 'Speed controller malfunction or load imbalance',
  };
  return causes[sensorType] || 'Unknown root cause — requires manual investigation';
}

function getSimulatedRemediation(sensorType: string): string {
  const actions: Record<string, string> = {
    temperature: 'RPM reduced to 50%, cooling cycle activated, maintenance team notified',
    vibration: 'Motor speed reduced, vibration dampeners engaged',
    pressure: 'Relief valve opened, system pressure reduced to safe levels',
    rpm: 'Speed governor activated, RPM limited to safe range',
  };
  return actions[sensorType] || 'System placed in safe mode, manual intervention required';
}
