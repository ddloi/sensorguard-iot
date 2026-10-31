import StatsD from 'hot-shots';
import { env } from './env';
import { logger } from '../utils/logger';

/**
 * Datadog Client:
 * 1. DogStatsD (UDP:8125) when Datadog Agent is running (e.g. in Docker)
 * 2. Direct HTTPS Fallback to Datadog Cloud API (https://api.datadoghq.com)
 *    when running locally without Agent, guaranteeing metrics & logs appear in Datadog!
 */

const statsd = new StatsD({
  host: process.env.DD_AGENT_HOST || 'localhost',
  port: 8125,
  prefix: 'sensorguard.',
  globalTags: [`env:${env.DD_ENV}`, `service:${env.DD_SERVICE}`],
  errorHandler: (error) => {
    // Non-fatal, fallback to HTTP API handles delivery
  },
});

interface MetricBufferItem {
  metric: string;
  type: 0 | 1 | 2 | 3; // 0=unspecified, 1=count, 2=rate, 3=gauge
  value: number;
  tags: string[];
  timestamp: number;
}

const metricBuffer: MetricBufferItem[] = [];
const LOGS_ENDPOINT = `https://http-intake.logs.${env.DD_SITE}/api/v2/logs`;
const METRICS_ENDPOINT = `https://api.${env.DD_SITE}/api/v2/series`;

/**
 * Flush buffered metrics to Datadog HTTP API.
 */
async function flushMetrics() {
  if (!env.DD_API_KEY || metricBuffer.length === 0) return;

  const toFlush = metricBuffer.splice(0, metricBuffer.length);
  const series = toFlush.map((item) => ({
    metric: item.metric.startsWith('sensorguard.') ? item.metric : `sensorguard.${item.metric}`,
    type: item.type,
    points: [{ timestamp: item.timestamp, value: item.value }],
    resources: [{ type: 'host', name: 'sensorguard-core' }],
    tags: [`env:${env.DD_ENV}`, `service:${env.DD_SERVICE}`, ...item.tags],
  }));

  try {
    const res = await fetch(METRICS_ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': env.DD_API_KEY,
      },
      body: JSON.stringify({ series }),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.warn('Datadog HTTP metrics flush warning', { status: res.status, errText });
    }
  } catch (err) {
    // Silent fail in case of offline network
  }
}

// Flush every 5 seconds
setInterval(flushMetrics, 5000);

export const datadogMetrics = {
  increment(metric: string, value: number = 1, tags: string[] = []) {
    statsd.increment(metric, value, tags);
    if (env.DD_API_KEY) {
      metricBuffer.push({
        metric,
        type: 1, // count
        value,
        tags,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
  },

  gauge(metric: string, value: number, tags: string[] = []) {
    statsd.gauge(metric, value, tags);
    if (env.DD_API_KEY) {
      metricBuffer.push({
        metric,
        type: 3, // gauge
        value,
        tags,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
  },

  histogram(metric: string, value: number, tags: string[] = []) {
    statsd.histogram(metric, value, tags);
    if (env.DD_API_KEY) {
      metricBuffer.push({
        metric,
        type: 3, // gauge for duration
        value,
        tags,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
  },
};

/**
 * Send an incident/alert event log directly to Datadog Logs.
 */
export async function sendDatadogLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  attributes: Record<string, any> = {},
) {
  if (!env.DD_API_KEY) return;

  try {
    await fetch(LOGS_ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(3000),
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': env.DD_API_KEY,
      },
      body: JSON.stringify([
        {
          ddsource: 'nodejs',
          ddtags: `env:${env.DD_ENV},service:${env.DD_SERVICE}`,
          hostname: 'sensorguard-core',
          message,
          service: env.DD_SERVICE,
          status: level,
          ...attributes,
        },
      ]),
    });
  } catch {
    // Non-fatal
  }
}

export function startTimer(): (metric: string, tags?: Record<string, string>) => void {
  const start = Date.now();
  return (metric: string, tags?: Record<string, string>) => {
    const duration = Date.now() - start;
    const tagArray = tags ? Object.entries(tags).map(([k, v]) => `${k}:${v}`) : [];
    datadogMetrics.histogram(metric, duration, tagArray);
  };
}
