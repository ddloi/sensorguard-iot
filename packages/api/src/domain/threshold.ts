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
