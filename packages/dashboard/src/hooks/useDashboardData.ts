import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchDevices, fetchHealth, fetchIncidents, fetchTemperatureSeries } from '../api/client';
import type { DashboardErrors, Device, Health, Incident, TimeSeriesPoint } from '../types/domain';
import { getDeviceStatus } from '../utils/devices';
import { sensorInfo } from '../utils/sensors';

/** Owns remote state, refresh cancellation, polling and the WebSocket lifetime. */
export function useDashboardData() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('MOTOR-001');
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [errors, setErrors] = useState<DashboardErrors>({});
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const request = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      request.current?.abort();
    };
  }, []);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort('timeout'), 10_000);
    setIsRefreshing(true);
    pending.current = true;
    const [fleet, events, series, status] = await Promise.allSettled([
      fetchDevices(controller.signal),
      fetchIncidents(controller.signal),
      fetchTemperatureSeries(selectedDevice, controller.signal),
      fetchHealth(controller.signal),
    ]);
    clearTimeout(timeout);
    if (!mounted.current || request.current !== controller) return;
    // A replaced request must never populate the newly selected device's chart.
    if (controller.signal.aborted && controller.signal.reason !== 'timeout') return;
    const nextErrors: DashboardErrors = {};
    if (fleet.status === 'fulfilled') {
      const sensorOrder = Object.keys(sensorInfo);
      setDevices(
        fleet.value.map((device) => ({
          ...device,
          sensors: [...device.sensors].sort(
            (a, b) => sensorOrder.indexOf(a.type) - sensorOrder.indexOf(b.type),
          ),
        })),
      );
      setLastRefreshed(Date.now());
    } else nextErrors.fleet = 'Không tải được danh sách thiết bị. Kiểm tra API và kết nối MongoDB.';
    if (events.status === 'fulfilled') setIncidents(events.value);
    else nextErrors.incidents = 'Không tải được nhật ký sự cố. Dữ liệu trước đó có thể đã cũ.';
    if (series.status === 'fulfilled') setTimeSeries(series.value);
    else nextErrors.series = 'Không tải được biểu đồ nhiệt độ. Thử làm mới sau ít giây.';
    if (status.status === 'fulfilled') setHealth(status.value);
    else {
      setHealth(null);
      nextErrors.health = 'Không kiểm tra được tình trạng dịch vụ.';
    }
    setErrors(nextErrors);
    setLoaded(true);
    setIsRefreshing(false);
    pending.current = false;
  }, [selectedDevice]);

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    setTimeSeries([]);
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden && !pending.current) void refresh();
    }, 5000);
    return () => {
      clearInterval(timer);
      request.current?.abort();
    };
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
        if (!disposed) setWsConnected(true);
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
          setWsConnected(false);
          timer = setTimeout(connect, 4000);
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
  }, []);

  const activeIncidents = incidents.filter((incident) => incident.status !== 'resolved');
  const resolvedIncidents = incidents.filter((incident) => incident.status === 'resolved');
  const stale = lastRefreshed !== null && now - lastRefreshed > 15_000;
  const ready =
    health?.status === 'ok' &&
    !stale &&
    !errors.fleet &&
    !errors.incidents &&
    devices.some(
      (device) => device.deviceId === 'MOTOR-001' && getDeviceStatus(device, now) !== 'offline',
    );
  const newestEvent = useMemo(
    () =>
      incidents
        .flatMap((incident) =>
          incident.timeline.map((event) => ({ ...event, deviceId: incident.deviceId })),
        )
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0],
    [incidents],
  );

  return {
    devices,
    incidents,
    selectedDevice,
    setSelectedDevice,
    timeSeries,
    health,
    errors,
    lastRefreshed,
    loaded,
    isRefreshing,
    wsConnected,
    now,
    refresh,
    stale,
    ready,
    selected: devices.find((device) => device.deviceId === selectedDevice),
    activeIncidents,
    resolvedIncidents,
    newestEvent,
  };
}
