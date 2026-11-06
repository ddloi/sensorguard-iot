import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  processors: new Map<
    string,
    (job: { name: string; data: Record<string, unknown> }) => Promise<unknown>
  >(),
  findDevice: vi.fn(),
  findThresholds: vi.fn(),
  findIncident: vi.fn(),
  findAlerts: vi.fn(),
  findReading: vi.fn(),
  updateIncident: vi.fn(),
  updateDevice: vi.fn(),
  updateAlerts: vi.fn(),
  hasIncident: vi.fn(),
  enqueue: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Worker: class {
    constructor(
      name: string,
      processor: (job: { name: string; data: Record<string, unknown> }) => Promise<unknown>,
    ) {
      mocks.processors.set(name, processor);
    }
    on() {
      return this;
    }
  },
}));
vi.mock('../../src/config/redis', () => ({ createRedisConnection: () => ({}) }));
vi.mock('../../src/config/datadog', () => ({
  datadogMetrics: { increment: vi.fn(), gauge: vi.fn(), histogram: vi.fn() },
  sendDatadogLog: vi.fn(),
  startTimer: () => vi.fn(),
}));
vi.mock('../../src/utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../src/utils/websocket', () => ({ wsManager: { broadcast: mocks.broadcast } }));
vi.mock('../../src/queues', () => ({
  getQueues: () => ({
    alertQueue: { add: mocks.enqueue },
    remediationQueue: { add: mocks.enqueue },
  }),
}));
vi.mock('../../src/models', () => ({
  Device: { findById: mocks.findDevice, updateOne: mocks.updateDevice },
  Threshold: { find: mocks.findThresholds },
  Incident: {
    findById: mocks.findIncident,
    updateOne: mocks.updateIncident,
    exists: mocks.hasIncident,
  },
  Alert: { find: mocks.findAlerts, updateMany: mocks.updateAlerts },
  SensorData: { findOne: mocks.findReading },
}));

import { startRemediationWorker } from '../../src/workers/remediation.worker';
import { startThresholdWorker } from '../../src/workers/threshold.worker';

const rule = {
  deviceId: '*',
  deviceType: 'motor',
  sensorType: 'temperature',
  warning: { min: 10, max: 75 },
  critical: { min: 5, max: 85 },
};
const data = {
  deviceId: 'MOTOR-001',
  sensorType: 'temperature',
  value: 92.4,
  incidentId: 'incident-1',
  alertId: 'alert-1',
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.processors.clear();
  mocks.findDevice.mockReturnValue({ lean: async () => ({ type: 'motor', status: 'online' }) });
  mocks.findThresholds.mockReturnValue({ lean: async () => [rule] });
  mocks.findIncident.mockResolvedValue({
    createdAt: new Date(Date.now() - 60_000),
    status: 'mitigating',
    timeline: [],
  });
  mocks.findAlerts.mockReturnValue({ lean: async () => [] });
  mocks.findReading.mockReturnValue({
    sort: () => ({ lean: async () => ({ value: 64, timestamp: new Date() }) }),
  });
  mocks.updateDevice.mockResolvedValue({ modifiedCount: 1 });
  mocks.hasIncident.mockResolvedValue(null);
  startRemediationWorker();
  startThresholdWorker();
});

function processRecovery(overrides: Record<string, unknown> = {}, name = 'verify-recovery') {
  return mocks.processors.get('remediation')!({ name, data: { ...data, ...overrides } });
}

function processThreshold(value: number) {
  return mocks.processors.get('threshold-check')!({
    name: 'check',
    data: {
      deviceId: data.deviceId,
      readings: [
        {
          sensorType: 'temperature',
          value,
          timestamp: new Date().toISOString(),
          unit: 'celsius',
          location: 'A',
        },
      ],
    },
  });
}

