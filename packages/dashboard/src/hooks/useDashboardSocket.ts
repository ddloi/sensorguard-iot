import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Device } from '../types/domain';

const RECONNECT_DELAY_MS = 4000;

export function useDashboardSocket(
  setDevices: Dispatch<SetStateAction<Device[]>>,
  refresh: () => Promise<void>,
) {
  const [isConnected, setIsConnected] = useState(false);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`,
      );
      socket.onopen = () => {
        if (!disposed) setIsConnected(true);
      };
      socket.onmessage = (event) => {
        if (disposed) return;
        try {
          const message = JSON.parse(event.data);
          if (message.event === 'device_status')
            setDevices((previous) =>
              previous.map((device) =>
                device.deviceId === message.data.deviceId
                  ? { ...device, status: message.data.status }
                  : device,
              ),
            );
          if (['incident', 'alert'].includes(message.event)) void refreshRef.current();
        } catch {
          /* Malformed events do not prevent API polling. */
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (!disposed) {
          setIsConnected(false);
          timer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      if (socket) {
        socket.onclose = null;
        socket.onmessage = null;
        socket.close();
      }
    };
  }, [setDevices]);

  return isConnected;
}
