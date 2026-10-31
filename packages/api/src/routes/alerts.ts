import { FastifyInstance } from 'fastify';
import { Alert } from '../models';

/**
 * ALERT ROUTES — Dashboard reads alerts from here.
 *
 * GET /api/alerts            → List alerts (filterable)
 * PATCH /api/alerts/:id/ack  → Acknowledge an alert
 */
export async function alertRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: {
      status?: string;
      severity?: string;
      deviceId?: string;
      limit?: string;
    };
  }>('/api/alerts', async (request, reply) => {
    const { status, severity, deviceId, limit = '50' } = request.query;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (deviceId) filter.deviceId = deviceId;

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .lean();

    return reply.send({ alerts, total: alerts.length });
  });

  // Acknowledge an alert
  fastify.patch<{ Params: { id: string } }>('/api/alerts/:id/ack', async (request, reply) => {
    const alert = await Alert.findByIdAndUpdate(
      request.params.id,
      {
        $set: {
          status: 'acknowledged',
          acknowledgedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!alert) {
      return reply.status(404).send({ error: 'Alert not found' });
    }

    return reply.send(alert);
  });
}
