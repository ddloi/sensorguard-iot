import Fastify, { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { DEVICE_API_KEY: undefined as string | undefined },
  findDevice: vi.fn(),
  updateDevice: vi.fn(),
  alertExists: vi.fn(),
  findThresholds: vi.fn(),
  insertMany: vi.fn(),
  enqueue: vi.fn(),
  broadcast: vi.fn(),
}));
vi.mock('../../src/config/env', () => ({ env: mocks.env }));
vi.mock('../../src/config/datadog', () => ({
  datadogMetrics: { increment: vi.fn(), gauge: vi.fn(), histogram: vi.fn() },
}));
vi.mock('../../src/utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../src/utils/websocket', () => ({ wsManager: { broadcast: mocks.broadcast } }));
vi.mock('../../src/queues', () => ({
  getQueues: () => ({ thresholdQueue: { add: mocks.enqueue } }),
}));
vi.mock('../../src/models', () => ({
  Device: { findById: mocks.findDevice, updateOne: mocks.updateDevice },
  Alert: { exists: mocks.alertExists },
  Threshold: { find: mocks.findThresholds },
  SensorData: { insertMany: mocks.insertMany },
}));
import { ingestRoutes, isDeviceKeyValid } from '../../src/routes/ingest';
import { demoRoutes } from '../../src/routes/demo';

const KEY = 'test-device-key-0123456789';
const rules = [
  {
    deviceId: 'MOTOR-001',
    deviceType: 'motor',
    sensorType: 'temperature',
    warning: { min: null, max: 80 },
    critical: { min: null, max: 85 },
  },
  {
    deviceId: '*',
    deviceType: 'motor',
    sensorType: 'temperature',
    warning: { min: null, max: 80 },
    critical: { min: null, max: 90 },
  },
];
let app: FastifyInstance;
let deviceStatus = 'online';

const post = (deviceId: string, value: number, headers: Record<string, string> = {}) =>
  app.inject({
    method: 'POST',
    url: '/api/ingest',
    headers,
    payload: { deviceId, readings: [{ sensorType: 'temperature', value, unit: 'celsius' }] },
  });

beforeEach(async () => {
  vi.resetAllMocks();
  mocks.env.DEVICE_API_KEY = undefined;
  deviceStatus = 'online';
  mocks.findDevice.mockImplementation((id: string) => ({
    lean: async () =>
      id.startsWith('MISSING')
        ? null
        : { _id: id, type: 'motor', location: 'line-a', status: deviceStatus },
  }));
  mocks.alertExists.mockResolvedValue(null);
  mocks.findThresholds.mockReturnValue({ lean: async () => rules });
  mocks.insertMany.mockResolvedValue([]);
  mocks.updateDevice.mockResolvedValue({});
  mocks.enqueue.mockResolvedValue({ id: 'job' });
  app = Fastify();
  await app.register(ingestRoutes);
  await app.register(demoRoutes);
});
afterEach(async () => {
  await app.close();
});

// Each test uses its own device ID because the route caches device context for 5 seconds.
describe('POST /api/ingest', () => {
  it('stores normal readings without queueing a threshold job', async () => {
    const res = await post('MOTOR-A1', 61.5);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', readingsCount: 1, queued: false });
    expect(mocks.insertMany).toHaveBeenCalledOnce();
    expect(mocks.broadcast).toHaveBeenCalledWith(
      'telemetry',
      expect.objectContaining({ deviceId: 'MOTOR-A1' }),
    );
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('queues a threshold job when a reading violates a rule', async () => {
    const res = await post('MOTOR-A2', 95);
    expect(res.json()).toMatchObject({ queued: true });
    expect(mocks.enqueue).toHaveBeenCalledWith(
      'check-MOTOR-A2',
      expect.objectContaining({ deviceId: 'MOTOR-A2' }),
      expect.any(Object),
    );
  });

  it('queues normal readings while the device still needs restoring', async () => {
    deviceStatus = 'warning';
    const res = await post('MOTOR-A3', 60);
    expect(res.json()).toMatchObject({ queued: true });
  });

  it('returns 404 for an unknown device and stores nothing', async () => {
    const res = await post('MISSING-1', 60);
    expect(res.statusCode).toBe(404);
    expect(mocks.insertMany).not.toHaveBeenCalled();
  });

  it('rejects an invalid payload before touching the database', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/ingest', payload: { readings: [] } });
    expect(res.statusCode).toBe(400);
    expect(mocks.findDevice).not.toHaveBeenCalled();
  });

  it('requires the device key when DEVICE_API_KEY is set', async () => {
    mocks.env.DEVICE_API_KEY = KEY;
    expect((await post('MOTOR-A4', 60)).statusCode).toBe(401);
    expect(
      (await post('MOTOR-A4', 60, { 'x-device-key': 'wrong-key-wrong-key-00' })).statusCode,
    ).toBe(401);
    expect(mocks.insertMany).not.toHaveBeenCalled();
    expect((await post('MOTOR-A4', 60, { 'x-device-key': KEY })).statusCode).toBe(200);
  });
});

describe('POST /api/demo/overheat', () => {
  it('injects the fixed MOTOR-001 overheat sample without a device key', async () => {
    mocks.env.DEVICE_API_KEY = KEY;
    const res = await app.inject({ method: 'POST', url: '/api/demo/overheat' });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ deviceId: 'MOTOR-001', readingsCount: 3, queued: true });
    const stored = mocks.insertMany.mock.calls[0][0] as Array<{
      value: number;
      metadata: { sensorType: string };
    }>;
    expect(stored.find((d) => d.metadata.sensorType === 'temperature')?.value).toBe(92.4);
  });
});

describe('Device key comparison', () => {
  it('accepts any caller when no key is configured', () => {
    expect(isDeviceKeyValid(undefined, undefined)).toBe(true);
  });
  it('requires an exact match when a key is configured', () => {
    expect(isDeviceKeyValid(KEY, KEY)).toBe(true);
    expect(isDeviceKeyValid(KEY, KEY.slice(0, -1))).toBe(false);
    expect(isDeviceKeyValid(KEY, ['array'])).toBe(false);
  });
});
