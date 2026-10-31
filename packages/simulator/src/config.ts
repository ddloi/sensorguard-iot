import path from 'node:path';
import dotenv from 'dotenv';

// src/ and dist/ have the same depth, so commands work from any current folder.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const simulatorConfig = {
  apiUrl: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001',
  intervalMs: 5_000,
};
