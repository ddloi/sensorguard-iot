import { FastifyInstance } from 'fastify';
import { Incident } from '../models';
import { RecoveryRecheckError, requestRecoveryRecheck } from '../services/incident-recovery';

/**
 * INCIDENT ROUTES — Full incident lifecycle for dashboard.
 *
 * GET /api/incidents        → List incidents
 * GET /api/incidents/:id    → Single incident with full timeline
 * POST /api/incidents/:id/recheck → Retry bounded verification after escalation
 */
export async function incidentRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: { status?: string; limit?: string };
  }>('/api/incidents', async (request, reply) => {
    const { status, limit = '20' } = request.query;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const incidents = await Incident.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .lean();

    return reply.send({ incidents, total: incidents.length });
  });

  fastify.get<{ Params: { id: string } }>('/api/incidents/:id', async (request, reply) => {
    const incident = await Incident.findById(request.params.id).lean();
    if (!incident) {
      return reply.status(404).send({ error: 'Incident not found' });
    }
    return reply.send(incident);
  });

  fastify.post<{ Params: { id: string } }>('/api/incidents/:id/recheck', async (request, reply) => {
    const { id } = request.params;
    if (!/^[a-f\d]{24}$/i.test(id)) return reply.code(400).send({ error: 'Invalid incident ID' });
    try {
      return reply.code(202).send(await requestRecoveryRecheck(id));
    } catch (error) {
      if (!(error instanceof RecoveryRecheckError)) throw error;
      const statusCode =
        error.code === 'not_found' ? 404 : error.code === 'queue_unavailable' ? 503 : 409;
      return reply.code(statusCode).send({ error: error.message });
    }
  });
}
