import path from 'node:path';
import dotenv from 'dotenv';

// src/ and dist/ have the same depth, so commands work from any current folder.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const simulatorConfig = {
  apiUrl: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001',
  intervalMs: 5_000,
  deviceKey: process.env.DEVICE_API_KEY || undefined,
};

/** Headers for POST /api/ingest; includes the device key when DEVICE_API_KEY is set. */
export function ingestHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (simulatorConfig.deviceKey) headers['x-device-key'] = simulatorConfig.deviceKey;
  return headers;
}
