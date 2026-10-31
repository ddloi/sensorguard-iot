export interface HealthDependencies {
  pingMongo: () => Promise<unknown>;
  pingRedis: () => Promise<unknown>;
  datadogConfigured: boolean;
  uptime: number;
}

// Bound dependency checks so an unavailable service cannot hang the dashboard.
async function isReachable(ping: () => Promise<unknown>, timeoutMs: number): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(ping),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Health check timed out')), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function getServiceHealth(dependencies: HealthDependencies, timeoutMs = 2000) {
  const [mongoConnected, redisConnected] = await Promise.all([
    isReachable(dependencies.pingMongo, timeoutMs),
    isReachable(dependencies.pingRedis, timeoutMs),
  ]);
  return {
    status: mongoConnected && redisConnected ? 'ok' : 'degraded',
    service: 'sensorguard-api',
    mongodb: mongoConnected ? 'connected' : 'disconnected',
    redis: redisConnected ? 'connected' : 'disconnected',
    // This reports configuration only; delivery must be checked in Datadog.
    datadog: dependencies.datadogConfigured ? 'configured' : 'unconfigured',
    uptime: dependencies.uptime,
    timestamp: new Date().toISOString(),
  };
}
