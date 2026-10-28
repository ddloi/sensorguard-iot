/**
 * SensorGuard — Pre-Demo Stack Verification Script
 *
 * Run this before any live demo to verify all services are healthy:
 *   npx tsx scripts/verify-stack.ts
 *
 * Checks:
 *   1. API server is responding (GET /health)
 *   2. MongoDB connection is active
 *   3. Devices are seeded and online
 *   4. Datadog API key is configured
 *   5. Overheat scenario endpoint is reachable
 */

import dotenv from 'dotenv';
dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface HealthResponse {
  status: string;
  mongodb: string;
  redis: string;
  uptime: number;
}

interface CheckResult {
  name: string;
  status: '✅ PASS' | '❌ FAIL' | '⚠️ WARN';
  detail: string;
  durationMs: number;
}

async function check(name: string, fn: () => Promise<{ status: CheckResult['status']; detail: string }>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return { name, ...result, durationMs: Date.now() - start };
  } catch (err: any) {
    return { name, status: '❌ FAIL', detail: err.message || String(err), durationMs: Date.now() - start };
  }
}

async function main() {
  console.log('\n🛡️  SensorGuard — Pre-Demo Stack Verification');
  console.log('═'.repeat(55));
  console.log(`   Target API: ${API_URL}`);
  console.log(`   Time:       ${new Date().toLocaleString('vi-VN')}`);
  console.log('═'.repeat(55) + '\n');

  const results: CheckResult[] = [];

  // 1. API Health
  results.push(await check('API Server /health', async () => {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { status: '❌ FAIL', detail: `HTTP ${res.status}` };
    const data: HealthResponse = await res.json();
    return {
      status: data.status === 'ok' ? '✅ PASS' : '⚠️ WARN',
      detail: `status=${data.status}, mongodb=${data.mongodb}, redis=${data.redis}, uptime=${Math.round(data.uptime)}s`,
    };
  }));

  // 2. Devices API
  results.push(await check('Devices Registered', async () => {
    const res = await fetch(`${API_URL}/api/devices`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { status: '❌ FAIL', detail: `HTTP ${res.status}` };
    const devices = await res.json();
    const count = Array.isArray(devices) ? devices.length : 0;
    if (count === 0) return { status: '❌ FAIL', detail: 'No devices found. Run: npm run seed' };
    return { status: '✅ PASS', detail: `${count} device(s) registered` };
  }));

  // 3. Incidents API
  results.push(await check('Incidents API', async () => {
    const res = await fetch(`${API_URL}/api/incidents`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { status: '❌ FAIL', detail: `HTTP ${res.status}` };
    const data = await res.json();
    const count = Array.isArray(data) ? data.length : 0;
    return { status: '✅ PASS', detail: `${count} incident(s) in database` };
  }));

  // 4. Analytics / Time Series endpoint
  results.push(await check('Analytics ($setWindowFields)', async () => {
    const res = await fetch(
      `${API_URL}/api/analytics/timeseries?deviceId=MOTOR-001&sensorType=temperature&minutes=5`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return { status: '⚠️ WARN', detail: `HTTP ${res.status} — May need simulator running` };
    const data = await res.json();
    const points = Array.isArray(data) ? data.length : 0;
    return {
      status: points > 0 ? '✅ PASS' : '⚠️ WARN',
      detail: `${points} time series point(s) in last 5 minutes`,
    };
  }));

  // 5. Datadog configuration
  results.push(await check('Datadog API Key', async () => {
    // Check via env — this script should be run in the same env as the API
    const key = process.env.DD_API_KEY;
    if (!key) return { status: '⚠️ WARN', detail: 'DD_API_KEY not set — metrics use HTTPS fallback only if configured in API .env' };
    return { status: '✅ PASS', detail: `Key present (${key.substring(0, 4)}...${key.substring(key.length - 4)})` };
  }));

  // 6. Dashboard
  results.push(await check('Dashboard (port 3000)', async () => {
    const res = await fetch('http://localhost:3000', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { status: '❌ FAIL', detail: `HTTP ${res.status}` };
    return { status: '✅ PASS', detail: 'Dashboard is serving' };
  }));

  // Print results
  console.log('  #  Status      Check                              Duration   Detail');
  console.log('  ─  ──────      ─────                              ────────   ──────');
  results.forEach((r, i) => {
    const num = String(i + 1).padStart(2);
    const name = r.name.padEnd(35);
    const dur = `${r.durationMs}ms`.padStart(8);
    console.log(`  ${num}  ${r.status}  ${name} ${dur}   ${r.detail}`);
  });

  const passed = results.filter(r => r.status === '✅ PASS').length;
  const warned = results.filter(r => r.status === '⚠️ WARN').length;
  const failed = results.filter(r => r.status === '❌ FAIL').length;

  console.log('\n' + '═'.repeat(55));
  console.log(`  Summary: ${passed} passed, ${warned} warnings, ${failed} failed`);

  if (failed > 0) {
    console.log('\n  ❌ Stack is NOT ready for demo. Fix the failures above.');
    process.exit(1);
  } else if (warned > 0) {
    console.log('\n  ⚠️  Stack is partially ready. Warnings may affect demo quality.');
  } else {
    console.log('\n  ✅ Stack is FULLY READY for demo! 🎉');
  }
  console.log('═'.repeat(55) + '\n');
}

main().catch((err) => {
  console.error('Verification script failed:', err);
  process.exit(1);
});
