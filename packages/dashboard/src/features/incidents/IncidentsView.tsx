import { AlertTriangle, Clock, RefreshCw, ShieldCheck } from 'lucide-react';
import type { DashboardErrors, Feedback, Health, Incident } from '../../types/domain';
import { Badge } from '../../components/StatusBadge';

import { time } from '../../utils/format';

interface IncidentsViewProps {
  incidents: Incident[];
  errors: DashboardErrors;
  rechecking: string | null;
  health: Health | null;
  stale: boolean;
  recheckMessages: Record<string, Feedback>;
  onRecheck: (id: string) => void;
}
export function IncidentsView({
  incidents,
  errors,
  rechecking,
  health,
  stale,
  recheckMessages,
  onRecheck,
}: IncidentsViewProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h3 className="panel__title">
            <AlertTriangle size={17} />
            Vòng đời sự cố
          </h3>
          <p className="panel-caption">Phát hiện → điều tra → xử lý → xác nhận phục hồi</p>
        </div>
        <span className="badge badge--cyan">50 sự cố gần nhất</span>
      </div>
      <div className="incident-list">
        {errors.incidents && (
          <div className="data-banner data-banner--warning" role="status">
            {errors.incidents}
          </div>
        )}
        {incidents.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={30} />
            <strong className="empty-state__title">Chưa ghi nhận sự cố</strong>
            <p>Chạy demo quá nhiệt để theo dõi cách hệ thống phát hiện và xử lý MOTOR-001.</p>
          </div>
        ) : (
          incidents.map((incident) => (
            <article
              className={`incident-card incident-card--${incident.status === 'resolved' ? 'resolved' : 'active'}`}
              key={incident._id}
            >
              <div className="incident-card__header">
                <div>
                  <h4 className="incident-card__title">{incident.title}</h4>
                  <div className="incident-card__meta">
                    <span className="mono">{incident.deviceId}</span>
                    <Clock size={13} />
                    {new Date(incident.createdAt).toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className="incident-stage">
                  {incident.duration != null && (
                    <span className="badge badge--cyan">{incident.duration}s phục hồi</span>
                  )}
                  <Badge
                    status={
                      incident.status === 'investigating' &&
                      incident.timeline.some((event) => event.event === 'escalated')
                        ? 'escalated'
                        : incident.status
                    }
                  />
                </div>
              </div>
              {incident.status === 'investigating' &&
                incident.timeline.some((event) => event.event === 'escalated') && (
                  <div className="incident-recheck">
                    <p>
                      Chưa xác nhận được phục hồi. Kiểm tra bộ mô phỏng và ngưỡng cảm biến, sau đó
                      xác minh lại.
                    </p>
                    <button
                      className="btn btn--ghost"
                      disabled={!!rechecking || health?.status !== 'ok' || stale}
                      onClick={() => onRecheck(incident._id)}
                    >
                      <RefreshCw size={15} />
                      {rechecking === incident._id ? 'Đang yêu cầu…' : 'Kiểm tra phục hồi lại'}
                    </button>
                  </div>
                )}
              {recheckMessages[incident._id] && (
                <p
                  role="status"
                  className={`demo-feedback demo-feedback--${recheckMessages[incident._id].error ? 'error' : 'success'}`}
                >
                  {recheckMessages[incident._id].text}
                </p>
              )}
              <details
                className="incident-history"
                open={incident._id === incidents[0]?._id || incident.status !== 'resolved'}
              >
                <summary>Chẩn đoán và diễn biến</summary>
                {(incident.rootCause || incident.resolution) && (
                  <div className="incident-card__details">
                    <div>
                      <div className="incident-card__detail-label">
                        Nguyên nhân · chẩn đoán mô phỏng
                      </div>
                      <p className="incident-card__detail-value">
                        {incident.rootCause || 'Đang điều tra…'}
                      </p>
                    </div>
                    <div>
                      <div className="incident-card__detail-label">
                        Hành động khắc phục mô phỏng
                      </div>
                      <p className="incident-card__detail-value">
                        {incident.resolution || 'Đang chờ worker xử lý…'}
                      </p>
                    </div>
                  </div>
                )}
                <div className="incident-card__timeline">
                  <h5 className="incident-card__timeline-title">Diễn biến</h5>
                  {incident.timeline.map((event, index) => (
                    <div className="timeline-event" key={`${event.timestamp}-${index}`}>
                      <time className="timeline-event__time">{time(event.timestamp)}</time>
                      <span className="timeline-event__dot" />
                      <span className="timeline-event__text">{event.details}</span>
                    </div>
                  ))}
                </div>
              </details>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
