import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/env', () => ({
  env: { UPSTASH_REDIS_URL: 'redis://x', REDIS_TLS: 'auto' },
}));
vi.mock('../../src/utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
import { needsThresholdCheck } from '../../src/domain/threshold';
import { shouldUseTls } from '../../src/config/redis';

const band = (max: number | null, min: number | null = null) => ({ min, max });
const thresholds = [
  {
    deviceId: '*',
    deviceType: 'motor',
    sensorType: 'temperature',
    warning: band(80),
    critical: band(90),
  },
  {
    deviceId: 'MOTOR-001',
    deviceType: 'motor',
    sensorType: 'temperature',
    warning: band(80),
    critical: band(85),
  },
  {
    deviceId: '*',
    deviceType: 'motor',
    sensorType: 'rpm',
    warning: band(1600, 800),
    critical: band(1800, 500),
  },
];
const context = (overrides: Partial<Parameters<typeof needsThresholdCheck>[1]> = {}) => ({
  deviceId: 'MOTOR-001',
  deviceType: 'motor',
  deviceStatus: 'online',
  hasActiveWarning: false,
  thresholds,
  ...overrides,
});

describe('Ingest threshold-queue filter', () => {
  it('skips the queue for normal readings from a healthy device', () => {
    const readings = [
      { sensorType: 'temperature', value: 61.2 },
      { sensorType: 'rpm', value: 1450 },
    ];
    expect(needsThresholdCheck(readings, context())).toBe(false);
  });

  it('queues a reading that reaches the device-specific critical threshold', () => {
    expect(needsThresholdCheck([{ sensorType: 'temperature', value: 85 }], context())).toBe(true);
  });

  it('queues a reading below a lower warning bound', () => {
    expect(needsThresholdCheck([{ sensorType: 'rpm', value: 790 }], context())).toBe(true);
  });

  it('queues normal readings for warning or offline devices so the worker can restore them', () => {
    for (const deviceStatus of ['warning', 'offline']) {
      expect(
        needsThresholdCheck([{ sensorType: 'temperature', value: 60 }], context({ deviceStatus })),
      ).toBe(true);
    }
  });

  it('leaves normal readings of critical or maintenance devices to the incident workflow', () => {
    for (const deviceStatus of ['critical', 'maintenance']) {
      expect(
        needsThresholdCheck([{ sensorType: 'temperature', value: 60 }], context({ deviceStatus })),
      ).toBe(false);
    }
  });

  it('still queues violations from a device that is already critical', () => {
    expect(
      needsThresholdCheck(
        [{ sensorType: 'temperature', value: 95 }],
        context({ deviceStatus: 'critical' }),
      ),
    ).toBe(true);
  });

  it('queues normal readings while a warning alert is still active so it can auto-resolve', () => {
    expect(
      needsThresholdCheck(
        [{ sensorType: 'temperature', value: 60 }],
        context({ hasActiveWarning: true }),
      ),
    ).toBe(true);
  });

  it('ignores sensors without a matching rule', () => {
    expect(needsThresholdCheck([{ sensorType: 'pressure', value: 999 }], context())).toBe(false);
  });
});

describe('Redis TLS selection', () => {
  it('follows the URL scheme in auto mode', () => {
    expect(shouldUseTls('rediss://host.upstash.io:6379', 'auto')).toBe(true);
    expect(shouldUseTls('redis://localhost:6379', 'auto')).toBe(false);
  });

  it('honours an explicit override', () => {
    expect(shouldUseTls('redis://localhost:6379', 'true')).toBe(true);
    expect(shouldUseTls('rediss://host:6379', 'false')).toBe(false);
  });
});
