import type { Device, Health, Incident, TimeSeriesPoint } from '../types/domain';

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'ApiError';
  }
}

async function getJson<T>(url: string, signal: AbortSignal, allowDegraded = false): Promise<T> {
  const response = await fetch(url, { signal });
  const payload: unknown = await response.json();
  if (!response.ok && !allowDegraded) throw new ApiError(response.status);
  return payload as T;
}

export async function fetchDevices(signal: AbortSignal): Promise<Device[]> {
  const payload = await getJson<{ devices: Device[] }>('/api/analytics/device-health', signal);
  if (!Array.isArray(payload.devices)) throw new Error('Invalid devices response');
  return payload.devices;
}

export async function fetchIncidents(signal: AbortSignal): Promise<Incident[]> {
  const payload = await getJson<{ incidents: Incident[] }>('/api/incidents?limit=50', signal);
  if (!Array.isArray(payload.incidents)) throw new Error('Invalid incidents response');
  return payload.incidents;
}

export async function fetchTemperatureSeries(
  deviceId: string,
  signal: AbortSignal,
): Promise<TimeSeriesPoint[]> {
  const payload = await getJson<{ data: TimeSeriesPoint[] }>(
    `/api/analytics/timeseries?deviceId=${encodeURIComponent(deviceId)}&sensorType=temperature&minutes=20&bucketSeconds=5`,
    signal,
  );
  if (!Array.isArray(payload.data)) throw new Error('Invalid time series response');
  return payload.data.filter(
    (point) => Number.isFinite(point.latest) && Number.isFinite(point.movingAvg),
  );
}

export async function fetchHealth(signal: AbortSignal): Promise<Health> {
  // A degraded health response is still useful to the operator.
  const health = await getJson<Health>('/health', signal, true);
  if (typeof health.status !== 'string') throw new Error('Invalid health response');
  return health;
}

export async function triggerOverheat(): Promise<void> {
  const response = await fetch('/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      deviceId: 'MOTOR-001',
      readings: [
        { sensorType: 'temperature', value: 92.4, unit: 'celsius', quality: 'good' },
        { sensorType: 'vibration', value: 6.8, unit: 'mm/s', quality: 'good' },
        { sensorType: 'rpm', value: 1450, unit: 'rpm', quality: 'good' },
      ],
    }),
  });
  if (!response.ok) throw new ApiError(response.status);
}

export async function requestRecoveryRecheck(id: string): Promise<void> {
  const response = await fetch(`/api/incidents/${encodeURIComponent(id)}/recheck`, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new ApiError(response.status);
}
