import { FastifyInstance } from 'fastify';
import { Incident } from '../models';

/**
 * INCIDENT ROUTES — Full incident lifecycle for dashboard.
 * 
 * GET /api/incidents        → List incidents
 * GET /api/incidents/:id    → Single incident with full timeline
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

  fastify.get<{ Params: { id: string } }>(
    '/api/incidents/:id',
    async (request, reply) => {
      const incident = await Incident.findById(request.params.id).lean();
      if (!incident) {
        return reply.status(404).send({ error: 'Incident not found' });
      }
      return reply.send(incident);
    },
  );
}
