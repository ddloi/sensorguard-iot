import type { WorkerOptions } from 'bullmq';

/**
 * Shared worker tuning.
 *
 * Upstash bills every Redis call made inside BullMQ's Lua scripts, so an idle worker that
 * wakes every 5 seconds (BullMQ default) costs hundreds of commands per minute.
 * - drainDelay: seconds an idle worker blocks waiting for a job. New jobs still wake it
 *   immediately, and delayed jobs shorten the wait to their due time.
 * - stalledInterval: how often a worker checks for jobs abandoned by a crashed process.
 */
export const WORKER_TUNING: Pick<WorkerOptions, 'drainDelay' | 'stalledInterval'> = {
  drainDelay: 60,
  stalledInterval: 120_000,
};
