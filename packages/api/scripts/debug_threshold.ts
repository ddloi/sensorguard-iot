import { connectDatabase } from '../src/config/database';
import { Threshold, Incident, Alert } from '../src/models';
import { getQueues, initQueues } from '../src/queues';

async function main() {
  await connectDatabase();
  initQueues();

  const deviceId = 'MOTOR-001';
  const readings = [
    { sensorType: 'temperature', value: 94.5, timestamp: new Date().toISOString(), unit: 'celsius', location: 'factory-floor-A' }
  ];

  const thresholds = await Threshold.find({
    deviceId: { $in: [deviceId, '*'] },
    enabled: true,
  }).lean();

  console.log('Thresholds matching count:', thresholds.length);
  for (const t of thresholds) {
    console.log(' - deviceId:', t.deviceId, 'sensorType:', t.sensorType, 'critical.max:', t.critical?.max);
  }

  for (const reading of readings) {
    const threshold =
      thresholds.find((t) => t.deviceId === deviceId && t.sensorType === reading.sensorType) ||
      thresholds.find((t) => t.deviceId === '*' && t.sensorType === reading.sensorType);

    console.log('Matched threshold:', threshold ? `critical max = ${threshold.critical.max}` : 'NONE');

    if (threshold && threshold.critical.max !== null && reading.value > threshold.critical.max) {
      console.log('✅ Threshold exceeded! Value:', reading.value, '>', threshold.critical.max);
    }
  }

  const { alertQueue } = getQueues();
  const testJob = await alertQueue.add('critical-alert', {
    deviceId: 'MOTOR-001',
    sensorType: 'temperature',
    value: 94.5,
    thresholdValue: 85,
    severity: 'critical',
    timestamp: new Date().toISOString(),
  });
  console.log('Dispatched test critical job:', testJob.id);

  // Wait 4s for running API worker to process it
  await new Promise((r) => setTimeout(r, 4000));

  const incidents = await Incident.find().lean();
  console.log('Incidents count after test:', incidents.length);
  if (incidents.length > 0) {
    console.log('Incident created:', JSON.stringify(incidents[0], null, 2));
  }

  process.exit(0);
}

main();
