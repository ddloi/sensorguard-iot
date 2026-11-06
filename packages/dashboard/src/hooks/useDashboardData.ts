import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchDevices, fetchHealth, fetchIncidents, fetchTemperatureSeries } from '../api/client';
import type { DashboardErrors, Device, Health, Incident, TimeSeriesPoint } from '../types/domain';
import { getDeviceStatus } from '../utils/devices';
import { sensorInfo } from '../utils/sensors';
import { useDashboardSocket } from './useDashboardSocket';

const SENSOR_ORDER = Object.keys(sensorInfo);
const REFRESH_TIMEOUT_MS = 10_000;
const REFRESH_INTERVAL_MS = 5000;
const STALE_AFTER_MS = 15_000;

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
    const timeout = setTimeout(() => controller.abort('timeout'), REFRESH_TIMEOUT_MS);
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
      setDevices(
        fleet.value.map((device) => ({
          ...device,
          sensors: [...device.sensors].sort(
            (a, b) => SENSOR_ORDER.indexOf(a.type) - SENSOR_ORDER.indexOf(b.type),
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

  useEffect(() => {
    setTimeSeries([]);
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden && !pending.current) void refresh();
    }, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      request.current?.abort();
    };
  }, [refresh]);

  const wsConnected = useDashboardSocket(setDevices, refresh);

  const activeIncidents = incidents.filter((incident) => incident.status !== 'resolved');
  const resolvedIncidents = incidents.filter((incident) => incident.status === 'resolved');
  const stale = lastRefreshed !== null && now - lastRefreshed > STALE_AFTER_MS;
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
