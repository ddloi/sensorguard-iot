import { DEVICES, DeviceDefinition, SensorDefinition } from './devices';
import { simulatorConfig, ingestHeaders } from './config';

const API_URL = simulatorConfig.apiUrl;
const INTERVAL_MS = simulatorConfig.intervalMs;
const API_STARTUP_ATTEMPTS = 30;
const API_RETRY_DELAY_MS = 2000;
const SENSOR_NOISE_FACTOR = 0.15;

function generateNormalReading(sensor: SensorDefinition): number {
  const midpoint = (sensor.normalMin + sensor.normalMax) / 2;
  const range = sensor.normalMax - sensor.normalMin;

  // Box-Muller transform for Gaussian distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  // Scale gaussian to ±15% of range around midpoint
  const value = midpoint + gaussian * range * SENSOR_NOISE_FACTOR;

  // Clamp to physical limits
  return Math.max(sensor.absoluteMin, Math.min(sensor.absoluteMax, Number(value.toFixed(2))));
}

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
      headers: ingestHeaders(),
      body: JSON.stringify({
        deviceId: device.id,
        readings,
      }),
    });

    if (!response.ok) {
      console.error(`❌ [${device.id}] HTTP ${response.status}: ${await response.text()}`);
      return;
    }

    const temperature = readings.find((reading) => reading.sensorType === 'temperature');
    const temperatureLabel = temperature ? ` | temp=${temperature.value}°C` : '';
    console.log(`📡 [${device.id}] Sent ${readings.length} readings${temperatureLabel}`);
  } catch (error) {
    console.error(
      `❌ [${device.id}] Failed:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  🏭 SensorGuard IoT Simulator');
  console.log(`  API: ${API_URL}`);
  console.log(`  Devices: ${DEVICES.length}`);
  console.log(`  Interval: ${INTERVAL_MS}ms`);
  console.log('═══════════════════════════════════════════════');

  await waitForApi();

  console.log('📡 Starting normal sensor data stream...\n');

  setInterval(async () => {
    await Promise.all(DEVICES.map(sendReadings));
  }, INTERVAL_MS);
}

async function waitForApi() {
  // Wait for API to be ready
  console.log('⏳ Waiting for API...');
  let retries = 0;
  while (retries < API_STARTUP_ATTEMPTS) {
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
    await new Promise((r) => setTimeout(r, API_RETRY_DELAY_MS));
  }

  if (retries >= API_STARTUP_ATTEMPTS) {
    console.error('❌ API not available after 60 seconds. Exiting.');
    process.exit(1);
  }
}

main();
