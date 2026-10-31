import mongoose, { Schema, Document } from 'mongoose';

export interface IIncidentEvent {
  timestamp: Date;
  event:
    | 'anomaly_detected'
    | 'alert_triggered'
    | 'investigation_started'
    | 'remediation_triggered'
    | 'recovery_confirmed'
    | 'resolved'
    | 'escalated';
  details: string;
  alertId?: mongoose.Types.ObjectId;
}

export interface IIncident {
  title: string;
  status: 'open' | 'investigating' | 'mitigating' | 'resolved';
  severity: 'warning' | 'critical';
  deviceId: string;
  timeline: IIncidentEvent[];
  rootCause: string | null;
  resolution: string | null;
  duration: number | null; // seconds
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface IIncidentDocument extends IIncident, Document {}

const incidentEventSchema = new Schema<IIncidentEvent>(
  {
    timestamp: { type: Date, required: true, default: Date.now },
    event: {
      type: String,
      required: true,
      enum: [
        'anomaly_detected',
        'alert_triggered',
        'investigation_started',
        'remediation_triggered',
        'recovery_confirmed',
        'resolved',
        'escalated',
      ],
    },
    details: { type: String, required: true },
    alertId: { type: Schema.Types.ObjectId, default: null },
  },
  { _id: false },
);

const incidentSchema = new Schema<IIncidentDocument>(
  {
    title: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['open', 'investigating', 'mitigating', 'resolved'],
      default: 'open',
    },
    severity: {
      type: String,
      required: true,
      enum: ['warning', 'critical'],
    },
    deviceId: { type: String, required: true, index: true },
    timeline: [incidentEventSchema],
    rootCause: { type: String, default: null },
    resolution: { type: String, default: null },
    duration: { type: Number, default: null },
    resolvedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

// For dashboard: open incidents first, then by recency
incidentSchema.index({ status: 1, createdAt: -1 });

export const Incident = mongoose.model<IIncidentDocument>('Incident', incidentSchema, 'incidents');
