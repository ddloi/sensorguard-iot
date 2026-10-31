import type { DashboardErrors, Device, Health } from '../types/domain';
import { Badge } from './StatusBadge';
import { getDeviceStatus } from '../utils/devices';

import { sensorInfo } from '../utils/sensors';

interface DeviceSidebarProps {
  devices: Device[];
  loaded: boolean;
  errors: DashboardErrors;
  selectedDevice: string;
  health: Health | null;
  now: number;
  onSelectDevice: (id: string) => void;
}

export function DeviceSidebar({
  devices,
  loaded,
  errors,
  selectedDevice,
  health,
  now,
  onSelectDevice,
}: DeviceSidebarProps) {
  const deviceStatus = (device: Device) => getDeviceStatus(device, now);
  const serviceRows = [
    { name: 'Fastify API', state: health ? 'Phản hồi' : 'Chưa kết nối', ok: !!health },
    {
      name: 'MongoDB Atlas',
      state: health?.mongodb === 'connected' ? 'Đã kết nối' : 'Chưa kết nối',
      ok: health?.mongodb === 'connected',
    },
    {
      name: 'Redis / BullMQ',
      state: health?.redis === 'connected' ? 'Đã kết nối' : 'Chưa kết nối',
      ok: health?.redis === 'connected',
    },
    {
      name: 'Datadog',
      state: health?.datadog === 'configured' ? 'Đã cấu hình' : 'Chưa cấu hình',
      ok: false,
    },
  ];
  return (
    <aside className="ops-sidebar" aria-label="Danh sách thiết bị">
      <div className="sidebar__section-label">
        Thiết bị <span className="mono">{loaded ? devices.length : '—'}</span>
      </div>
      {!loaded ? (
        <div className="skeleton" aria-label="Đang tải thiết bị" />
      ) : devices.length === 0 ? (
        <p className="empty-state">
          {errors.fleet
            ? 'Không tải được thiết bị.'
            : 'Chưa có thiết bị. Nạp cấu hình thiết bị ban đầu trước khi chạy mô phỏng.'}
        </p>
      ) : (
        devices.map((device) => (
          <button
            key={device.deviceId}
            className={`topo-node topo-node--${deviceStatus(device)} ${selectedDevice === device.deviceId ? 'topo-node--selected' : ''}`}
            aria-pressed={selectedDevice === device.deviceId}
            onClick={() => onSelectDevice(device.deviceId)}
          >
            <span className="topo-node__header">
              <span className="topo-node__id">{device.deviceId}</span>
              <Badge status={deviceStatus(device)} />
            </span>
            <span className="topo-node__name">{device.name}</span>
            <span className="topo-node__metrics">
              {device.sensors.slice(0, 2).map((sensor) => (
                <span className="topo-metric" key={sensor.type}>
                  <span className="topo-metric__label">
                    {sensorInfo[sensor.type]?.label || sensor.type}
                  </span>
                  <span className="topo-metric__value">
                    {sensor.last.toFixed(1)} <small>{sensorInfo[sensor.type]?.unit}</small>
                  </span>
                </span>
              ))}
              {device.sensors.length === 0 && <span>Chưa có dữ liệu cảm biến</span>}
            </span>
          </button>
        ))
      )}
      <div className="sidebar__section-label">Kết nối dịch vụ</div>
      <div className="service-list">
        {serviceRows.map((service) => (
          <div className="service-row" key={service.name}>
            <span>{service.name}</span>
            <span className={service.ok ? 'service-row--ok' : ''}>{service.state}</span>
          </div>
        ))}
      </div>
      <p className="sidebar-note">
        Datadog: trạng thái cấu hình, chưa xác nhận dữ liệu trên Cloud.
      </p>
    </aside>
  );
}
