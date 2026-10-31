import mongoose, { Schema, Document } from 'mongoose';

export interface IDevice {
  _id: string; // deviceId serves as _id (e.g., "MOTOR-001")
  name: string;
  type: 'motor' | 'pump' | 'compressor' | 'conveyor';
  location: string;
  status: 'online' | 'warning' | 'critical' | 'offline' | 'maintenance';
  sensors: Array<{
    type: 'temperature' | 'vibration' | 'pressure' | 'rpm';
    unit: string;
    min: number;
    max: number;
  }>;
  lastSeen: Date;
  installedAt: Date;
  metadata: {
    manufacturer: string;
    model: string;
    serialNumber: string;
  };
}

export type IDeviceDocument = mongoose.HydratedDocument<IDevice>;

const deviceSchema = new Schema(
  {
    _id: { type: String, required: true }, // deviceId as _id
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['motor', 'pump', 'compressor', 'conveyor'],
    },
    location: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['online', 'warning', 'critical', 'offline', 'maintenance'],
      default: 'online',
    },
    sensors: [
      {
        type: { type: String, required: true },
        unit: { type: String, required: true },
        min: { type: Number, required: true },
        max: { type: Number, required: true },
      },
    ],
    lastSeen: { type: Date, default: Date.now },
    installedAt: { type: Date, required: true },
    metadata: {
      manufacturer: { type: String, required: true },
      model: { type: String, required: true },
      serialNumber: { type: String, required: true },
    },
  },
  {
    timestamps: true,
  },
);

// Index for status queries (dashboard filtering)
deviceSchema.index({ status: 1 });
deviceSchema.index({ location: 1 });

export const Device = mongoose.model<IDeviceDocument>('Device', deviceSchema, 'devices');
