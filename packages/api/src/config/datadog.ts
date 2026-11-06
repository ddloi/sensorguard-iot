import StatsD from 'hot-shots';
import { env } from './env';
import { logger } from '../utils/logger';

const statsd = new StatsD({
  host: process.env.DD_AGENT_HOST || 'localhost',
  port: 8125,
  prefix: 'sensorguard.',
  globalTags: [`env:${env.DD_ENV}`, `service:${env.DD_SERVICE}`],
  errorHandler: () => {
    // Non-fatal, fallback to HTTP API handles delivery
  },
});

interface MetricBufferItem {
  metric: string;
  type: 1 | 3;
  value: number;
  tags: string[];
  timestamp: number;
}

const METRICS_FLUSH_INTERVAL_MS = 5000;
const metricBuffer: MetricBufferItem[] = [];
const LOGS_ENDPOINT = `https://http-intake.logs.${env.DD_SITE}/api/v2/logs`;
const METRICS_ENDPOINT = `https://api.${env.DD_SITE}/api/v2/series`;

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
  } catch {
    // Silent fail in case of offline network
  }
}

// Flush every 5 seconds
setInterval(flushMetrics, METRICS_FLUSH_INTERVAL_MS);

function bufferMetric(metric: string, sample: Pick<MetricBufferItem, 'type' | 'value' | 'tags'>) {
  if (!env.DD_API_KEY) return;
  metricBuffer.push({ metric, ...sample, timestamp: Math.floor(Date.now() / 1000) });
}

export const datadogMetrics = {
  increment(metric: string, value: number = 1, tags: string[] = []) {
    statsd.increment(metric, value, tags);
    bufferMetric(metric, { type: 1, value, tags });
  },

  gauge(metric: string, value: number, tags: string[] = []) {
    statsd.gauge(metric, value, tags);
    bufferMetric(metric, { type: 3, value, tags });
  },

  histogram(metric: string, value: number, tags: string[] = []) {
    statsd.histogram(metric, value, tags);
    bufferMetric(metric, { type: 3, value, tags });
  },
};

export async function sendDatadogLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  attributes: Record<string, unknown> = {},
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
