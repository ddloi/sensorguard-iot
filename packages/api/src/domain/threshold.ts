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
