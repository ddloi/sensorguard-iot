import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  process: undefined as (() => Promise<void>) | undefined,
  find: vi.fn(),
  aggregate: vi.fn(),
  gauge: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Worker: class {
    constructor(_name: string, process: () => Promise<void>) {
      mocks.process = process;
    }
    on() {
      return this;
    }
  },
}));
vi.mock('../../src/config/redis', () => ({ createRedisConnection: () => ({}) }));
vi.mock('../../src/models', () => ({
  Device: { find: mocks.find, aggregate: mocks.aggregate },
}));
vi.mock('../../src/config/datadog', () => ({
  datadogMetrics: { gauge: mocks.gauge },
}));
vi.mock('../../src/utils/logger', () => ({ logger: { info: vi.fn() } }));

import { startDeviceHealthWorker } from '../../src/workers/deviceHealth.worker';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockReturnValue({ lean: async () => [] });
  startDeviceHealthWorker();
});

describe('Device status metrics', () => {
  it('emits zero offline devices after the last offline device has recovered', async () => {
    mocks.aggregate.mockResolvedValueOnce([{ _id: 'offline', count: 1 }]);
    await mocks.process!();
    expect(mocks.gauge).toHaveBeenCalledWith('device.count', 1, ['status:offline']);

    mocks.gauge.mockClear();
    mocks.aggregate.mockResolvedValueOnce([{ _id: 'online', count: 5 }]);
    await mocks.process!();
    expect(mocks.gauge).toHaveBeenCalledWith('device.count', 0, ['status:offline']);
    expect(mocks.gauge).toHaveBeenCalledWith('device.count', 5, ['status:online']);
    expect(mocks.gauge).toHaveBeenCalledTimes(5);
  });
});
