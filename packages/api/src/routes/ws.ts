import { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { wsManager } from '../utils/websocket';

export async function websocketRoutes(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, (socket: WebSocket, _request) => {
    wsManager.addClient(socket);
  });
}
