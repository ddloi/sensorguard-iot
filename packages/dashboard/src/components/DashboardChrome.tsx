import { AlertTriangle, CircuitBoard, Gauge } from 'lucide-react';
import type { Health, View } from '../types/domain';

interface DashboardNavigationProps {
  activeTab: View;
  incidentCount: number;
  onSelectView: (view: View) => void;
}

export function DashboardNavigation({
  activeTab,
  incidentCount,
  onSelectView,
}: DashboardNavigationProps) {
  return (
    <nav className="tab-nav" aria-label="Chế độ xem">
      {(
        [
          { id: 'fleet', label: 'Giám sát thiết bị', icon: Gauge },
          { id: 'incidents', label: `Nhật ký sự cố (${incidentCount})`, icon: AlertTriangle },
          { id: 'architecture', label: 'Kiến trúc hệ thống', icon: CircuitBoard },
        ] as const
      ).map((view) => (
        <button
          key={view.id}
          className={`tab-nav__item ${activeTab === view.id ? 'tab-nav__item--active' : ''}`}
          aria-current={activeTab === view.id ? 'page' : undefined}
          onClick={() => onSelectView(view.id)}
        >
          <view.icon size={16} className="tab-nav__icon" />
          {view.label}
        </button>
      ))}
    </nav>
  );
}

interface DashboardFooterProps {
  health: Health | null;
  wsConnected: boolean;
}

export function DashboardFooter({ health, wsConnected }: DashboardFooterProps) {
  return (
    <footer className="ops-footer">
      <span>SensorGuard · MongoDB × Datadog Hackathon 2026</span>
      <span className="mono">
        {health?.uptime != null
          ? `API uptime: ${Math.floor(health.uptime / 60)} phút`
          : 'API chưa sẵn sàng'}{' '}
        · {wsConnected ? 'WebSocket kết nối' : 'Dự phòng bằng API'}
      </span>
    </footer>
  );
}
