/**
 * SEED SCRIPT — Populates MongoDB with initial data.
 * 
 * Run this ONCE before starting the system:
 *   npm run seed (from root)
 * 
 * Creates:
 * 1. Device documents (5 devices)
 * 2. Threshold configurations for each sensor type
 */

import dns from 'node:dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // Ignore in case environment restricts custom DNS
}

dotenv.config({ path: '../../.env' });
dotenv.config({ path: '.env' });

// Import device definitions from simulator package
// (Shared data between simulator and API)
const DEVICES = [
  {
    _id: 'MOTOR-001',
    name: 'Main Drive Motor - Line A',
    type: 'motor',
    location: 'factory-floor-A',
    status: 'online',
    sensors: [
      { type: 'temperature', unit: 'celsius', min: 0, max: 150 },
      { type: 'vibration', unit: 'mm/s', min: 0, max: 50 },
      { type: 'rpm', unit: 'rpm', min: 0, max: 3000 },
    ],
    lastSeen: new Date(),
    installedAt: new Date('2026-01-15'),
    metadata: { manufacturer: 'Siemens', model: 'SIMOTICS GP 1LE0', serialNumber: 'SN-2026-001' },
  },
  {
    _id: 'MOTOR-002',
    name: 'Auxiliary Motor - Line A',
    type: 'motor',
    location: 'factory-floor-A',
    status: 'online',
    sensors: [
      { type: 'temperature', unit: 'celsius', min: 0, max: 150 },
      { type: 'vibration', unit: 'mm/s', min: 0, max: 50 },
      { type: 'rpm', unit: 'rpm', min: 0, max: 2000 },
    ],
    lastSeen: new Date(),
    installedAt: new Date('2026-02-20'),
    metadata: { manufacturer: 'ABB', model: 'M3BP 132', serialNumber: 'SN-2026-002' },
  },
  {
    _id: 'PUMP-001',
    name: 'Cooling Pump - Utility',
    type: 'pump',
    location: 'utility-room',
    status: 'online',
    sensors: [
      { type: 'temperature', unit: 'celsius', min: 0, max: 100 },
      { type: 'pressure', unit: 'psi', min: 0, max: 200 },
      { type: 'vibration', unit: 'mm/s', min: 0, max: 30 },
    ],
    lastSeen: new Date(),
    installedAt: new Date('2026-03-10'),
    metadata: { manufacturer: 'Grundfos', model: 'CR 32-2', serialNumber: 'SN-2026-003' },
  },
  {
    _id: 'COMP-001',
    name: 'Air Compressor - Line B',
    type: 'compressor',
    location: 'factory-floor-B',
    status: 'online',
    sensors: [
      { type: 'temperature', unit: 'celsius', min: 0, max: 150 },
      { type: 'pressure', unit: 'psi', min: 0, max: 200 },
      { type: 'vibration', unit: 'mm/s', min: 0, max: 50 },
    ],
    lastSeen: new Date(),
    installedAt: new Date('2026-04-05'),
    metadata: { manufacturer: 'Atlas Copco', model: 'GA 30+', serialNumber: 'SN-2026-004' },
  },
  {
    _id: 'CONV-001',
    name: 'Main Conveyor Belt - Line A',
    type: 'conveyor',
    location: 'factory-floor-A',
    status: 'online',
    sensors: [
      { type: 'temperature', unit: 'celsius', min: 0, max: 80 },
      { type: 'vibration', unit: 'mm/s', min: 0, max: 20 },
      { type: 'rpm', unit: 'rpm', min: 0, max: 120 },
    ],
    lastSeen: new Date(),
    installedAt: new Date('2026-05-01'),
    metadata: { manufacturer: 'Bosch Rexroth', model: 'VarioFlow plus', serialNumber: 'SN-2026-005' },
  },
];

