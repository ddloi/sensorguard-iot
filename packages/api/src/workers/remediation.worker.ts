import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { Device, Incident, Alert } from '../models';
import { getQueues } from '../queues';
import { datadogMetrics, sendDatadogLog, startTimer } from '../config/datadog';
import { wsManager } from '../utils/websocket';
import { logger } from '../utils/logger';

interface RemediationJobData {
  deviceId: string;
  sensorType: string;
  value: number;
  incidentId: string;
  alertId: string;
  remediationAction?: string;
  rootCause?: string;
}

/**
 * RemediationWorker: Executes auto-fix actions for critical alerts.
 *
 * Uses a non-blocking 2-stage event state machine via BullMQ:
 * Stage 1 ('auto-remediate'): Initiates mitigation, sets safe mode, schedules delayed verification.
 * Stage 2 ('verify-recovery'): Verifies recovery, resolves incident, restores device to online.
 */
export function startRemediationWorker(): Worker {
  const connection = createRedisConnection();

  const worker = new Worker<RemediationJobData>(
    'remediation',
    async (job: Job<RemediationJobData>) => {
      const endTimer = startTimer();
      const { deviceId, sensorType, value, incidentId, alertId } = job.data;

      // ─── STAGE 1: INITIATE MITIGATION ─────────────────────────────────
      if (job.name === 'auto-remediate') {
        logger.info('Remediation started (Stage 1: Mitigation)', { deviceId, sensorType, incidentId });

        // 1. Determine root cause and remediation action
        const rootCause = getSimulatedRootCause(sensorType);
        const remediationAction = getSimulatedRemediation(sensorType);

        // 2. Update incident: investigation & mitigating
        await Incident.updateOne(
          { _id: incidentId },
          {
            $set: {
              status: 'mitigating',
              rootCause,
            },
            $push: {
              timeline: {
                $each: [
                  {
                    timestamp: new Date(),
                    event: 'investigation_started' as const,
                    details: `Investigating ${sensorType} anomaly on ${deviceId}. Current value: ${value}. Checking correlated sensors.`,
                  },
                  {
                    timestamp: new Date(),
                    event: 'remediation_triggered' as const,
                    details: `Auto-remediation: ${remediationAction}`,
                  },
                ],
              },
            },
          },
        );

        // 3. Update device status to maintenance/cooling
        await Device.updateOne(
          { _id: deviceId },
          { $set: { status: 'maintenance' } },
        );

        wsManager.broadcast('device_status', { deviceId, status: 'maintenance' });
        wsManager.broadcast('incident', { action: 'mitigating', incidentId });

        datadogMetrics.increment('remediation.executed', 1, [
          `device:${deviceId}`,
          `sensor_type:${sensorType}`,
          `action:${remediationAction.substring(0, 30)}`,
        ]);

        logger.info('Remediation action triggered, scheduling delayed verification', {
          deviceId,
          action: remediationAction,
        });

        // 4. Schedule Stage 2 via BullMQ delayed job (non-blocking, frees worker thread immediately)
        const { remediationQueue } = getQueues();
        await remediationQueue.add(
          'verify-recovery',
          {
            deviceId,
            sensorType,
            value,
            incidentId,
            alertId,
            remediationAction,
            rootCause,
          },
          {
            delay: 8000, // 8-second realistic cooling/recovery window
            jobId: `verify-${incidentId}`,
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        );

        endTimer('queue.job.duration', { queue: 'remediation', stage: 'mitigate' });
        return;
      }

      // ─── STAGE 2: VERIFY RECOVERY & RESOLVE ───────────────────────────
      if (job.name === 'verify-recovery') {
        const remediationAction = job.data.remediationAction || getSimulatedRemediation(sensorType);
        logger.info('Remediation verifying recovery (Stage 2: Resolution)', { deviceId, incidentId });

        const now = new Date();
        const incident = await Incident.findById(incidentId);
        const duration = incident
          ? Math.round((now.getTime() - incident.createdAt.getTime()) / 1000)
          : 8;

        // 1. Resolve Incident
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

        // 2. Resolve Alert
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

        // 3. Restore device status to online
        await Device.updateOne(
          { _id: deviceId },
          { $set: { status: 'online' } },
        );

        wsManager.broadcast('device_status', { deviceId, status: 'online' });
        wsManager.broadcast('incident', { action: 'resolved', incidentId, duration });

        // 4. Metrics & Logs
        datadogMetrics.histogram('incident.duration', duration, [
          `device:${deviceId}`,
          `severity:critical`,
          `resolution:auto`,
        ]);

        datadogMetrics.increment('device.status.change', 1, [
          `device:${deviceId}`,
          `new_status:online`,
        ]);

        await sendDatadogLog('info', `✅ INCIDENT RESOLVED on ${deviceId}: ${remediationAction} (Duration: ${duration}s)`, {
          incidentId,
          deviceId,
          duration,
          resolution: remediationAction,
        });

        logger.info('Incident resolved and device restored', {
          incidentId,
          deviceId,
          duration,
        });

        endTimer('queue.job.duration', { queue: 'remediation', stage: 'resolve' });
      }
    },
    {
      connection,
      concurrency: 5, // Fully non-blocking high-throughput concurrency
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
