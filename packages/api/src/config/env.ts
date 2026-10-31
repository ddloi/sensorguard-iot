import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';

// src/config and dist/config share the same depth below the repository root.
// Environment loading must not depend on the shell's working directory.
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  // MongoDB
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().default('sensorguard'),

  // Upstash Redis
  UPSTASH_REDIS_URL: z.string().min(1, 'UPSTASH_REDIS_URL is required'),
  UPSTASH_REDIS_TOKEN: z.string().optional(),

  // Datadog
  DD_API_KEY: z.string().optional(),
  DD_SITE: z.string().default('datadoghq.com'),
  DD_SERVICE: z.string().default('sensorguard'),
  DD_ENV: z.string().default('development'),

  // API
  API_PORT: z.string().default('3001').transform(Number),
  API_HOST: z.string().default('0.0.0.0'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    for (const issue of parsed.error.issues) {
      console.error(`   ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
