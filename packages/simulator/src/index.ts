import { DEVICES, DeviceDefinition, SensorDefinition } from './devices';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

/**
 * IOT SENSOR SIMULATOR
 * 
 * Architecture overview:
 * ┌──────────────┐    HTTP POST     ┌──────────────┐
 * │  Simulator   │ ───────────────→ │  Fastify API │
 * │  (this file) │  /api/ingest     │  :3001       │
 * └──────────────┘                  └──────────────┘
 * 
 * The simulator generates realistic sensor data:
 * - Normal operation: values fluctuate within normalMin/normalMax
 * - Gaussian noise: ±5% random variation (like real sensors)
 * - Sends batch every INTERVAL_MS (default 5 seconds)
 * 
 * Each device sends its own HTTP request with all sensor readings.
 */

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
const INTERVAL_MS = 5_000; // Send data every 5 seconds

/**
 * Generate a realistic sensor reading with Gaussian noise.
 * Real sensors don't produce perfectly smooth data — they have
 * small random fluctuations (noise) around the true value.
 */
function generateNormalReading(sensor: SensorDefinition): number {
  const mid = (sensor.normalMin + sensor.normalMax) / 2;
  const range = sensor.normalMax - sensor.normalMin;

  // Box-Muller transform for Gaussian distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  // Scale gaussian to ±15% of range around midpoint
  const value = mid + gaussian * (range * 0.15);

  // Clamp to physical limits
  return Math.max(
    sensor.absoluteMin,
    Math.min(sensor.absoluteMax, Number(value.toFixed(2))),
  );
}

/**
 * Send a batch of sensor readings for one device.
 */
async function sendReadings(device: DeviceDefinition): Promise<void> {
  const readings = device.sensors.map((sensor) => ({
    sensorType: sensor.type,
    value: generateNormalReading(sensor),
    unit: sensor.unit,
    quality: 'good' as const,
  }));

  try {
    const response = await fetch(`${API_URL}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: device.id,
        readings,
      }),
    });

    if (!response.ok) {
      console.error(`❌ [${device.id}] HTTP ${response.status}: ${await response.text()}`);
      return;
    }

    const temps = readings.filter((r) => r.sensorType === 'temperature');
    const tempStr = temps.length > 0 ? ` | temp=${temps[0].value}°C` : '';
    console.log(
      `📡 [${device.id}] Sent ${readings.length} readings${tempStr}`,
    );
  } catch (error) {
    console.error(
      `❌ [${device.id}] Failed:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Main loop: send data for all devices every INTERVAL_MS.
 */
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  🏭 SensorGuard IoT Simulator');
  console.log(`  API: ${API_URL}`);
  console.log(`  Devices: ${DEVICES.length}`);
  console.log(`  Interval: ${INTERVAL_MS}ms`);
  console.log('═══════════════════════════════════════════════');

  // Wait for API to be ready
  console.log('⏳ Waiting for API...');
  let retries = 0;
  while (retries < 30) {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (res.ok) {
        console.log('✅ API is ready!\n');
        break;
      }
    } catch {
      // API not ready yet
    }
    retries++;
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (retries >= 30) {
    console.error('❌ API not available after 60 seconds. Exiting.');
    process.exit(1);
  }

  // Start sending data
  console.log('📡 Starting normal sensor data stream...\n');

  setInterval(async () => {
    // Send all devices in parallel
    await Promise.all(DEVICES.map(sendReadings));
  }, INTERVAL_MS);
}

main();
