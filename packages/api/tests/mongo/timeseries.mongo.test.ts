/**
 * Real MongoDB checks (no mocks). Runs only when MONGODB_TEST_URI points at a MongoDB 5+
 * server, for example the mongo:7 service in CI. Each run uses a throwaway database.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const uri = process.env.MONGODB_TEST_URI;
process.env.MONGODB_URI ||= uri || 'mongodb://unused';
process.env.UPSTASH_REDIS_URL ||= 'redis://unused:6379';

describe.skipIf(!uri)('MongoDB integration (real server)', () => {
  const dbName = `sensorguard_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  let mongoose: typeof import('mongoose').default;
  let models: typeof import('../../src/models');
  let buildTimeSeriesPipeline: typeof import('../../src/routes/analytics').buildTimeSeriesPipeline;
  let selectThreshold: typeof import('../../src/domain/threshold').selectThreshold;
  let isRecoveryConfirmed: typeof import('../../src/domain/recovery').isRecoveryConfirmed;

  beforeAll(async () => {
    // Same resolver workaround as src/config/database.ts for Atlas SRV lookups.
    if (uri!.startsWith('mongodb+srv://'))
      (await import('node:dns')).setServers(['8.8.8.8', '8.8.4.4']);
    mongoose = (await import('mongoose')).default;
    await mongoose.connect(uri!, { dbName, serverSelectionTimeoutMS: 15_000 });
    models = await import('../../src/models');
    ({ buildTimeSeriesPipeline } = await import('../../src/routes/analytics'));
    ({ selectThreshold } = await import('../../src/domain/threshold'));
    ({ isRecoveryConfirmed } = await import('../../src/domain/recovery'));
    await models.SensorData.createCollection();
    await models.Threshold.init();
  }, 30_000);

  afterAll(async () => {
    if (mongoose?.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  it('creates sensor_data as a time series collection', async () => {
    const [info] = await mongoose.connection.db!.listCollections({ name: 'sensor_data' }).toArray();
    expect(info.type).toBe('timeseries');
    expect(
      (info.options as { timeseries: { timeField: string; metaField: string } }).timeseries,
    ).toMatchObject({
      timeField: 'timestamp',
      metaField: 'metadata',
    });
  });

  it('aggregates buckets and a 5-minute moving average with $setWindowFields', async () => {
    const now = Date.now();
    const values = [60, 62, 64, 66, 68, 70];
    await models.SensorData.insertMany(
      values.map((value, i) => ({
        timestamp: new Date(now - (values.length - i) * 20_000),
        metadata: {
          deviceId: 'TEST-1',
          sensorType: 'temperature',
          location: 'lab',
          unit: 'celsius',
        },
        value,
        quality: 'good',
      })),
    );
    const rows = await models.SensorData.aggregate(
      buildTimeSeriesPipeline({
        deviceId: 'TEST-1',
        sensorType: 'temperature',
        minutes: '10',
        bucketSeconds: '60',
      }),
    );
    expect(rows.reduce((sum: number, r: { count: number }) => sum + r.count, 0)).toBe(
      values.length,
    );
    const last = rows[rows.length - 1] as { movingAvg: number; max: number };
    expect(last.movingAvg).toBeCloseTo(65, 1); // all six samples fall inside the 5-minute window
    expect(Math.max(...rows.map((r: { max: number }) => r.max))).toBe(70);
  });

  it('returns the newest reading as recovery evidence and applies the safety rule', async () => {
    const incidentStart = new Date(Date.now() - 60_000);
    await models.SensorData.insertMany([
      {
        timestamp: new Date(Date.now() - 50_000),
        metadata: {
          deviceId: 'TEST-2',
          sensorType: 'temperature',
          location: 'lab',
          unit: 'celsius',
        },
        value: 92.4,
      },
      {
        timestamp: new Date(Date.now() - 5_000),
        metadata: {
          deviceId: 'TEST-2',
          sensorType: 'temperature',
          location: 'lab',
          unit: 'celsius',
        },
        value: 61.0,
      },
    ]);
    const newest = await models.SensorData.findOne({
      'metadata.deviceId': 'TEST-2',
      'metadata.sensorType': 'temperature',
    })
      .sort({ timestamp: -1 })
      .lean();
    expect(newest?.value).toBe(61);
    const rule = { warning: { min: null, max: 80 }, critical: { min: null, max: 85 } };
    expect(isRecoveryConfirmed(newest, rule, incidentStart)).toBe(true);
    expect(isRecoveryConfirmed({ timestamp: new Date(), value: 86 }, rule, incidentStart)).toBe(
      false,
    );
  });

  it('enforces one rule per device, type and sensor, and prefers the device override', async () => {
    const base = {
      deviceType: 'motor',
      sensorType: 'temperature',
      warning: { min: null, max: 80 },
    };
    await models.Threshold.create([
      { ...base, deviceId: '*', critical: { min: null, max: 90 } },
      { ...base, deviceId: 'MOTOR-T', critical: { min: null, max: 85 } },
    ]);
    await expect(
      models.Threshold.create({ ...base, deviceId: 'MOTOR-T', critical: { min: null, max: 70 } }),
    ).rejects.toMatchObject({ code: 11000 });
    const rules = await models.Threshold.find({
      $or: [{ deviceId: 'MOTOR-T' }, { deviceId: '*', deviceType: 'motor' }],
      enabled: true,
    }).lean();
    expect(selectThreshold(rules, 'MOTOR-T', 'motor', 'temperature')?.critical.max).toBe(85);
    expect(selectThreshold(rules, 'MOTOR-OTHER', 'motor', 'temperature')?.critical.max).toBe(90);
  });
});
