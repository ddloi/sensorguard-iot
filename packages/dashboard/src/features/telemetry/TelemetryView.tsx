import { AlertTriangle, BarChart3, Gauge, Thermometer } from 'lucide-react';
import type { DashboardErrors, Device, TimeSeriesPoint } from '../../types/domain';
import { Badge } from '../../components/StatusBadge';
import { RadialGauge } from '../../components/RadialGauge';
import { TemperatureChart } from '../../components/TemperatureChart';
import { getDeviceStatus } from '../../utils/devices';
import { time } from '../../utils/format';

interface TelemetryViewProps {
  devices: Device[];
  selectedDevice: string;
  selected?: Device;
  loaded: boolean;
  timeSeries: TimeSeriesPoint[];
  errors: DashboardErrors;
  now: number;
  onSelectDevice: (id: string) => void;
}
export function TelemetryView({
  devices,
  selectedDevice,
  selected,
  loaded,
  timeSeries,
  errors,
  now,
  onSelectDevice,
}: TelemetryViewProps) {
  const deviceStatus = (device: Device) => getDeviceStatus(device, now);
  return (
    <div className="content-full">
      <div className="device-toolbar">
        <label className="device-select" htmlFor="selected-device">
          Thiết bị đang xem
          <select
            id="selected-device"
            value={devices.length ? selectedDevice : ''}
            onChange={(event) => onSelectDevice(event.target.value)}
            disabled={!devices.length}
          >
            <option value="" disabled>
              Chọn thiết bị
            </option>
            {devices.map((device) => (
              <option value={device.deviceId} key={device.deviceId}>
                {device.deviceId} · {device.name}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <div>
            <Badge status={deviceStatus(selected)} />
            <p className="device-location">
              {selected.location} · Tín hiệu {time(selected.lastSeen)}
            </p>
          </div>
        )}
      </div>
      <section className="panel" aria-label="Chỉ số cảm biến">
        <div className="panel__header">
          <h3 className="panel__title">
            <Gauge size={17} />
            Chỉ số cảm biến <span className="mono">{selectedDevice}</span>
          </h3>
          <span className="panel-caption">Mẫu gần nhất · chưa làm mượt</span>
        </div>
        {!loaded ? (
          <div className="skeleton" />
        ) : selected?.sensors.length ? (
          <>
            <div className="gauge-group">
              {selected.sensors.map((sensor) => (
                <RadialGauge sensor={sensor} key={sensor.type} />
              ))}
            </div>
            {deviceStatus(selected) === 'offline' && (
              <p className="sensor-note">
                Thiết bị đã mất tín hiệu. Các giá trị trên là mẫu gần nhất còn lưu.
              </p>
            )}
          </>
        ) : (
          <div className="empty-state">
            <Thermometer size={26} />
            <strong className="empty-state__title">Chưa có dữ liệu cảm biến</strong>
            <p>Khởi động bộ mô phỏng và chờ một chu kỳ gửi dữ liệu (khoảng 5 giây).</p>
          </div>
        )}
      </section>
      <section className="panel" aria-label="Xu hướng nhiệt độ">
        <div className="panel__header">
          <h3 className="panel__title">
            <BarChart3 size={17} />
            Xu hướng nhiệt độ
          </h3>
          <div className="chart-legend">
            <span className="chart-legend__item">
              <span className="chart-legend__line" style={{ background: 'var(--accent-blue)' }} />
              Nhiệt độ
            </span>
            <span className="chart-legend__item">
              <span
                className="chart-legend__line chart-legend__line--dashed"
                style={{ borderColor: 'var(--accent-cyan)' }}
              />
              TB 5 phút
            </span>
            {selectedDevice === 'MOTOR-001' && (
              <span className="chart-legend__item">
                <span
                  className="chart-legend__line chart-legend__line--dashed"
                  style={{ borderColor: 'var(--accent-rose)' }}
                />
                Ngưỡng demo 85°C
              </span>
            )}
          </div>
        </div>
        {errors.series ? (
          <div className="empty-state">
            <AlertTriangle size={26} />
            <strong className="empty-state__title">Biểu đồ chưa sẵn sàng</strong>
            <p>{errors.series}</p>
          </div>
        ) : timeSeries.length > 1 ? (
          <TemperatureChart data={timeSeries} deviceId={selectedDevice} />
        ) : (
          <div className="empty-state">
            <BarChart3 size={26} />
            <strong className="empty-state__title">Đang chờ thêm mẫu nhiệt độ</strong>
            <p>Cần ít nhất 2 mốc dữ liệu để vẽ xu hướng. Biểu đồ tự cập nhật mỗi 5 giây.</p>
          </div>
        )}
      </section>
    </div>
  );
}
