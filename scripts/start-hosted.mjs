// Hosted single-service start (Render): API + workers + built dashboard + simulator.
// Uses the platform PORT; exits when either process stops so the platform restarts the service.
import { spawn } from 'node:child_process';

const port = process.env.PORT || process.env.API_PORT || '3001';
const env = {
  ...process.env,
  API_PORT: port,
  API_HOST: process.env.API_HOST || '0.0.0.0',
  SERVE_DASHBOARD: process.env.SERVE_DASHBOARD || 'true',
  API_URL: `http://127.0.0.1:${port}`,
};

const children = [
  ['api', ['packages/api/dist/index.js']],
  ['simulator', ['packages/simulator/dist/index.js']],
].map(([name, args]) => {
  const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    console.error(
      `[start-hosted] ${name} exited (code ${code}, signal ${signal}); stopping service`,
    );
    for (const other of children)
      if (other !== child && other.exitCode === null) other.kill('SIGTERM');
    process.exit(code ?? 1);
  });
  return child;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of children) if (child.exitCode === null) child.kill(signal);
  });
}
