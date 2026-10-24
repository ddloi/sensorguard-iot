import { FastifyInstance } from 'fastify';
import { Device } from '../models';

/**
 * DEVICE ROUTES — Dashboard reads device info from here.
 * 
 * GET /api/devices          → List all devices with status
 * GET /api/devices/:id      → Single device detail
 * PATCH /api/devices/:id    → Update device status (manual override)
 */
export async function deviceRoutes(fastify: FastifyInstance) {
  // List all devices
  fastify.get('/api/devices', async (_request, reply) => {
    const devices = await Device.find()
      .sort({ status: 1, _id: 1 })
      .lean();

    return reply.send({ devices, total: devices.length });
  });

  // Get single device
  fastify.get<{ Params: { id: string } }>(
    '/api/devices/:id',
    async (request, reply) => {
      const device = await Device.findById(request.params.id).lean();
      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }
      return reply.send(device);
    },
  );

  // Update device status (manual override from dashboard)
  fastify.patch<{ Params: { id: string }; Body: { status: string } }>(
    '/api/devices/:id',
    async (request, reply) => {
      const { status } = request.body;
      const validStatuses = ['online', 'warning', 'critical', 'offline', 'maintenance'];

      if (!validStatuses.includes(status)) {
        return reply.status(400).send({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      const device = await Device.findByIdAndUpdate(
        request.params.id,
        { $set: { status } },
        { new: true },
      );

      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      return reply.send(device);
    },
  );
}
