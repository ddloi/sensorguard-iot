import { DEVICES } from '../devices';
import { simulatorConfig } from '../config';

/**
 * OVERHEAT SCENARIO — The star of the demo.
 *
 * This script runs the "quá nhiệt động cơ" scenario:
 *
 * Phase 1 (0-30s):   Normal operation — all sensors within range
 * Phase 2 (30-90s):  Temperature RISING on MOTOR-001 — gradual increase
 * Phase 3 (90-120s): CRITICAL — temperature exceeds threshold
 * Phase 4 (120s+):   Wait for auto-remediation, then show RECOVERY
 *
 * Run this AFTER the normal simulator to show the full incident lifecycle.
 * Usage: npm run dev:scenario (from packages/simulator)
 */

const API_URL = simulatorConfig.apiUrl;
const TARGET_DEVICE = DEVICES.find((d) => d.id === 'MOTOR-001')!;

interface Phase {
  name: string;
  durationMs: number;
  tempRange: { base: number; noise: number };
  vibRange: { base: number; noise: number };
  rpmValue: number;
  description: string;
}

const PHASES: Phase[] = [
  {
    name: 'NORMAL',
    durationMs: 30_000, // 30 seconds
    tempRange: { base: 65, noise: 3 },
    vibRange: { base: 2.5, noise: 0.5 },
    rpmValue: 1450,
    description: '✅ Normal operation — temperature ~65°C',
  },
  {
    name: 'RISING',
    durationMs: 60_000, // 60 seconds — temp rises gradually
    tempRange: { base: 65, noise: 2 }, // base will be overridden with linear increase
    vibRange: { base: 3.5, noise: 1.0 }, // vibration also increases
    rpmValue: 1450,
    description: '⚠️ Temperature RISING — simulating bearing degradation',
  },
  {
    name: 'CRITICAL',
    durationMs: 30_000, // 30 seconds at critical level
    tempRange: { base: 92, noise: 3 },
    vibRange: { base: 6.0, noise: 1.5 },
    rpmValue: 1450,
    description: '🔴 CRITICAL — temperature above threshold!',
  },
  {
    name: 'RECOVERY',
    durationMs: 45_000, // 45 seconds — temp drops back
    tempRange: { base: 92, noise: 2 }, // base will decrease over time
    vibRange: { base: 2.5, noise: 0.5 },
    rpmValue: 750, // RPM reduced by auto-remediation
    description: '🟢 RECOVERY — auto-remediation reducing temperature',
  },
];

function addNoise(base: number, noise: number): number {
  return Number((base + (Math.random() - 0.5) * 2 * noise).toFixed(2));
}

async function sendReading(temp: number, vibration: number, rpm: number): Promise<void> {
  const readings = [
    { sensorType: 'temperature', value: temp, unit: 'celsius', quality: 'good' as const },
    { sensorType: 'vibration', value: vibration, unit: 'mm/s', quality: 'good' as const },
    { sensorType: 'rpm', value: rpm, unit: 'rpm', quality: 'good' as const },
  ];

  try {
    const res = await fetch(`${API_URL}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: TARGET_DEVICE.id, readings }),
    });

    if (!res.ok) {
      console.error(`  ❌ HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runScenario() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🔥 SensorGuard — OVERHEAT SCENARIO');
  console.log(`  Target: ${TARGET_DEVICE.id} (${TARGET_DEVICE.name})`);
  console.log('  This will simulate a motor overheat incident.');
  console.log('═══════════════════════════════════════════════════════\n');

  // Wait for API
  try {
    await fetch(`${API_URL}/health`);
  } catch {
    console.error('❌ API not available. Start the API first.');
    process.exit(1);
  }

  const INTERVAL = 5_000; // Send every 5s

  for (const phase of PHASES) {
    console.log(`\n${'─'.repeat(55)}`);
    console.log(`  Phase: ${phase.name} | ${phase.description}`);
    console.log(`  Duration: ${phase.durationMs / 1000}s`);
    console.log(`${'─'.repeat(55)}`);

    const ticks = Math.floor(phase.durationMs / INTERVAL);
    for (let i = 0; i < ticks; i++) {
      const progress = i / ticks; // 0.0 → 1.0

      let temp: number;
      let vib: number;
      const rpm = addNoise(phase.rpmValue, 20);

      if (phase.name === 'RISING') {
        // Linear increase: 65°C → 95°C over the phase
        const risingBase = 65 + progress * 30;
        temp = addNoise(risingBase, phase.tempRange.noise);
        vib = addNoise(phase.vibRange.base + progress * 3, phase.vibRange.noise);
      } else if (phase.name === 'RECOVERY') {
        // Linear decrease: 92°C → 60°C over the phase
        const recoveryBase = 92 - progress * 32;
        temp = addNoise(recoveryBase, phase.tempRange.noise);
        vib = addNoise(phase.vibRange.base, phase.vibRange.noise);
      } else {
        temp = addNoise(phase.tempRange.base, phase.tempRange.noise);
        vib = addNoise(phase.vibRange.base, phase.vibRange.noise);
      }

      console.log(
        `  [${String(i + 1).padStart(2)}/${ticks}] temp=${temp}°C | vib=${vib}mm/s | rpm=${rpm}`,
      );

      await sendReading(temp, vib, rpm);
      await sleep(INTERVAL);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ✅ SCENARIO COMPLETE');
  console.log('  Check Datadog Dashboard and SensorGuard Dashboard');
  console.log('  for the full incident timeline.');
  console.log('═══════════════════════════════════════════════════════');
}

runScenario();
