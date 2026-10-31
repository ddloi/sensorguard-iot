export interface SensorValue {
  type: string;
  last: number;
  lastReading?: string;
}
export interface Device {
  deviceId: string;
  name: string;
  status: string;
  location: string;
  type: string;
  sensors: SensorValue[];
  lastSeen?: string;
}
export interface IncidentEvent {
  timestamp: string;
  event: string;
  details: string;
}
export interface Incident {
  _id: string;
  title: string;
  status: string;
  severity: string;
  deviceId: string;
  timeline: IncidentEvent[];
  rootCause: string | null;
  resolution: string | null;
  duration: number | null;
  createdAt: string;
}
export interface TimeSeriesPoint {
  timestamp: string;
  latest: number;
  movingAvg: number;
}
export interface Health {
  status: string;
  mongodb: string;
  redis: string;
  uptime: number;
  datadog: string;
}
export type Theme = 'light' | 'dark';
export type View = 'fleet' | 'incidents' | 'architecture';
export type DashboardErrors = Partial<Record<'fleet' | 'incidents' | 'series' | 'health', string>>;
export interface Feedback {
  text: string;
  error?: boolean;
}
export interface LatestEvent extends IncidentEvent {
  deviceId: string;
}
