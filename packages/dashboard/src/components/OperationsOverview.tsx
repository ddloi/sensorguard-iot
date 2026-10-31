import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Flame,
  Server,
} from 'lucide-react';
import type { DashboardErrors, Device, Health } from '../types/domain';

import { getDeviceStatus } from '../utils/devices';
import { time } from '../utils/format';

interface DashboardHeadingProps {
  lastRefreshed: number | null;
  stale: boolean;
}

export function DashboardHeading({ lastRefreshed, stale }: DashboardHeadingProps) {
  return (
    <div className="page-heading">
      <div>
        <h2 className="page-heading__title">Toàn cảnh vận hành</h2>
        <p className="page-heading__description">Từ tín hiệu bất thường đến phục hồi tự động.</p>
      </div>
      <div className="page-heading__meta">
        <span className="badge badge--cyan">Dữ liệu mô phỏng IoT</span>
        <span>
          <Clock size={13} /> Cập nhật {time(lastRefreshed || undefined)}
          {stale ? ' · Đã cũ' : ''}
        </span>
      </div>
    </div>
  );
}

interface DataStatusBannerProps {
  errors: DashboardErrors;
  stale: boolean;
  health: Health | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function DataStatusBanner({
  errors,
  stale,
  health,
  isRefreshing,
  onRefresh,
}: DataStatusBannerProps) {
  if (!(Object.keys(errors).length > 0 || stale || (health && health.status !== 'ok'))) return null;
  return (
    <div className="data-banner data-banner--error" role="alert">
      <AlertTriangle size={19} />
      <div>
        <strong>
          {errors.fleet ? 'Chưa tải được dữ liệu vận hành' : 'Một phần dữ liệu chưa sẵn sàng'}
        </strong>
        <p>
          {Object.values(errors).join(' ') ||
            (stale
              ? 'Chưa nhận được dữ liệu mới. Các số liệu đang hiển thị có thể đã cũ.'
              : 'MongoDB hoặc Redis đang gián đoạn. Kiểm tra kết nối trước khi demo.')}
        </p>
      </div>
      <button className="btn btn--ghost" disabled={isRefreshing} onClick={onRefresh}>
        Thử lại
      </button>
    </div>
  );
}

interface SummaryStripProps {
  devices: Device[];
  now: number;
  loaded: boolean;
  errors: DashboardErrors;
  stale: boolean;
  activeCount: number;
  resolvedCount: number;
}

export function SummaryStrip({
  devices,
  now,
  loaded,
  errors,
  stale,
  activeCount,
  resolvedCount,
}: SummaryStripProps) {
  const deviceStatus = (device: Device) => getDeviceStatus(device, now);
  return (
    <div className="kpi-strip" aria-label="Tóm tắt vận hành">
      <div className="kpi-card">
        <div className="kpi-card__header">
          <span className="kpi-card__label">Thiết bị có tín hiệu</span>
          <Server size={17} />
        </div>
        <div className="kpi-card__value">
          {!loaded || errors.fleet || stale
            ? '—'
            : devices.filter((d) => deviceStatus(d) !== 'offline').length}
          <small> / {devices.length}</small>
        </div>
        <div className="kpi-card__desc">Nhận dữ liệu trong 60 giây gần nhất</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-card__header">
          <span className="kpi-card__label">Sự cố đang mở</span>
          <AlertTriangle size={17} />
        </div>
        <div
          className="kpi-card__value"
          style={{ color: activeCount ? 'var(--accent-rose)' : undefined }}
        >
          {!loaded || errors.incidents ? '—' : activeCount}
        </div>
        <div className="kpi-card__desc">
          {activeCount ? 'Theo dõi tiến trình trong Nhật ký sự cố' : 'Trong 50 sự cố gần nhất'}
        </div>
      </div>
      <div className="kpi-card">
        <div className="kpi-card__header">
          <span className="kpi-card__label">Đã phục hồi</span>
          <CheckCircle2 size={17} />
        </div>
        <div className="kpi-card__value">{!loaded || errors.incidents ? '—' : resolvedCount}</div>
        <div className="kpi-card__desc">Trong 50 sự cố gần nhất</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-card__header">
          <span className="kpi-card__label">Trung bình trượt</span>
          <BarChart3 size={17} />
        </div>
        <div className="kpi-card__value">
          5 <small>phút</small>
        </div>
        <div className="kpi-card__desc">MongoDB · $setWindowFields</div>
      </div>
    </div>
  );
}

interface DemoGuideProps {
  ready: boolean;
  disabled: boolean;
  sending: boolean;
  running: boolean;
  motorActive: boolean;
  onTrigger: () => void;
}

export function DemoGuide({
  ready,
  disabled,
  sending,
  running,
  motorActive,
  onTrigger,
}: DemoGuideProps) {
  return (
    <section className="demo-guide" aria-label="Kịch bản demo">
      <div className="demo-guide__content">
        <h3 className="demo-guide__title">
          <Flame size={18} />
          Quá nhiệt → phát hiện → phục hồi
        </h3>
        <p>MOTOR-001 · Gửi mẫu 92,4°C, theo dõi cảnh báo và quá trình làm mát mô phỏng.</p>
        <div className="demo-guide__steps">
          Quan sát cảm biến <ArrowRight size={13} /> Kích hoạt sự cố <ArrowRight size={13} /> Xem
          nhật ký
        </div>
        {!ready && (
          <p className="demo-guide__hint">
            Cần API, MongoDB, Redis và tín hiệu MOTOR-001 để bắt đầu.
          </p>
        )}
      </div>
      <button className="btn btn--danger" disabled={disabled} onClick={onTrigger}>
        <Flame size={16} />
        {sending
          ? 'Đang gửi…'
          : running || motorActive
            ? 'Đang xử lý sự cố…'
            : 'Chạy demo quá nhiệt'}
      </button>
    </section>
  );
}