const THRESHOLDS = [
  // Motor thresholds (applies to all motors via deviceId: "*")
  { deviceId: '*', deviceType: 'motor', sensorType: 'temperature', warning: { min: null, max: 80 }, critical: { min: null, max: 90 }, window: 60, consecutiveCount: 3, enabled: true },
  { deviceId: '*', deviceType: 'motor', sensorType: 'vibration', warning: { min: null, max: 7 }, critical: { min: null, max: 10 }, window: 60, consecutiveCount: 3, enabled: true },
  { deviceId: '*', deviceType: 'motor', sensorType: 'rpm', warning: { min: 800, max: 1600 }, critical: { min: 500, max: 1800 }, window: 60, consecutiveCount: 3, enabled: true },
  // Pump thresholds
  { deviceId: '*', deviceType: 'pump', sensorType: 'temperature', warning: { min: null, max: 65 }, critical: { min: null, max: 80 }, window: 60, consecutiveCount: 3, enabled: true },
  { deviceId: '*', deviceType: 'pump', sensorType: 'pressure', warning: { min: 30, max: 100 }, critical: { min: 20, max: 130 }, window: 60, consecutiveCount: 3, enabled: true },
  { deviceId: '*', deviceType: 'pump', sensorType: 'vibration', warning: { min: null, max: 5 }, critical: { min: null, max: 8 }, window: 60, consecutiveCount: 3, enabled: true },
  // Compressor thresholds
  { deviceId: '*', deviceType: 'compressor', sensorType: 'temperature', warning: { min: null, max: 95 }, critical: { min: null, max: 110 }, window: 60, consecutiveCount: 3, enabled: true },
  { deviceId: '*', deviceType: 'compressor', sensorType: 'pressure', warning: { min: 90, max: 140 }, critical: { min: 80, max: 160 }, window: 60, consecutiveCount: 3, enabled: true },
  // Conveyor thresholds
  { deviceId: '*', deviceType: 'conveyor', sensorType: 'temperature', warning: { min: null, max: 50 }, critical: { min: null, max: 65 }, window: 60, consecutiveCount: 3, enabled: true },
  { deviceId: '*', deviceType: 'conveyor', sensorType: 'vibration', warning: { min: null, max: 4 }, critical: { min: null, max: 7 }, window: 60, consecutiveCount: 3, enabled: true },

  // Specific override for MOTOR-001 (demo target — lower thresholds to trigger easier)
  { deviceId: 'MOTOR-001', deviceType: 'motor', sensorType: 'temperature', warning: { min: null, max: 80 }, critical: { min: null, max: 85 }, window: 60, consecutiveCount: 2, enabled: true },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'sensorguard';

  if (!uri) {
    console.error('❌ MONGODB_URI not set in .env');
    process.exit(1);
  }

  console.log('🌱 Seeding database...\n');

  await mongoose.connect(uri, { dbName });
  console.log('  ✅ Connected to MongoDB\n');

  const db = mongoose.connection.db!;

  // Seed devices
  const devicesCol = db.collection('devices');
  await devicesCol.deleteMany({});
  await devicesCol.insertMany(DEVICES);
  console.log(`  ✅ Seeded ${DEVICES.length} devices`);

  // Seed thresholds
  const thresholdsCol = db.collection('thresholds');
  await thresholdsCol.deleteMany({});
  await thresholdsCol.insertMany(
    THRESHOLDS.map((t) => ({ ...t, createdAt: new Date(), updatedAt: new Date() })),
  );
  console.log(`  ✅ Seeded ${THRESHOLDS.length} thresholds`);

  // Ensure Time Series collection exists
  const collections = await db.listCollections({ name: 'sensor_data' }).toArray();
  if (collections.length === 0) {
    await db.createCollection('sensor_data', {
      timeseries: {
        timeField: 'timestamp',
        metaField: 'metadata',
        granularity: 'seconds',
      },
      expireAfterSeconds: 604800,
    });
    console.log('  ✅ Created Time Series collection: sensor_data');
  } else {
    console.log('  ℹ️  Time Series collection sensor_data already exists');
  }

  // Clean old alerts and incidents
  await db.collection('alerts').deleteMany({});
  await db.collection('incidents').deleteMany({});
  console.log('  ✅ Cleared alerts and incidents');

  console.log('\n🎉 Seed complete!\n');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
