import type { IIncident } from '../models/Incident';
import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { Device, Incident, Alert, SensorData, Threshold } from '../models';
import { getQueues } from '../queues';
import { datadogMetrics, sendDatadogLog, startTimer } from '../config/datadog';
import { wsManager } from '../utils/websocket';
import { logger } from '../utils/logger';
import { selectThreshold } from '../domain/threshold';
import { isRecoveryConfirmed } from '../domain/recovery';

const RECOVERY_RETRY_DELAY_MS = 8000;
const MAX_VERIFICATION_ATTEMPTS = 6;

interface RemediationJobData {
  deviceId: string;
  sensorType: string;
  value: number;
  incidentId: string;
  alertId: string;
  remediationAction?: string;
  rootCause?: string;
  verificationAttempt?: number;
  verificationRun?: string;
}

export function startRemediationWorker(): Worker {
  const connection = createRedisConnection();

  const worker = new Worker<RemediationJobData>(
    'remediation',
    async (job: Job<RemediationJobData>) => {
      const endTimer = startTimer();
      if (job.name === 'auto-remediate') {
        await initiateMitigation(job.data);
        endTimer('queue.job.duration', { queue: 'remediation', stage: 'mitigate' });
        return;
      }
      if (job.name === 'verify-recovery') {
        const stage = await verifyRecovery(job.data);
        if (stage) endTimer('queue.job.duration', { queue: 'remediation', stage });
      }
    },
    {
      connection,
      concurrency: 5,
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

async function initiateMitigation(data: RemediationJobData) {
  const { deviceId, sensorType, value, incidentId, alertId } = data;
  logger.info('Remediation started (Stage 1: Mitigation)', {
    deviceId,
    sensorType,
    incidentId,
  });

  const rootCause = getSimulatedRootCause(sensorType);
  const remediationAction = getSimulatedRemediation(sensorType);

  await recordMitigation(data, { rootCause, remediationAction });

  logger.info('Remediation action triggered, scheduling delayed verification', {
    deviceId,
    action: remediationAction,
  });

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
      delay: RECOVERY_RETRY_DELAY_MS,
      jobId: `verify-${incidentId}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  );
}

async function verifyRecovery(data: RemediationJobData) {
  const { deviceId, sensorType, incidentId } = data;
  const remediationAction = data.remediationAction || getSimulatedRemediation(sensorType);
  logger.info('Remediation verifying recovery (Stage 2: Resolution)', {
    deviceId,
    incidentId,
  });

  const now = new Date();
  const incident = await Incident.findById(incidentId);
  if (!incident || incident.status === 'resolved') return;

  const { alertIds, evidence } = await collectRecoveryEvidence(data, incident, now);
  const pending = evidence.filter((item) => !item.isSafe);
  if (pending.length > 0) {
    await retryOrEscalateRecovery(
      data,
      pending.map((item) => item.type),
      now,
    );
    return 'verify-pending';
  }

  await resolveIncident(data, { now, incident, alertIds, evidence, remediationAction });
  return 'resolve';
}

async function collectRecoveryEvidence(
  data: RemediationJobData,
  incident: Pick<IIncident, 'createdAt' | 'timeline'>,
  now: Date,
) {
  const { deviceId, sensorType } = data;
  const device = await Device.findById(deviceId).lean();
  const thresholds = await Threshold.find({
    enabled: true,
    deviceId: { $in: [deviceId, '*'] },
  }).lean();
  const alertIds = incident.timeline.flatMap((event) => (event.alertId ? [event.alertId] : []));
  const linkedAlerts = await Alert.find({ _id: { $in: alertIds } }).lean();
  const affectedSensors = [
    ...new Set([sensorType, ...linkedAlerts.map((alert) => alert.sensorType)]),
  ];
  const evidence = await Promise.all(
    affectedSensors.map(async (type) => {
      const reading = await SensorData.findOne({
        'metadata.deviceId': deviceId,
        'metadata.sensorType': type,
      })
        .sort({ timestamp: -1 })
        .lean();
      const threshold = device
        ? selectThreshold(thresholds, deviceId, device.type, type)
        : undefined;
      return {
        type,
        reading,
        isSafe: isRecoveryConfirmed(reading, threshold, incident.createdAt, now.getTime()),
      };
    }),
  );
  return { alertIds, evidence };
}

interface ResolutionContext extends Awaited<ReturnType<typeof collectRecoveryEvidence>> {
  now: Date;
  incident: { createdAt: Date };
  remediationAction: string;
}

async function retryOrEscalateRecovery(
  data: RemediationJobData,
  pendingSensors: string[],
  now: Date,
) {
  const { deviceId, incidentId } = data;
  const verificationAttempt = (data.verificationAttempt || 0) + 1;
  if (verificationAttempt < MAX_VERIFICATION_ATTEMPTS) {
    await getQueues().remediationQueue.add(
      'verify-recovery',
      {
        ...data,
        verificationAttempt,
      },
      {
        delay: RECOVERY_RETRY_DELAY_MS,
        jobId: `verify-${incidentId}-${data.verificationRun || 'initial'}-${verificationAttempt}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  } else {
    await Incident.updateOne(
      { _id: incidentId },
      {
        $set: { status: 'investigating' },
        $push: {
          timeline: {
            timestamp: now,
            event: 'escalated',
            details: `Recovery not confirmed: fresh safe telemetry missing for ${pendingSensors.join(', ')}. Operator review required.`,
          },
        },
      },
    );
    await Device.updateOne({ _id: deviceId }, { $set: { status: 'critical' } });
    wsManager.broadcast('device_status', { deviceId, status: 'critical' });
    wsManager.broadcast('incident', { action: 'escalated', incidentId });
  }
}

async function resolveIncident(data: RemediationJobData, context: ResolutionContext) {
  const { deviceId, incidentId, alertId } = data;
  const { now, incident, alertIds, evidence, remediationAction } = context;
  const duration = Math.round((now.getTime() - incident.createdAt.getTime()) / 1000);

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
              timestamp: now,
              event: 'recovery_confirmed' as const,
              details: `Fresh telemetry confirms safe range on ${deviceId}: ${evidence.map((item) => `${item.type}=${item.reading!.value}`).join(', ')}`,
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

  await Alert.updateMany(
    { _id: { $in: [...alertIds, alertId] } },
    {
      $set: {
        status: 'resolved',
        resolvedAt: now,
        resolvedBy: 'auto',
      },
    },
  );

  await Device.updateOne({ _id: deviceId }, { $set: { status: 'online' } });

  wsManager.broadcast('device_status', { deviceId, status: 'online' });
  wsManager.broadcast('incident', { action: 'resolved', incidentId, duration });

  datadogMetrics.histogram('incident.duration', duration, [
    `device:${deviceId}`,
    `severity:critical`,
    `resolution:auto`,
  ]);

  datadogMetrics.increment('device.status.change', 1, [`device:${deviceId}`, `new_status:online`]);

  await sendDatadogLog(
    'info',
    `✅ INCIDENT RESOLVED on ${deviceId}: ${remediationAction} (Duration: ${duration}s)`,
    {
      incidentId,
      deviceId,
      duration,
      resolution: remediationAction,
    },
  );

  logger.info('Incident resolved and device restored', {
    incidentId,
    deviceId,
    duration,
  });
}

async function recordMitigation(
  data: RemediationJobData,
  action: { rootCause: string; remediationAction: string },
) {
  const { deviceId, sensorType, value, incidentId } = data;
  const { rootCause, remediationAction } = action;
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

  await Device.updateOne({ _id: deviceId }, { $set: { status: 'maintenance' } });

  wsManager.broadcast('device_status', { deviceId, status: 'maintenance' });
  wsManager.broadcast('incident', { action: 'mitigating', incidentId });

  datadogMetrics.increment('remediation.executed', 1, [
    `device:${deviceId}`,
    `sensor_type:${sensorType}`,
    `action:${remediationAction.substring(0, 30)}`,
  ]);
}
