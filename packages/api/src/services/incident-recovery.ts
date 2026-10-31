import { randomUUID } from 'node:crypto';
import { selectThreshold } from '../domain/threshold';
import { Alert, Device, Incident, Threshold } from '../models';
import { getQueues } from '../queues';
import { wsManager } from '../utils/websocket';

type RecoveryRecheckErrorCode =
  | 'not_found'
  | 'invalid_state'
  | 'missing_evidence'
  | 'missing_threshold'
  | 'already_running'
  | 'queue_unavailable';

/** The use case reports business failures; the route chooses their HTTP status. */
export class RecoveryRecheckError extends Error {
  constructor(
    public readonly code: RecoveryRecheckErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RecoveryRecheckError';
  }
}

/** Claim an escalated incident and request another bounded, evidence-based check. */
export async function requestRecoveryRecheck(incidentId: string) {
  const incident = await Incident.findById(incidentId).lean();
  if (!incident) {
    throw new RecoveryRecheckError('not_found', 'Incident not found');
  }
  if (
    incident.status !== 'investigating' ||
    !incident.timeline.some((event) => event.event === 'escalated')
  ) {
    throw new RecoveryRecheckError(
      'invalid_state',
      'Only escalated incidents awaiting review can be rechecked',
    );
  }

  const [device, thresholds, alerts] = await Promise.all([
    Device.findById(incident.deviceId).lean(),
    Threshold.find({
      enabled: true,
      deviceId: { $in: [incident.deviceId, '*'] },
    }).lean(),
    Alert.find({
      _id: {
        $in: incident.timeline.flatMap((event) => (event.alertId ? [event.alertId] : [])),
      },
    }).lean(),
  ]);

  if (!device || alerts.length === 0) {
    throw new RecoveryRecheckError(
      'missing_evidence',
      'Device or linked alert evidence is unavailable; operator review is required',
    );
  }
  if (
    alerts.some(
      (alert) => !selectThreshold(thresholds, incident.deviceId, device.type, alert.sensorType),
    )
  ) {
    throw new RecoveryRecheckError(
      'missing_threshold',
      'A matching sensor threshold is missing; configure a valid rule before rechecking',
    );
  }

  // Claim before enqueueing so concurrent requests cannot start parallel runs.
  const claimed = await Incident.findOneAndUpdate(
    { _id: incidentId, status: 'investigating' },
    {
      $set: { status: 'mitigating' },
      $push: {
        timeline: {
          timestamp: new Date(),
          event: 'investigation_started',
          details:
            'Operator requested another bounded recovery verification. Fresh safe telemetry is required.',
        },
      },
    },
  );
  if (!claimed) {
    throw new RecoveryRecheckError(
      'already_running',
      'Recovery verification is already running or the incident has changed',
    );
  }

  const verificationRun = randomUUID();
  try {
    await getQueues().remediationQueue.add(
      'verify-recovery',
      {
        deviceId: incident.deviceId,
        sensorType: alerts[0].sensorType,
        value: alerts[0].triggerValue,
        incidentId,
        alertId: alerts[0]._id.toString(),
        remediationAction: incident.resolution || undefined,
        rootCause: incident.rootCause || undefined,
        verificationAttempt: 0,
        verificationRun,
      },
      {
        jobId: `verify-${incidentId}-${verificationRun}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  } catch {
    await Incident.updateOne(
      { _id: incidentId, status: 'mitigating' },
      {
        $set: { status: 'investigating' },
        $push: {
          timeline: {
            timestamp: new Date(),
            event: 'escalated',
            details:
              'Recovery verification could not be queued. Check Redis availability and try again.',
          },
        },
      },
    );
    throw new RecoveryRecheckError(
      'queue_unavailable',
      'Verification queue is unavailable; try again when services recover',
    );
  }

  wsManager.broadcast('incident', { action: 'rechecking', incidentId });
  return { status: 'queued' as const, incidentId, verificationRun };
}
