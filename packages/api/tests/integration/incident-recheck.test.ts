import Fastify, { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findIncident: vi.fn(),
  claimIncident: vi.fn(),
  updateIncident: vi.fn(),
  findDevice: vi.fn(),
  findThresholds: vi.fn(),
  findAlerts: vi.fn(),
  enqueue: vi.fn(),
  broadcast: vi.fn(),
}));
vi.mock('../../src/models', () => ({
  Incident: {
    findById: mocks.findIncident,
    findOneAndUpdate: mocks.claimIncident,
    updateOne: mocks.updateIncident,
  },
  Device: { findById: mocks.findDevice },
  Threshold: { find: mocks.findThresholds },
  Alert: { find: mocks.findAlerts },
}));
vi.mock('../../src/queues', () => ({
  getQueues: () => ({ remediationQueue: { add: mocks.enqueue } }),
}));
vi.mock('../../src/utils/websocket', () => ({ wsManager: { broadcast: mocks.broadcast } }));
import { incidentRoutes } from '../../src/routes/incidents';

const id = '6ae21116a4ddb5d33cab6c1a';
const incident = {
  _id: id,
  deviceId: 'MOTOR-001',
  status: 'investigating',
  timeline: [{ event: 'escalated', alertId: id }],
  rootCause: 'Simulated cause',
  resolution: null,
};
let app: FastifyInstance;

beforeEach(async () => {
  vi.resetAllMocks();
  mocks.findIncident.mockReturnValue({ lean: async () => incident });
  mocks.findDevice.mockReturnValue({ lean: async () => ({ type: 'motor' }) });
  mocks.findThresholds.mockReturnValue({
    lean: async () => [{ deviceId: '*', deviceType: 'motor', sensorType: 'temperature' }],
  });
  mocks.findAlerts.mockReturnValue({
    lean: async () => [{ _id: id, sensorType: 'temperature', triggerValue: 92.4 }],
  });
  mocks.claimIncident.mockResolvedValue(incident);
  mocks.enqueue.mockResolvedValue({ id: 'queued' });
  app = Fastify();
  await app.register(incidentRoutes);
});
afterEach(async () => {
  await app.close();
});

describe('POST incident recovery recheck', () => {
  it('rejects an invalid ID before querying the database', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/incidents/invalid/recheck' });
    expect(response.statusCode).toBe(400);
    expect(mocks.findIncident).not.toHaveBeenCalled();
  });
  it('returns 404 for a missing incident', async () => {
    mocks.findIncident.mockReturnValue({ lean: async () => null });
    expect(
      (await app.inject({ method: 'POST', url: `/api/incidents/${id}/recheck` })).statusCode,
    ).toBe(404);
  });
  it('rejects resolved incidents and avoids queueing a duplicate running verification', async () => {
    for (const status of ['resolved', 'mitigating']) {
      mocks.findIncident.mockReturnValue({ lean: async () => ({ ...incident, status }) });
      expect(
        (await app.inject({ method: 'POST', url: `/api/incidents/${id}/recheck` })).statusCode,
      ).toBe(409);
    }
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it('requires a matching equipment threshold before claiming or queueing', async () => {
    mocks.findThresholds.mockReturnValue({ lean: async () => [] });
    const response = await app.inject({ method: 'POST', url: `/api/incidents/${id}/recheck` });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toContain('threshold');
    expect(mocks.claimIncident).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it('queues bounded verification with a unique namespace without force-resolving', async () => {
    const first = await app.inject({ method: 'POST', url: `/api/incidents/${id}/recheck` });
    const second = await app.inject({ method: 'POST', url: `/api/incidents/${id}/recheck` });
    expect(first.statusCode).toBe(202);
    expect(first.json().verificationRun).not.toBe(second.json().verificationRun);
    expect(mocks.claimIncident).toHaveBeenCalledWith(
      { _id: id, status: 'investigating' },
      expect.objectContaining({ $set: { status: 'mitigating' } }),
    );
    expect(mocks.enqueue).toHaveBeenCalledWith(
      'verify-recovery',
      expect.objectContaining({
        incidentId: id,
        deviceId: 'MOTOR-001',
        verificationAttempt: 0,
        verificationRun: first.json().verificationRun,
      }),
      expect.objectContaining({ jobId: `verify-${id}-${first.json().verificationRun}` }),
    );
    expect(mocks.updateIncident).not.toHaveBeenCalled();
  });
  it('does not queue when another request already claimed the incident', async () => {
    mocks.claimIncident.mockResolvedValue(null);
    expect(
      (await app.inject({ method: 'POST', url: `/api/incidents/${id}/recheck` })).statusCode,
    ).toBe(409);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it('restores review state when the queue is unavailable so retry remains possible', async () => {
    mocks.enqueue.mockRejectedValue(new Error('Unavailable'));
    expect(
      (await app.inject({ method: 'POST', url: `/api/incidents/${id}/recheck` })).statusCode,
    ).toBe(503);
    expect(mocks.updateIncident).toHaveBeenCalledWith(
      { _id: id, status: 'mitigating' },
      expect.objectContaining({
        $set: { status: 'investigating' },
        $push: { timeline: expect.objectContaining({ event: 'escalated' }) },
      }),
    );
  });
});
