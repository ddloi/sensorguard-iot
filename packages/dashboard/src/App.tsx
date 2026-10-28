import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  ShieldAlert,
  Thermometer,
  Gauge,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Sun,
  Moon,
  RefreshCw,
  Server,
  Database,
  Radio,
  TrendingUp,
  Cpu,
  MonitorDot,
  Waves,
  BarChart3,
  CircuitBoard,
  Clock,
  ChevronRight,
  Settings2,
  ExternalLink,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */
interface SensorValue {
  type: string;
  avg?: number;
  max?: number;
  min?: number;
  last: number;
  count?: number;
}

interface Device {
  deviceId: string;
  name: string;
  status: 'online' | 'warning' | 'critical' | 'offline' | 'maintenance';
  location: string;
  type: string;
  sensors: SensorValue[];
}

interface IncidentTimeline {
  timestamp: string;
  event: string;
  details: string;
}

interface Incident {
  _id: string;
  title: string;
  status: 'open' | 'investigating' | 'mitigating' | 'resolved';
  severity: 'warning' | 'critical';
  deviceId: string;
  timeline: IncidentTimeline[];
  rootCause: string | null;
  resolution: string | null;
  duration: number | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface TimeSeriesPoint {
  timestamp: string;
  avg: number;
  max: number;
  min: number;
  latest: number;
  movingAvg: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SVG RADIAL GAUGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
function RadialGauge({
  value,
  min,
  max,
  label,
  unit,
  thresholdWarning,
  thresholdCritical,
  size = 100,
  accentColor,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  unit: string;
  thresholdWarning?: number;
  thresholdCritical?: number;
  size?: number;
  accentColor?: string;
}) {
  const radius = (size - 16) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const startAngle = 135;
  const sweepAngle = 270;
  const normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const dashOffset = circumference * (1 - (normalizedValue * sweepAngle) / 360);

  let color = accentColor || 'var(--accent-cyan)';
  if (thresholdCritical && value >= thresholdCritical) {
    color = 'var(--accent-rose)';
  } else if (thresholdWarning && value >= thresholdWarning) {
    color = 'var(--accent-amber)';
  }

  const arcPath = (r: number) => {
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((startAngle + sweepAngle - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = sweepAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  return (
    <div className="gauge-item">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <path
          d={arcPath(radius)}
          fill="none"
          stroke="var(--bg-gauge-track)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={arcPath(radius)}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(circumference * sweepAngle) / 360}`}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease',
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
        />
        {/* Value text */}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text-primary)"
          fontFamily="var(--font-mono)"
          fontSize={size > 90 ? '1rem' : '0.8rem'}
          fontWeight="700"
        >
          {typeof value === 'number' ? value.toFixed(1) : '--'}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text-muted)"
          fontFamily="var(--font-mono)"
          fontSize="0.55rem"
        >
          {unit}
        </text>
      </svg>
      <span className="gauge-item__label">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MINI SPARKLINE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
function Sparkline({
  data,
  width = 60,
  height = 24,
  color = 'var(--accent-cyan)',
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} opacity="0.8" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [devices, setDevices] = useState<Device[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('MOTOR-001');
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeTab, setActiveTab] = useState<'fleet' | 'incidents' | 'architecture'>('fleet');
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Uptime counter
  useEffect(() => {
    const interval = setInterval(() => setUptimeSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // ─── DATA FETCH ──────────────────────────────────────────────────────
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const [devRes, incRes, tsRes] = await Promise.all([
        fetch('/api/analytics/device-health'),
        fetch('/api/incidents'),
        fetch(
          `/api/analytics/timeseries?deviceId=${selectedDevice}&sensorType=temperature&minutes=20&bucketSeconds=5`
        ),
      ]);

      if (devRes.ok) {
        const json = await devRes.json();
        if (json.devices?.length > 0) setDevices(json.devices);
      }
      if (incRes.ok) {
        const json = await incRes.json();
        if (json.incidents) setIncidents(json.incidents);
      }
      if (tsRes.ok) {
        const json = await tsRes.json();
        if (json.data) setTimeSeries(json.data);
      }
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const pollInterval = wsConnected ? 8000 : 3000;
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [selectedDevice, wsConnected]);

  // WebSocket Live Stream Connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'device_status') {
              setDevices((prev) =>
                prev.map((d) =>
                  d.deviceId === msg.data.deviceId ? { ...d, status: msg.data.status } : d
                )
              );
            } else if (msg.event === 'alert' || msg.event === 'incident') {
              fetchData();
            }
          } catch {
            // ignore JSON parse error
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWebSocket, 4000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWebSocket, 4000);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  // ─── TRIGGER OVERHEAT ────────────────────────────────────────────────
  const handleTriggerScenario = async () => {
    setIsSimulating(true);
    try {
      await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'MOTOR-001',
          readings: [
            { sensorType: 'temperature', value: 92.4, unit: 'celsius', quality: 'good' },
            { sensorType: 'vibration', value: 6.8, unit: 'mm/s', quality: 'good' },
            { sensorType: 'rpm', value: 1450, unit: 'rpm', quality: 'good' },
          ],
        }),
      });
      setTimeout(() => {
        fetchData();
        setIsSimulating(false);
      }, 1500);
    } catch {
      setIsSimulating(false);
    }
  };

  // ─── DERIVED STATE ───────────────────────────────────────────────────
  const criticalCount = incidents.filter((i) => i.status !== 'resolved').length;
  const resolvedCount = incidents.filter((i) => i.status === 'resolved').length;
  const selectedDeviceData = devices.find((d) => d.deviceId === selectedDevice);

  const selectedGauges = useMemo(() => {
    if (!selectedDeviceData) return null;
    const temp = selectedDeviceData.sensors.find((s) => s.type === 'temperature');
    const vib = selectedDeviceData.sensors.find((s) => s.type === 'vibration');
    const rpm = selectedDeviceData.sensors.find((s) => s.type === 'rpm');
    const power = selectedDeviceData.sensors.find((s) => s.type === 'power');
    return { temp, vib, rpm, power };
  }, [selectedDeviceData]);

  // Sparkline data from timeseries
  const sparkData = useMemo(
    () => timeSeries.slice(-20).map((p) => p.latest),
    [timeSeries]
  );

  // ─── DEVICE STATUS HELPERS ───────────────────────────────────────────
  const getDeviceStatusClass = (dev: Device) => {
    const temp = dev.sensors.find((s) => s.type === 'temperature');
    if (dev.status === 'critical' || (temp && temp.last > 85)) return 'critical';
    if (dev.status === 'warning' || (temp && temp.last > 80)) return 'warning';
    if (dev.status === 'maintenance') return 'maintenance';
    if (dev.status === 'offline') return 'offline';
    return 'online';
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'critical': return 'CRITICAL';
      case 'warning': return 'WARNING';
      case 'maintenance': return 'COOLING';
      case 'offline': return 'OFFLINE';
      default: return 'NOMINAL';
    }
  };

