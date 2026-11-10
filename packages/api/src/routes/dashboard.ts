import fs from 'node:fs';
import path from 'node:path';
import { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { logger } from '../utils/logger';

// src/routes and dist/routes share the same depth below packages/api.
export const DASHBOARD_DIST = path.resolve(__dirname, '../../../dashboard/dist');
const API_PREFIXES = ['/api', '/health', '/ws'];

/**
 * Hosted single-service mode: serve the built React dashboard from the API so the
 * browser keeps using relative /api and /ws URLs on the same origin.
 */
export async function registerDashboard(fastify: FastifyInstance) {
  if (!fs.existsSync(path.join(DASHBOARD_DIST, 'index.html'))) {
    logger.warn('SERVE_DASHBOARD=true but the dashboard is not built', { path: DASHBOARD_DIST });
    return;
  }

  await fastify.register(fastifyStatic, { root: DASHBOARD_DIST, wildcard: false });

  // Single-page app fallback: unknown GET paths outside the API return index.html.
  fastify.setNotFoundHandler((request, reply) => {
    const isApi = API_PREFIXES.some((prefix) => request.url.startsWith(prefix));
    if (request.method === 'GET' && !isApi) return reply.sendFile('index.html');
    return reply.status(404).send({ error: 'Not found' });
  });

  logger.info('Serving dashboard from the API', { path: DASHBOARD_DIST });
}