describe('Threshold worker', () => {
  it('queues critical alerts before warning alerts and preserves the threshold value', async () => {
    await processThreshold(92.4);
    expect(mocks.enqueue).toHaveBeenCalledWith(
      'critical-alert',
      expect.objectContaining({ severity: 'critical', thresholdValue: 85 }),
      expect.objectContaining({ jobId: expect.stringContaining('-critical-') }),
    );
    expect(mocks.updateAlerts).not.toHaveBeenCalled();
  });
  it('uses the lower warning boundary as the trigger value', async () => {
    await processThreshold(10);
    expect(mocks.enqueue).toHaveBeenCalledWith(
      'warning-alert',
      expect.objectContaining({ severity: 'warning', thresholdValue: 10 }),
      expect.anything(),
    );
  });
  it('clears normal warning alerts but leaves devices with an active incident alone', async () => {
    mocks.findDevice.mockReturnValue({ lean: async () => ({ type: 'motor', status: 'warning' }) });
    mocks.hasIncident.mockResolvedValue({ _id: 'active' });
    await processThreshold(64);
    expect(mocks.updateAlerts).toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.updateDevice).not.toHaveBeenCalled();
  });
  it('restores the device when normal readings arrive without an active incident', async () => {
    mocks.findDevice.mockReturnValue({ lean: async () => ({ type: 'motor', status: 'warning' }) });
    await processThreshold(64);
    expect(mocks.broadcast).toHaveBeenCalledWith('device_status', {
      deviceId: data.deviceId,
      status: 'online',
    });
  });
});

describe('Remediation worker', () => {
  it('records mitigation before scheduling the first recovery check', async () => {
    await processRecovery({}, 'auto-remediate');
    expect(mocks.updateIncident).toHaveBeenCalledWith(
      { _id: data.incidentId },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'mitigating' }) }),
    );
    expect(mocks.enqueue).toHaveBeenCalledWith(
      'verify-recovery',
      expect.objectContaining(data),
      expect.objectContaining({ delay: 8000, jobId: 'verify-incident-1' }),
    );
    expect(mocks.updateIncident.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.enqueue.mock.invocationCallOrder[0],
    );
  });
  it('resolves with fresh safe evidence and publishes the final status', async () => {
    await processRecovery();
    expect(mocks.updateIncident).toHaveBeenCalledWith(
      { _id: data.incidentId },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'resolved', duration: 60 }),
      }),
    );
    expect(mocks.updateAlerts).toHaveBeenCalledWith(
      { _id: { $in: [data.alertId] } },
      expect.anything(),
    );
    expect(mocks.broadcast).toHaveBeenCalledWith(
      'incident',
      expect.objectContaining({ action: 'resolved' }),
    );
  });
  it('retries unsafe evidence within the same verification namespace', async () => {
    mocks.findReading.mockReturnValue({
      sort: () => ({ lean: async () => ({ value: 94, timestamp: new Date() }) }),
    });
    await processRecovery({ verificationRun: 'run-2', verificationAttempt: 2 });
    expect(mocks.enqueue).toHaveBeenCalledWith(
      'verify-recovery',
      expect.objectContaining({ verificationAttempt: 3, verificationRun: 'run-2' }),
      expect.objectContaining({ jobId: 'verify-incident-1-run-2-3', delay: 8000 }),
    );
    expect(mocks.updateIncident).not.toHaveBeenCalled();
  });
  it('escalates missing evidence when the retry budget is exhausted', async () => {
    mocks.findReading.mockReturnValue({ sort: () => ({ lean: async () => null }) });
    await processRecovery({ verificationAttempt: 5 });
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.updateIncident).toHaveBeenCalledWith(
      { _id: data.incidentId },
      expect.objectContaining({
        $set: { status: 'investigating' },
        $push: { timeline: expect.objectContaining({ event: 'escalated' }) },
      }),
    );
    expect(mocks.broadcast).toHaveBeenCalledWith('device_status', {
      deviceId: data.deviceId,
      status: 'critical',
    });
  });
  it('does not resolve if a linked alert has no matching sensor threshold', async () => {
    mocks.findAlerts.mockReturnValue({ lean: async () => [{ sensorType: 'vibration' }] });
    await processRecovery();
    expect(mocks.enqueue).toHaveBeenCalledWith(
      'verify-recovery',
      expect.anything(),
      expect.anything(),
    );
    expect(mocks.updateIncident).not.toHaveBeenCalled();
  });
  it('ignores already resolved or missing incidents', async () => {
    for (const incident of [null, { status: 'resolved' }]) {
      mocks.findIncident.mockResolvedValue(incident);
      await processRecovery();
    }
    expect(mocks.findReading).not.toHaveBeenCalled();
    expect(mocks.updateIncident).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
