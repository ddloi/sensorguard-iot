const MAX_READING_AGE_MS = 30_000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5000;

interface RecoveryReading {
  timestamp: Date | string;
  value: number;
}
interface RecoveryThreshold {
  warning: { min: number | null; max: number | null };
  critical: { min: number | null; max: number | null };
}

/** Recovery requires new, fresh telemetry inside both configured safety bands. */
export function isRecoveryConfirmed(
  reading: RecoveryReading | null | undefined,
  threshold: RecoveryThreshold | null | undefined,
  incidentStartedAt: Date,
  now = Date.now(),
): boolean {
  if (!reading || !threshold || !Number.isFinite(reading.value)) return false;
  const timestamp = new Date(reading.timestamp).getTime();
  const age = now - timestamp;
  if (
    !Number.isFinite(timestamp) ||
    timestamp <= incidentStartedAt.getTime() ||
    age < -MAX_FUTURE_CLOCK_SKEW_MS ||
    age > MAX_READING_AGE_MS
  )
    return false;
  return [threshold.warning, threshold.critical].every(
    (band) =>
      (band.min === null || reading.value > band.min) &&
      (band.max === null || reading.value < band.max),
  );
}
