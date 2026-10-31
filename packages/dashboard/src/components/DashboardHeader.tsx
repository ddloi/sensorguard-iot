import { Activity, Database, Moon, Radio, RefreshCw, ShieldCheck, Sun } from 'lucide-react';
import type { DashboardErrors, Health, LatestEvent, Theme } from '../types/domain';

import { time } from '../utils/format';

interface DashboardHeaderProps {
  theme: Theme;
  health: Health | null;
  errors: DashboardErrors;
  stale: boolean;
  loaded: boolean;
  wsConnected: boolean;
  isRefreshing: boolean;
  onToggleTheme: () => void;
  onRefresh: () => void;
}

export function DashboardHeader({
  theme,
  health,
  errors,
  stale,
  loaded,
  wsConnected,
  isRefreshing,
  onToggleTheme,
  onRefresh,
}: DashboardHeaderProps) {
  return (
    <header className="command-bar">
      <div className="command-bar__brand">
        <div className="command-bar__logo">
          <ShieldCheck size={22} />
        </div>
        <div>
          <h1 className="command-bar__title">
            Sensor<span>Guard</span>
          </h1>
          <p>Giám sát IoT công nghiệp</p>
        </div>
      </div>
      <div className="command-bar__actions">
        <span className="chip chip--integration">
          <Database size={14} />
          MongoDB
        </span>
        <span className="chip chip--integration">
          <Activity size={14} />
          Datadog
        </span>
        <span className="chip chip--connection">
          <span
            className={`status-dot status-dot--${health?.status === 'ok' && !errors.fleet && !stale ? 'online' : 'warning'}`}
          />
          <Radio size={14} />
          {!loaded
            ? 'Đang kết nối…'
            : !health
              ? 'Mất kết nối'
              : wsConnected
                ? 'WebSocket'
                : 'Cập nhật mỗi 5s'}
        </span>
        <button
          className="btn btn--ghost btn--icon"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          className="btn btn--ghost btn--icon"
          disabled={isRefreshing}
          onClick={onRefresh}
          aria-label="Làm mới dữ liệu"
          title="Làm mới dữ liệu"
        >
          <RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>
    </header>
  );
}

interface LatestEventFeedProps {
  error?: string;
  event?: LatestEvent;
}

export function LatestEventFeed({ error, event }: LatestEventFeedProps) {
  return (
    <div className="ticker-bar">
      <div className="ticker-bar__label">
        <Activity size={14} />
        Sự kiện mới nhất
      </div>
      <div className="ticker-bar__feed">
        {error ? (
          error
        ) : event ? (
          <span className="ticker-bar__item">
            <time className="mono">{time(event.timestamp)}</time>
            <strong>{event.deviceId}</strong>
            {event.details}
          </span>
        ) : (
          'Chưa có sự kiện. Chạy demo để theo dõi vòng đời một sự cố.'
        )}
      </div>
    </div>
  );
}
