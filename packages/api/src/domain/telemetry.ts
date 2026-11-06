import { z } from 'zod';

export const ingestSchema = z.object({
  deviceId: z.string().min(1),
  readings: z
    .array(
      z.object({
        sensorType: z.enum(['temperature', 'vibration', 'pressure', 'rpm']),
        value: z.number(),
        unit: z.string(),
        quality: z.enum(['good', 'degraded', 'bad', 'unknown']).default('good'),
      }),
    )
    .min(1),
});

export type IngestPayload = z.infer<typeof ingestSchema>;