  const getBadgeClass = (status: string) => {
    switch (status) {
      case 'critical': return 'badge--rose';
      case 'warning': return 'badge--amber';
      case 'maintenance': return 'badge--purple';
      case 'offline': return '';
      default: return 'badge--emerald';
    }
  };

  // Recent ticker events from incidents
  const tickerEvents = useMemo(() => {
    const events: { text: string; type: string; time: string }[] = [];
    incidents.forEach((inc) => {
      inc.timeline.forEach((ev) => {
        events.push({
          text: `[${inc.deviceId}] ${ev.details}`,
          type: inc.status === 'resolved' ? 'resolved' : 'active',
          time: new Date(ev.timestamp).toLocaleTimeString(),
        });
      });
    });
    return events.slice(-10).reverse();
  }, [incidents]);

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="ops-center">
      {/* ═══ COMMAND BAR ══════════════════════════════════════════════════ */}
      <header className="command-bar">
        <div className="command-bar__brand">
          <div className="command-bar__logo">
            <ShieldAlert size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 className="command-bar__title">
                Sensor<span>Guard</span>
              </h1>
              <div className="command-bar__status">
                <span className="status-dot status-dot--online" />
                LIVE OPS
              </div>
            </div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              Industrial IoT Operations Center
            </p>
          </div>
        </div>

