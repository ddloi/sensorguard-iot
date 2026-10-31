import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * BullMQ Queue Registry.
 *
 * All queues share the same Upstash Redis connection.
 * Each queue handles a specific concern in the sensor pipeline:
 *
 * 1. threshold-check: Compare sensor readings against configured thresholds
 * 2. alert-process:   Create alerts and send metrics to Datadog
 * 3. remediation:     Auto-fix actions (reduce speed, cooling, etc.)
 * 4. device-health:   Periodic check for offline devices (no data)
 */

let thresholdQueue: Queue;
let alertQueue: Queue;
let remediationQueue: Queue;
let deviceHealthQueue: Queue;

export function initQueues() {
  const connection = getRedisConnection();

  thresholdQueue = new Queue('threshold-check', { connection });
  alertQueue = new Queue('alert-process', { connection });
  remediationQueue = new Queue('remediation', { connection });
  deviceHealthQueue = new Queue('device-health', { connection });

  logger.info('✅ BullMQ queues initialized', {
    queues: ['threshold-check', 'alert-process', 'remediation', 'device-health'],
  });

  return { thresholdQueue, alertQueue, remediationQueue, deviceHealthQueue };
}

export function getQueues() {
  return { thresholdQueue, alertQueue, remediationQueue, deviceHealthQueue };
}
