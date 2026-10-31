/**
 * ENTRY POINT — SensorGuard API
 *
 * ⚠️ CRITICAL: dd-trace MUST be imported BEFORE all other modules.
 * It monkey-patches Node.js HTTP, MongoDB driver, IORedis, etc.
 * to automatically create APM traces and distributed tracing spans.
 *
 * If dd-trace is imported after other modules, those modules
 * won't be instrumented and you'll get no traces in Datadog.
 */

// --- dd-trace FIRST (before any other import) ---
import tracer from 'dd-trace';

tracer.init({
  service: process.env.DD_SERVICE || 'sensorguard',
  env: process.env.DD_ENV || 'development',
  logInjection: true, // Auto-inject trace_id into Winston logs
  runtimeMetrics: true, // Node.js runtime metrics (GC, event loop, etc.)
  profiling: true,
});

// --- Now import everything else ---
import { startServer } from './server';

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
