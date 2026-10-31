import mongoose, { Schema, Document } from 'mongoose';

/**
 * Sensor Data — stored in a MongoDB Time Series Collection.
 *
 * Time Series Collections are optimized for:
 * - Write-heavy IoT workloads (columnar storage)
 * - Efficient time-range queries
 * - Automatic bucketing by timeField + metaField
 * - Built-in TTL via expireAfterSeconds
 *
 * Note: We don't use Mongoose's schema validation heavily here
 * because Time Series Collections have restrictions on certain
 * operations. The schema is mainly for TypeScript type safety.
 */

export interface ISensorData {
  timestamp: Date;
  metadata: {
    deviceId: string;
    sensorType: 'temperature' | 'vibration' | 'pressure' | 'rpm';
    location: string;
    unit: string;
  };
  value: number;
  quality: 'good' | 'degraded' | 'bad' | 'unknown';
}

export interface ISensorDataDocument extends ISensorData, Document {}

const sensorDataSchema = new Schema<ISensorDataDocument>(
  {
    timestamp: { type: Date, required: true },
    metadata: {
      deviceId: { type: String, required: true, index: true },
      sensorType: {
        type: String,
        required: true,
        enum: ['temperature', 'vibration', 'pressure', 'rpm'],
      },
      location: { type: String, required: true },
      unit: { type: String, required: true },
    },
    value: { type: Number, required: true },
    quality: {
      type: String,
      enum: ['good', 'degraded', 'bad', 'unknown'],
      default: 'good',
    },
  },
  {
    // Time Series Collection config — passed to MongoDB createCollection
    timeseries: {
      timeField: 'timestamp',
      metaField: 'metadata',
      granularity: 'seconds',
    },
    expireAfterSeconds: 604800, // Auto-delete after 7 days
    // Disable Mongoose features not supported by Time Series
    autoCreate: true,
    autoIndex: true,
  },
);

export const SensorData = mongoose.model<ISensorDataDocument>(
  'SensorData',
  sensorDataSchema,
  'sensor_data', // Explicit collection name
);
