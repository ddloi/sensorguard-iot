/** Read-only pre-demo checks. Run from the repository root: npm run verify. */
import dotenv from 'dotenv';
import WebSocket from 'ws';

dotenv.config();

const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3000';
type Result = {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  detail: string;
  durationMs: number;
};
type Detail = Pick<Result, 'status' | 'detail'>;

async function check(name: string, fn: () => Promise<Detail>): Promise<Result> {
  const start = Date.now();
  try {
    return { name, ...(await fn()), durationMs: Date.now() - start };
  } catch (error) {
    // Avoid printing connection strings or credentials from third-party errors.
    const detail =
      error instanceof Error && error.message.startsWith('HTTP ')
        ? error.message
        : 'Service unavailable, timed out, or returned an invalid response';
    return { name, status: 'FAIL', detail, durationMs: Date.now() - start };
  }
}

async function getJson(path: string) {
  const response = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} at ${path}`);
  return response.json();
}

async function main() {
  console.log('\nSensorGuard — Pre-Demo Verification');
  console.log(`Time: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n`);

  const results = await Promise.all([
    check('API + MongoDB + Redis', async () => {
      const data = await getJson('/health');
      if (data.status !== 'ok' || data.mongodb !== 'connected' || data.redis !== 'connected') {
        return { status: 'FAIL', detail: 'API dependencies are not healthy; inspect /health' };
      }
      return {
        status: 'PASS',
        detail: `Live MongoDB and Redis checks passed; uptime ${Math.round(data.uptime)}s`,
      };
    }),
    check('Registered demo device', async () => {
      const data = await getJson('/api/devices');
      if (!Array.isArray(data.devices))
        return { status: 'FAIL', detail: 'Invalid devices response' };
      if (!data.devices.some((device: { _id: string }) => device._id === 'MOTOR-001')) {
        return { status: 'FAIL', detail: 'MOTOR-001 is missing. Review seed data before demo' };
      }
      return {
        status: 'PASS',
        detail: `${data.devices.length} registered devices; MOTOR-001 found`,
      };
    }),
    check('Fresh fleet telemetry', async () => {
      const data = await getJson('/api/analytics/device-health');
      if (!Array.isArray(data.devices) || data.devices.length === 0) {
        return { status: 'FAIL', detail: 'Fleet is empty' };
      }
      const fresh = data.devices.filter((device: { sensors?: { lastReading?: string }[] }) =>
        device.sensors?.some((sensor) => {
          const age = Date.now() - new Date(sensor.lastReading || '').getTime();
          return Number.isFinite(age) && age >= -5000 && age < 30000;
        }),
      ).length;
      return {
        status: fresh === data.devices.length ? 'PASS' : fresh === 0 ? 'FAIL' : 'WARN',
        detail: `${fresh}/${data.devices.length} devices have readings within 30s. ${fresh < data.devices.length ? 'Start/check npm run dev:simulator' : 'Simulator is streaming'}`,
      };
    }),
    check('Incident response API', async () => {
      const data = await getJson('/api/incidents');
      if (!Array.isArray(data.incidents))
        return { status: 'FAIL', detail: 'Invalid incidents response' };
      const active = data.incidents.filter(
        (incident: { status: string }) => incident.status !== 'resolved',
      ).length;
      return {
        status: active > 0 ? 'WARN' : 'PASS',
        detail: `${data.incidents.length} recent incidents, ${active} active; ${active > 0 ? 'review unresolved incidents before presenting' : 'lifecycle not triggered by this check'}`,
      };
    }),
    check('MongoDB windowed analytics', async () => {
      const data = await getJson(
        '/api/analytics/timeseries?deviceId=MOTOR-001&sensorType=temperature&minutes=5&bucketSeconds=5',
      );
      if (!Array.isArray(data.data))
        return { status: 'FAIL', detail: 'Invalid time series response' };
      if (data.data.length === 0)
        return { status: 'FAIL', detail: 'No MOTOR-001 temperature samples in the last 5 minutes' };
      const last = data.data.at(-1);
      if (!Number.isFinite(last.latest) || !Number.isFinite(last.movingAvg)) {
        return { status: 'FAIL', detail: 'Latest reading or moving average is invalid' };
      }
      const age = Date.now() - new Date(last.timestamp).getTime();
      return {
        status: age < 30000 ? 'PASS' : 'WARN',
        detail: `${data.data.length} points; latest ${last.latest}°C, moving avg ${last.movingAvg}°C; newest bucket ${Math.round(age / 1000)}s ago`,
      };
    }),
    check(
      'Live WebSocket',
      () =>
        new Promise<Detail>((resolve) => {
          const socket = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/ws`);
          let settled = false;
          const finish = (result: Detail) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            socket.close();
            resolve(result);
          };
          const timeout = setTimeout(() => {
            finish({ status: 'FAIL', detail: 'WebSocket handshake timed out' });
            socket.terminate();
          }, 5000);
          socket.once('open', () =>
            finish({ status: 'PASS', detail: 'WebSocket upgrade accepted' }),
          );
          socket.once('error', () =>
            finish({ status: 'FAIL', detail: 'WebSocket connection failed' }),
          );
        }),
    ),
    check('Datadog configuration', async () => {
      const data = await getJson('/health');
      if (data.datadog !== 'configured')
        return { status: 'WARN', detail: 'API has no Datadog API key configured' };
      return {
        status: 'PASS',
        detail:
          'API key configured. Confirm actual metrics/log delivery in Datadog before presenting',
      };
    }),
    check('Dashboard', async () => {
      const response = await fetch(DASHBOARD_URL, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP ${response.status} at dashboard`);
      const html = await response.text();
      return html.includes('id="root"')
        ? { status: 'PASS', detail: 'React dashboard is serving' }
        : { status: 'FAIL', detail: 'Expected dashboard entry was not found' };
    }),
  ]);

  for (const result of results) {
    console.log(`[${result.status}] ${result.name} (${result.durationMs}ms) — ${result.detail}`);
  }
  const failed = results.filter((result) => result.status === 'FAIL').length;
  const warned = results.filter((result) => result.status === 'WARN').length;
  console.log(
    `\nSummary: ${results.length - failed - warned} passed, ${warned} warnings, ${failed} failed`,
  );
  console.log(
    failed
      ? 'Demo is NOT ready. Fix the failures above.'
      : warned
        ? 'Demo has warnings. Resolve them before presenting.'
        : 'Connectivity and data checks passed. Rehearse one overheat cycle and confirm Datadog delivery.',
  );
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch(() => {
  console.error('Verification failed. Check service availability and environment configuration.');
  process.exitCode = 1;
});
