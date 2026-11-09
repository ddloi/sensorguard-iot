interface DeviceThreshold {
  deviceId: string;
  deviceType: string;
  sensorType: string;
}

/** A device override wins; wildcard rules apply only to the matching equipment type. */
export function selectThreshold<T extends DeviceThreshold>(
  thresholds: T[],
  deviceId: string,
  deviceType: string,
  sensorType: string,
): T | undefined {
  return (
    thresholds.find((rule) => rule.deviceId === deviceId && rule.sensorType === sensorType) ||
    thresholds.find(
      (rule) =>
        rule.deviceId === '*' && rule.deviceType === deviceType && rule.sensorType === sensorType,
    )
  );
}

export interface ThresholdBand {
  min: number | null;
  max: number | null;
}
export interface ThresholdRule {
  warning: ThresholdBand;
  critical: ThresholdBand;
}
export interface ThresholdViolation {
  severity: 'warning' | 'critical';
  thresholdValue: number;
}
export function findThresholdViolation(
  value: number,
  rule: ThresholdRule,
): ThresholdViolation | null {
  for (const severity of ['critical', 'warning'] as const) {
    const band = rule[severity];
    if (band.max !== null && value >= band.max) return { severity, thresholdValue: band.max };
    if (band.min !== null && value <= band.min) return { severity, thresholdValue: band.min };
  }
  return null;
}

export interface ThresholdCheckContext<T extends DeviceThreshold & ThresholdRule> {
  deviceId: string;
  deviceType: string;
  deviceStatus: string;
  hasActiveWarning: boolean;
  thresholds: T[];
}

/** Statuses the threshold worker restores to online when normal readings arrive. */
const RESTORABLE_STATUSES = new Set(['warning', 'offline']);

/**
 * Decide whether a batch needs the threshold worker.
 *
 * The worker only changes state when a reading violates a rule, or when an earlier state
 * must be cleared: a warning/offline device to restore, or a warning alert still active.
 * Critical and maintenance devices are owned by the incident workflow, which reads fresh
 * telemetry from MongoDB itself. Everything else skips the queue to save Redis commands.
 */
export function needsThresholdCheck<T extends DeviceThreshold & ThresholdRule>(
  readings: Array<{ sensorType: string; value: number }>,
  context: ThresholdCheckContext<T>,
): boolean {
  if (RESTORABLE_STATUSES.has(context.deviceStatus) || context.hasActiveWarning) return true;
  return readings.some((reading) => {
    const rule = selectThreshold(
      context.thresholds,
      context.deviceId,
      context.deviceType,
      reading.sensorType,
    );
    return rule !== undefined && findThresholdViolation(reading.value, rule) !== null;
  });
}
