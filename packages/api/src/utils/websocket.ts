import type { WebSocket } from 'ws';
import { logger } from './logger';

export interface WSMessage<T = unknown> {
  event: 'telemetry' | 'alert' | 'incident' | 'device_status' | 'system';
  data: T;
  timestamp: string;
}

class WebSocketManager {
  private clients = new Set<WebSocket>();

  public addClient(socket: WebSocket): void {
    this.clients.add(socket);
    logger.info('WebSocket client connected', { totalClients: this.clients.size });

    // Send welcome handshake
    this.send(socket, {
      event: 'system',
      data: { message: 'SensorGuard Real-time Stream Connected', totalClients: this.clients.size },
      timestamp: new Date().toISOString(),
    });

    socket.on('close', () => {
      this.clients.delete(socket);
      logger.info('WebSocket client disconnected', { totalClients: this.clients.size });
    });

    socket.on('error', (err: Error) => {
      logger.warn('WebSocket client socket error', { error: err.message });
      this.clients.delete(socket);
    });
  }

  public removeClient(socket: WebSocket): void {
    this.clients.delete(socket);
  }

  public broadcast<T>(event: WSMessage<T>['event'], data: T): void {
    if (this.clients.size === 0) return;

    const message = JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.readyState === 1 /* OPEN */) {
        try {
          client.send(message);
        } catch (err) {
          this.clients.delete(client);
        }
      } else if (client.readyState > 1) {
        this.clients.delete(client);
      }
    }
  }

  private send<T>(socket: WebSocket, message: WSMessage<T>): void {
    if (socket.readyState === 1 /* OPEN */) {
      try {
        socket.send(JSON.stringify(message));
      } catch {
        this.clients.delete(socket);
      }
    }
  }

  public getClientCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WebSocketManager();
