import mongoose, { Schema, Document } from 'mongoose';

export interface IAlert {
  deviceId: string;
  sensorType: string;
  severity: 'warning' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  triggerValue: number;
  thresholdValue: number;
  message: string;
  createdAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  metadata: {
    movingAverage5m: number | null;
    trend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
    correlatedAlerts: mongoose.Types.ObjectId[];
  };
}

export interface IAlertDocument extends IAlert, Document {}

const alertSchema = new Schema<IAlertDocument>(
  {
    deviceId: { type: String, required: true, index: true },
    sensorType: { type: String, required: true },
    severity: {
      type: String,
      required: true,
      enum: ['warning', 'critical'],
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'acknowledged', 'resolved'],
      default: 'active',
    },
    triggerValue: { type: Number, required: true },
    thresholdValue: { type: Number, required: true },
    message: { type: String, required: true },
    acknowledgedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: null },
    metadata: {
      movingAverage5m: { type: Number, default: null },
      trend: {
        type: String,
        enum: ['increasing', 'decreasing', 'stable', 'unknown'],
        default: 'unknown',
      },
      correlatedAlerts: [{ type: Schema.Types.ObjectId }],
    },
  },
  {
    timestamps: true,
  },
);

// Compound index: get active alerts per device efficiently
alertSchema.index({ deviceId: 1, status: 1, createdAt: -1 });
// For dashboard: recent alerts sorted by time
alertSchema.index({ status: 1, createdAt: -1 });

export const Alert = mongoose.model<IAlertDocument>('Alert', alertSchema, 'alerts');
