import { describe, expect, it } from 'vitest';
import { getServiceHealth } from '../../src/services/health';

describe('Live dependency health', () => {
  it('reports connected dependencies without claiming Datadog delivery', async () => {
    const health = await getServiceHealth({
      pingMongo: async () => ({ ok: 1 }),
      pingRedis: async () => 'PONG',
      datadogConfigured: true,
      uptime: 42,
    });
    expect(health).toMatchObject({
      status: 'ok',
      mongodb: 'connected',
      redis: 'connected',
      datadog: 'configured',
      uptime: 42,
    });
  });

  it('reports failure when MongoDB disconnects even if Redis responds', async () => {
    const health = await getServiceHealth({
      pingMongo: async () => {
        throw new Error('Disconnected');
      },
      pingRedis: async () => 'PONG',
      datadogConfigured: false,
      uptime: 1,
    });
    expect(health).toMatchObject({
      status: 'degraded',
      mongodb: 'disconnected',
      redis: 'connected',
      datadog: 'unconfigured',
    });
  });

  it('bounds a stalled Redis request and reports degraded health', async () => {
    const health = await getServiceHealth(
      {
        pingMongo: async () => ({ ok: 1 }),
        pingRedis: () => new Promise(() => {}),
        datadogConfigured: false,
        uptime: 1,
      },
      10,
    );
    expect(health).toMatchObject({ status: 'degraded', redis: 'disconnected' });
  });
});
