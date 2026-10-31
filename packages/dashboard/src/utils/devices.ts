import type { Device } from '../types/domain';

/** A recently fetched device can still have an old heartbeat. */
export function getDeviceStatus(device: Device, now: number): string {
  if (
    !device.lastSeen ||
    now - new Date(device.lastSeen).getTime() > 60_000 ||
    device.sensors.length === 0
  )
    return 'offline';
  return device.status;
}
