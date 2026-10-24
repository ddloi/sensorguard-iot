import mongoose, { Schema, Document } from 'mongoose';

export interface IThreshold {
  deviceId: string; // "*" for all devices of a type
  deviceType: string;
  sensorType: string;
  warning: {
    min: number | null;
    max: number | null;
  };
  critical: {
    min: number | null;
    max: number | null;
  };
  window: number; // evaluation window in seconds
  consecutiveCount: number; // violations before alerting
  enabled: boolean;
  updatedAt: Date;
}

export interface IThresholdDocument extends IThreshold, Document {}

const thresholdSchema = new Schema<IThresholdDocument>(
  {
    deviceId: { type: String, required: true },
    deviceType: { type: String, required: true },
    sensorType: { type: String, required: true },
    warning: {
      min: { type: Number, default: null },
      max: { type: Number, default: null },
    },
    critical: {
      min: { type: Number, default: null },
      max: { type: Number, default: null },
    },
    window: { type: Number, default: 60 },
    consecutiveCount: { type: Number, default: 3 },
    enabled: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

// Lookup thresholds for a specific device + sensor type
thresholdSchema.index({ deviceId: 1, sensorType: 1 }, { unique: true });

export const Threshold = mongoose.model<IThresholdDocument>(
  'Threshold',
  thresholdSchema,
  'thresholds',
);
