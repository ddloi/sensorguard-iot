import winston from 'winston';

/**
 * Structured JSON logger.
 * 
 * In production (Docker), logs are collected by the Datadog Agent
 * via the container's stdout. Datadog auto-correlates logs with
 * APM traces when dd-trace is active (it injects trace_id/span_id).
 * 
 * Log format: JSON for machine parsing + pretty print in dev.
 */
const isProduction = process.env.NODE_ENV === 'production';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    // dd-trace injects these fields automatically when active:
    // dd.trace_id, dd.span_id, dd.service, dd.env, dd.version
    winston.format.json(),
  ),
  defaultMeta: {
    service: 'sensorguard-api',
  },
  transports: [
    new winston.transports.Console({
      format: isProduction
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
    }),
  ],
});