        <div className="command-bar__actions">
          {/* Integration chips */}
          <div className="chip">
            <span className="chip__dot" style={{ background: 'var(--accent-cyan)' }} />
            <Database size={12} />
            MongoDB Atlas
          </div>
          <div className="chip">
            <span className="chip__dot" style={{ background: 'var(--accent-purple)' }} />
            <Activity size={12} />
            Datadog US1
          </div>
          <div className="chip">
            <span className="chip__dot" style={{ background: 'var(--accent-amber)' }} />
            <Zap size={12} />
            BullMQ
          </div>
          <div className="chip">
            <span
              className="chip__dot"
              style={{
                background: wsConnected ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                boxShadow: wsConnected ? '0 0 6px var(--accent-emerald)' : 'none',
              }}
            />
            <Radio size={12} />
            {wsConnected ? 'WebSocket Live' : 'Polling'}
          </div>

          {/* Uptime */}
          <div className="chip" style={{ fontFamily: 'var(--font-mono)' }}>
            <Clock size={12} />
            {formatUptime(uptimeSeconds)}
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            className="btn btn--ghost btn--icon"
            title={theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {/* Refresh */}
          <button onClick={fetchData} className="btn btn--ghost btn--icon" title="Refresh">
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          {/* Demo button */}
          <button
            onClick={handleTriggerScenario}
            disabled={isSimulating}
            className="btn btn--danger"
          >
            <Flame size={14} />
            {isSimulating ? 'Injecting...' : 'Demo Quá Nhiệt'}
          </button>
        </div>
      </header>

      {/* ═══ LIVE TICKER BAR ═════════════════════════════════════════════ */}
      <div className="ticker-bar">
        <div className="ticker-bar__label">
          <Radio size={12} />
          EVENT FEED
        </div>
        <div className="ticker-bar__feed">
          {tickerEvents.length > 0 ? (
            tickerEvents.map((ev, i) => (
              <span key={i} className="ticker-bar__item">
                <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                  {ev.time}
                </span>
                <span
                  className="status-dot"
                  style={{
                    width: 5,
                    height: 5,
                    background:
                      ev.type === 'resolved' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  }}
                />
                <span>{ev.text}</span>
              </span>
            ))
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>
              System nominal — No events to report. Press "Demo Quá Nhiệt" to simulate an incident.
            </span>
          )}
        </div>
      </div>

      {/* ═══ MAIN GRID: SIDEBAR + CONTENT ════════════════════════════════ */}
      <div className="ops-grid">
        {/* ─── LEFT SIDEBAR: SYSTEM TOPOLOGY ────────────────────────────── */}
        <aside className="ops-sidebar">
          <div className="sidebar__section-label">System Topology</div>

          {devices.map((dev) => {
            const status = getDeviceStatusClass(dev);
            const temp = dev.sensors.find((s) => s.type === 'temperature');
            const vib = dev.sensors.find((s) => s.type === 'vibration');
            const isSelected = selectedDevice === dev.deviceId;

            return (
              <div
                key={dev.deviceId}
                className={`topo-node topo-node--${status} ${isSelected ? 'topo-node--selected' : ''}`}
                onClick={() => setSelectedDevice(dev.deviceId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedDevice(dev.deviceId); }}
                aria-label={`Select device ${dev.deviceId}`}
              >
                <div className="topo-node__header">
                  <span className="topo-node__id">{dev.deviceId}</span>
                  <span className={`badge ${getBadgeClass(status)}`}>
                    <span className={`status-dot status-dot--${status}`} />
                    {getStatusLabel(status)}
                  </span>
                </div>
                <div className="topo-node__name">{dev.name}</div>
                <div className="topo-node__metrics">
                  <div className="topo-metric">
                    <div className="topo-metric__label">
                      <Thermometer size={10} color="var(--accent-rose)" />
                      TEMP
                    </div>
                    <div
                      className={`topo-metric__value ${
                        temp && temp.last > 85
                          ? 'topo-metric__value--danger'
                          : temp && temp.last > 80
                            ? 'topo-metric__value--warning'
                            : ''
                      }`}
                    >
                      {temp ? `${temp.last.toFixed(1)}°C` : '--'}
                    </div>
                  </div>
                  <div className="topo-metric">
                    <div className="topo-metric__label">
                      <Waves size={10} color="var(--accent-amber)" />
                      VIB
                    </div>
                    <div className="topo-metric__value">
                      {vib ? `${vib.last.toFixed(1)}` : '--'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {devices.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              Connecting to device fleet...
            </div>
          )}

          {/* Services status */}
          <div className="sidebar__section-label" style={{ marginTop: '8px' }}>
            Infrastructure
          </div>

          <div className="topo-node" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.72rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="status-dot status-dot--online" />
                <span style={{ color: 'var(--text-secondary)' }}>Fastify API</span>
                <span className="mono" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>:3001</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="status-dot status-dot--online" />
                <span style={{ color: 'var(--text-secondary)' }}>MongoDB Atlas</span>
                <span className="mono" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>M0</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="status-dot status-dot--online" />
                <span style={{ color: 'var(--text-secondary)' }}>Upstash Redis</span>
                <span className="mono" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>TLS</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="status-dot status-dot--online" />
                <span style={{ color: 'var(--text-secondary)' }}>Datadog</span>
                <span className="mono" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>US1</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ─── MAIN CONTENT AREA ────────────────────────────────────────── */}
        <main className="ops-main">
          {/* KPI STRIP */}
          <div className="kpi-strip stagger-children">
            <div className="kpi-card kpi-card--cyan">
              <div className="kpi-card__header">
                <span className="kpi-card__label">Devices Online</span>
                <Server size={16} color="var(--accent-cyan)" />
              </div>
              <div className="kpi-card__value">{devices.length || 5}</div>
              <div className="kpi-card__sub" style={{ color: 'var(--accent-emerald)' }}>
                100% Uptime
              </div>
              <div className="kpi-card__desc">5 industrial machines streaming</div>
            </div>

            <div className="kpi-card kpi-card--rose">
              <div className="kpi-card__header">
                <span className="kpi-card__label">Active Incidents</span>
                <AlertTriangle
                  size={16}
                  color={criticalCount > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'}
                />
              </div>
              <div
                className="kpi-card__value"
                style={{ color: criticalCount > 0 ? 'var(--accent-rose)' : undefined }}
              >
                {criticalCount}
              </div>
              <div
                className="kpi-card__sub"
                style={{ color: criticalCount > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}
              >
                {criticalCount > 0 ? 'Needs Attention' : 'All Clear'}
              </div>
              <div className="kpi-card__desc">Auto-detected by BullMQ workers</div>
            </div>

            <div className="kpi-card kpi-card--emerald">
              <div className="kpi-card__header">
                <span className="kpi-card__label">Auto-Remediated</span>
                <CheckCircle2 size={16} color="var(--accent-emerald)" />
              </div>
              <div className="kpi-card__value" style={{ color: 'var(--accent-emerald)' }}>
                {resolvedCount}
              </div>
              <div className="kpi-card__sub" style={{ color: 'var(--accent-emerald)' }}>
                Self-Healing Active
              </div>
              <div className="kpi-card__desc">RPM reduction + cooling (~26s)</div>
            </div>

            <div className="kpi-card kpi-card--purple">
              <div className="kpi-card__header">
                <span className="kpi-card__label">MongoDB Windowing</span>
                <TrendingUp size={16} color="var(--accent-purple)" />
              </div>
              <div className="kpi-card__value" style={{ color: 'var(--accent-purple)' }}>
                5<span style={{ fontSize: '1rem', fontWeight: 600 }}>min</span>
              </div>
              <div className="kpi-card__sub" style={{ color: 'var(--accent-purple)' }}>
                $setWindowFields
              </div>
              <div className="kpi-card__desc">Real-time moving average</div>
            </div>
          </div>

          {/* TAB NAVIGATION */}
          <div className="tab-nav">
            <button
              className={`tab-nav__item ${activeTab === 'fleet' ? 'tab-nav__item--active' : ''}`}
              onClick={() => setActiveTab('fleet')}
            >
              <MonitorDot size={14} className="tab-nav__icon" />
              Telemetry & Gauges
            </button>
            <button
              className={`tab-nav__item ${activeTab === 'incidents' ? 'tab-nav__item--active' : ''}`}
              onClick={() => setActiveTab('incidents')}
            >
              <AlertTriangle size={14} className="tab-nav__icon" />
              Incident Response ({incidents.length})
            </button>
            <button
              className={`tab-nav__item ${activeTab === 'architecture' ? 'tab-nav__item--active' : ''}`}
              onClick={() => setActiveTab('architecture')}
            >
              <CircuitBoard size={14} className="tab-nav__icon" />
              Architecture
            </button>
          </div>

          {/* ═══ TAB: TELEMETRY & GAUGES ═════════════════════════════════ */}
          {activeTab === 'fleet' && (
            <div className="content-full animate-fade-in">
              {/* Radial Gauges for selected device */}
              <div className="panel">
                <div className="panel__header">
                  <div className="panel__title">
                    <Gauge size={14} className="panel__title-accent" />
                    <span style={{ color: 'var(--accent-cyan)' }}>
                      {selectedDevice}
                    </span>
                    <ChevronRight size={12} />
                    <span>Live Sensor Gauges</span>
                    {selectedDeviceData && (
                      <span
                        className={`badge ${getBadgeClass(getDeviceStatusClass(selectedDeviceData))}`}
                        style={{ marginLeft: '4px' }}
                      >
                        {selectedDeviceData.name}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkline data={sparkData} color="var(--accent-cyan)" width={80} height={28} />
                    <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      Last 20 readings
                    </span>
                  </div>
                </div>
                <div className="gauge-group">
                  {selectedGauges?.temp && (
                    <RadialGauge
                      value={selectedGauges.temp.last}
                      min={20}
                      max={120}
                      label="Temperature"
                      unit="°C"
                      thresholdWarning={80}
                      thresholdCritical={85}
                    />
                  )}
                  {selectedGauges?.vib && (
                    <RadialGauge
                      value={selectedGauges.vib.last}
                      min={0}
                      max={15}
                      label="Vibration"
                      unit="mm/s"
                      thresholdWarning={5}
                      thresholdCritical={8}
                      accentColor="var(--accent-amber)"
                    />
                  )}
                  {selectedGauges?.rpm && (
                    <RadialGauge
                      value={selectedGauges.rpm.last}
                      min={0}
                      max={3600}
                      label="RPM"
                      unit="rpm"
                      accentColor="var(--accent-blue)"
                    />
                  )}
                  {selectedGauges?.power && (
                    <RadialGauge
                      value={selectedGauges.power.last}
                      min={0}
                      max={100}
                      label="Power"
                      unit="kW"
                      accentColor="var(--accent-teal)"
                    />
                  )}
                  {!selectedGauges && (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        padding: '30px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.82rem',
                      }}
                    >
                      Select a device from the topology panel to view live gauges...
                    </div>
                  )}
                </div>
              </div>

              {/* Time Series Chart */}
              <div className="panel">
                <div className="panel__header">
                  <div className="panel__title">
                    <BarChart3 size={14} className="panel__title-accent" />
                    <span>Temperature Time Series</span>
                    <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                      $setWindowFields
                    </span>
                  </div>
                  <div className="chart-legend">
                    <div className="chart-legend__item">
                      <div className="chart-legend__line" style={{ background: 'var(--accent-blue)' }} />
                      Instant Temp
                    </div>
                    <div className="chart-legend__item">
                      <div className="chart-legend__line" style={{ background: 'var(--accent-cyan)' }} />
                      5min Moving Avg
                    </div>
                    <div className="chart-legend__item">
                      <div
                        className="chart-legend__line chart-legend__line--dashed"
                        style={{ borderColor: 'var(--accent-rose)' }}
                      />
                      Critical 85°C
                    </div>
                  </div>
                </div>
                <div className="chart-container">
                  {timeSeries.length > 1 ? (
                    <svg viewBox="0 0 800 220" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      {/* Grid lines */}
                      {[50, 60, 70, 80, 85, 90, 100].map((temp) => {
                        const y = 220 - ((temp - 45) / 60) * 220;
                        return (
                          <g key={temp}>
                            <line
                              x1="0"
                              y1={y}
                              x2="800"
                              y2={y}
                              stroke={
                                temp === 85
                                  ? 'var(--accent-rose)'
                                  : temp === 80
                                    ? 'var(--accent-amber)'
                                    : 'var(--chart-grid)'
                              }
                              strokeWidth={temp === 85 ? 1.5 : temp === 80 ? 1 : 0.5}
                              strokeDasharray={temp === 85 || temp === 80 ? '6 4' : 'none'}
                              opacity={temp === 85 ? 0.8 : temp === 80 ? 0.6 : 0.5}
                            />
                            <text
                              x="805"
                              y={y + 4}
                              fill={
                                temp === 85
                                  ? 'var(--accent-rose)'
                                  : temp === 80
                                    ? 'var(--accent-amber)'
                                    : 'var(--chart-text)'
                              }
                              fontSize="9"
                              fontFamily="var(--font-mono)"
                              fontWeight={temp >= 80 ? '600' : '400'}
                            >
                              {temp}°
                            </text>
                          </g>
                        );
                      })}

                      {/* Data lines */}
                      {(() => {
                        const minT = 45;
                        const maxT = 105;
                        const range = maxT - minT;
                        const stepX = 800 / Math.max(1, timeSeries.length - 1);

                        const tempPoints = timeSeries
                          .map((p, i) => {
                            const x = i * stepX;
                            const y = 220 - ((p.latest - minT) / range) * 220;
                            return `${x},${Math.max(5, Math.min(215, y))}`;
                          })
                          .join(' ');

                        const avgPoints = timeSeries
                          .map((p, i) => {
                            const x = i * stepX;
                            const y = 220 - ((p.movingAvg - minT) / range) * 220;
                            return `${x},${Math.max(5, Math.min(215, y))}`;
                          })
                          .join(' ');

                        // Gradient area under temp line
                        const areaPoints = `0,220 ${tempPoints} ${(timeSeries.length - 1) * stepX},220`;

                        return (
                          <>
                            <defs>
                              <linearGradient id="tempAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.15" />
                                <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            <polygon fill="url(#tempAreaGrad)" points={areaPoints} />
                            <polyline
                              fill="none"
                              stroke="var(--accent-blue)"
                              strokeWidth="1.5"
                              opacity="0.6"
                              points={tempPoints}
                            />
                            <polyline
                              fill="none"
                              stroke="var(--accent-cyan)"
                              strokeWidth="3"
                              points={avgPoints}
                              style={{ filter: 'drop-shadow(0 0 4px var(--accent-cyan))' }}
                            />
                          </>
                        );
                      })()}
                    </svg>
                  ) : (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.82rem',
                      }}
                    >
                      <RefreshCw size={16} className="animate-spin" style={{ marginRight: '8px' }} />
                      Accumulating time series data from sensors...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: INCIDENT RESPONSE ══════════════════════════════════ */}
          {activeTab === 'incidents' && (
            <div className="content-full animate-fade-in">
              <div className="panel">
                <div className="panel__header">
                  <div>
                    <div className="panel__title" style={{ marginBottom: '4px' }}>
                      <AlertTriangle size={14} style={{ color: 'var(--accent-rose)' }} />
                      Incident Lifecycle & Auto-Remediation
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Detect → Root Cause → Auto-Fix → Verify Recovery
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span className="badge badge--rose">
                      {criticalCount} Active
                    </span>
                    <span className="badge badge--emerald">
                      {resolvedCount} Resolved
                    </span>
                  </div>
                </div>
                <div className="incident-list">
                  {incidents.length === 0 ? (
                    <div
                      style={{
                        padding: '40px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.82rem',
                      }}
                    >
                      <CheckCircle2
                        size={32}
                        color="var(--accent-emerald)"
                        style={{ marginBottom: '8px', opacity: 0.5 }}
                      />
                      <br />
                      No incidents recorded. Press{' '}
                      <strong style={{ color: 'var(--accent-rose)' }}>"Demo Quá Nhiệt"</strong> to trigger
                      an overheat scenario.
                    </div>
                  ) : (
                    incidents.map((inc) => {
                      const isResolved = inc.status === 'resolved';
                      return (
                        <div
                          key={inc._id}
                          className={`incident-card ${isResolved ? 'incident-card--resolved' : 'incident-card--active'}`}
                        >
                          <div className="incident-card__header">
                            <div>
                              <div className="incident-card__title">{inc.title}</div>
                              <div className="incident-card__meta">
                                <span className="mono">{inc.deviceId}</span>
                                <span style={{ color: 'var(--border-primary)' }}>|</span>
                                <Clock size={11} />
                                {new Date(inc.createdAt).toLocaleString()}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {inc.duration && (
                                <span
                                  className="mono badge badge--cyan"
                                  style={{ fontSize: '0.72rem' }}
                                >
                                  {inc.duration}s TTR
                                </span>
                              )}
                              <span className={`badge ${isResolved ? 'badge--emerald' : 'badge--rose'}`}>
                                <span
                                  className={`status-dot ${isResolved ? 'status-dot--online' : 'status-dot--critical'}`}
                                />
                                {isResolved ? 'RECOVERED' : 'ACTIVE'}
                              </span>
                            </div>
                          </div>

                          {inc.rootCause && (
                            <div className="incident-card__details">
                              <div>
                                <div className="incident-card__detail-label" style={{ color: 'var(--accent-amber)' }}>
                                  <AlertTriangle size={12} />
                                  Root Cause
                                </div>
                                <div className="incident-card__detail-value">{inc.rootCause}</div>
                              </div>
                              <div>
                                <div className="incident-card__detail-label" style={{ color: 'var(--accent-emerald)' }}>
                                  <Settings2 size={12} />
                                  Auto-Remediation
                                </div>
                                <div className="incident-card__detail-value">
                                  {inc.resolution || 'Initiating remediation...'}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="incident-card__timeline">
                            <div className="incident-card__timeline-title">Event Timeline</div>
                            {inc.timeline.map((event, idx) => (
                              <div key={idx} className="timeline-event">
                                <span className="timeline-event__time">
                                  {new Date(event.timestamp).toLocaleTimeString()}
                                </span>
                                <span className="timeline-event__dot" />
                                <span className="timeline-event__text">{event.details}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: ARCHITECTURE ═══════════════════════════════════════ */}
          {activeTab === 'architecture' && (
            <div className="content-full animate-fade-in">
              <div className="panel">
                <div className="panel__header">
                  <div>
                    <div className="panel__title" style={{ marginBottom: '4px' }}>
                      <CircuitBoard size={14} className="panel__title-accent" />
                      System Architecture — Event-Driven IoT Pipeline
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Hackathon MUG Vietnam 2026 · MongoDB × Datadog
                    </p>
                  </div>
                </div>
                <div className="arch-grid">
                  {/* MongoDB */}
                  <div className="arch-card">
                    <div className="arch-card__header">
                      <div
                        className="arch-card__icon"
                        style={{ background: 'var(--glow-cyan)' }}
                      >
                        <Database size={20} color="var(--accent-cyan)" />
                      </div>
                      <div className="arch-card__title">MongoDB Atlas Time Series</div>
                    </div>
                    <ul className="arch-card__list">
                      <li>
                        Compressed time series storage with <code>granularity: seconds</code>
                      </li>
                      <li>
                        <code>$setWindowFields</code> for real-time Moving Average computation
                      </li>
                      <li>TTL Index auto-cleanup after 7 days</li>
                      <li>
                        5 collections: <code>sensor_data</code>, <code>devices</code>,{' '}
                        <code>thresholds</code>, <code>alerts</code>, <code>incidents</code>
                      </li>
                    </ul>
                  </div>

                  {/* BullMQ */}
                  <div className="arch-card">
                    <div className="arch-card__header">
                      <div
                        className="arch-card__icon"
                        style={{ background: 'var(--glow-amber)' }}
                      >
                        <Zap size={20} color="var(--accent-amber)" />
                      </div>
                      <div className="arch-card__title">Upstash Redis + BullMQ</div>
                    </div>
                    <ul className="arch-card__list">
                      <li>
                        High-speed async queues: Ingest → Threshold → Alert → Remediation
                      </li>
                      <li>Rate limiting & de-duplication to prevent alert storms</li>
                      <li>Periodic device health heartbeat checks (30s intervals)</li>
                      <li>
                        Workers: <code>ThresholdWorker</code>, <code>AlertWorker</code>,{' '}
                        <code>RemediationWorker</code>, <code>DeviceHealthWorker</code>
                      </li>
                    </ul>
                  </div>

                  {/* Datadog */}
                  <div className="arch-card">
                    <div className="arch-card__header">
                      <div
                        className="arch-card__icon"
                        style={{ background: 'var(--glow-purple)' }}
                      >
                        <Activity size={20} color="var(--accent-purple)" />
                      </div>
                      <div className="arch-card__title">Datadog Observability</div>
                    </div>
                    <ul className="arch-card__list">
                      <li>Custom Metrics: Gauge, Counter, Histogram via StatsD/HTTP</li>
                      <li>
                        APM Traces with <code>dd-trace</code> measuring API latency & data flow
                      </li>
                      <li>Automatic incident and recovery log shipping to Datadog Logs</li>
                    </ul>
                  </div>

                  {/* Fastify */}
                  <div className="arch-card">
                    <div className="arch-card__header">
                      <div
                        className="arch-card__icon"
                        style={{ background: 'var(--glow-emerald)' }}
                      >
                        <Cpu size={20} color="var(--accent-emerald)" />
                      </div>
                      <div className="arch-card__title">Fastify API Gateway</div>
                    </div>
                    <ul className="arch-card__list">
                      <li>
                        RESTful endpoints: <code>/api/ingest</code>,{' '}
                        <code>/api/analytics/*</code>, <code>/api/incidents</code>
                      </li>
                      <li>Request validation with JSON Schema</li>
                      <li>Lightweight, high-throughput Node.js server on port 3001</li>
                    </ul>
                  </div>

                  {/* Demo Scenario */}
                  <div className="arch-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="arch-card__header">
                      <div
                        className="arch-card__icon"
                        style={{ background: 'var(--glow-rose)' }}
                      >
                        <Flame size={20} color="var(--accent-rose)" />
                      </div>
                      <div className="arch-card__title">Demo Scenario: Autonomous Overheat Recovery</div>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: '8px',
                        padding: '4px 0',
                      }}
                    >
                      {[
                        { step: '1', label: 'Anomaly', desc: 'MOTOR-001 temp rises to 94°C', color: 'var(--accent-rose)' },
                        { step: '2', label: 'Detection', desc: 'ThresholdWorker catches >85°C', color: 'var(--accent-amber)' },
                        { step: '3', label: 'Root Cause', desc: 'Bearing lubrication degradation', color: 'var(--accent-purple)' },
                        { step: '4', label: 'Remediation', desc: 'RPM -50% + cooling cycle', color: 'var(--accent-cyan)' },
                        { step: '5', label: 'Recovery', desc: 'Temp drops to 64°C in 26s', color: 'var(--accent-emerald)' },
                      ].map((s) => (
                        <div
                          key={s.step}
                          style={{
                            background: 'var(--bg-inset)',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px',
                            borderLeft: `3px solid ${s.color}`,
                          }}
                        >
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.65rem',
                              color: s.color,
                              fontWeight: 700,
                              marginBottom: '4px',
                            }}
                          >
                            STEP {s.step}
                          </div>
                          <div
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              marginBottom: '2px',
                            }}
                          >
                            {s.label}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                            {s.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ═══ FOOTER ══════════════════════════════════════════════════════ */}
      <footer className="ops-footer">
        <span>
          SensorGuard · MongoDB × Datadog Hackathon 2026
        </span>
        <div className="ops-footer__links">
          <span className="mono" style={{ color: 'var(--text-muted)' }}>
            Updated: {lastRefreshed || '--:--:--'}
          </span>
        </div>
      </footer>
    </div>
  );
}
