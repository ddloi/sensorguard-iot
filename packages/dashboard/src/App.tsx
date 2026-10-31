import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DashboardHeader, LatestEventFeed } from './components/DashboardHeader';
import { DeviceSidebar } from './components/DeviceSidebar';
import {
  DashboardHeading,
  DataStatusBanner,
  SummaryStrip,
  DemoGuide,
} from './components/OperationsOverview';
import { DashboardNavigation, DashboardFooter } from './components/DashboardChrome';
import { ArchitectureView } from './features/architecture/ArchitectureView';
import { IncidentsView } from './features/incidents/IncidentsView';
import { TelemetryView } from './features/telemetry/TelemetryView';
import { useDashboardData } from './hooks/useDashboardData';
import { useIncidentActions } from './hooks/useIncidentActions';
import { useTheme } from './hooks/useTheme';
import type { View } from './types/domain';

/** The application entry composes presentation; hooks own data and actions. */
export default function App() {
  const [activeTab, setActiveTab] = useState<View>('fleet');
  const dashboard = useDashboardData();
  const { theme, toggleTheme } = useTheme();
  const actions = useIncidentActions({
    incidents: dashboard.incidents,
    now: dashboard.now,
    ready: dashboard.ready,
    refresh: dashboard.refresh,
    onDemoStarted: () => {
      dashboard.setSelectedDevice('MOTOR-001');
      setActiveTab('incidents');
    },
  });
  const selectDevice = (id: string) => {
    dashboard.setSelectedDevice(id);
    setActiveTab('fleet');
  };
  const refresh = () => void dashboard.refresh();

  return (
    <div className="ops-center">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <DashboardHeader
        theme={theme}
        health={dashboard.health}
        errors={dashboard.errors}
        stale={dashboard.stale}
        loaded={dashboard.loaded}
        wsConnected={dashboard.wsConnected}
        isRefreshing={dashboard.isRefreshing}
        onToggleTheme={toggleTheme}
        onRefresh={refresh}
      />
      <LatestEventFeed error={dashboard.errors.incidents} event={dashboard.newestEvent} />
      <div className="ops-grid">
        <DeviceSidebar
          devices={dashboard.devices}
          loaded={dashboard.loaded}
          errors={dashboard.errors}
          selectedDevice={dashboard.selectedDevice}
          health={dashboard.health}
          now={dashboard.now}
          onSelectDevice={selectDevice}
        />
        <main className="ops-main" id="main-content" tabIndex={-1}>
          <DashboardHeading lastRefreshed={dashboard.lastRefreshed} stale={dashboard.stale} />
          <DataStatusBanner
            errors={dashboard.errors}
            stale={dashboard.stale}
            health={dashboard.health}
            isRefreshing={dashboard.isRefreshing}
            onRefresh={refresh}
          />
          <SummaryStrip
            devices={dashboard.devices}
            now={dashboard.now}
            loaded={dashboard.loaded}
            errors={dashboard.errors}
            stale={dashboard.stale}
            activeCount={dashboard.activeIncidents.length}
            resolvedCount={dashboard.resolvedIncidents.length}
          />
          <DemoGuide
            ready={dashboard.ready}
            disabled={actions.demoDisabled}
            sending={actions.sending}
            running={actions.demoRunning}
            motorActive={actions.motorActive}
            onTrigger={() => void actions.triggerDemo()}
          />
          {actions.demoMessage && (
            <div
              className={`demo-feedback demo-feedback--${actions.demoMessage.error ? 'error' : 'success'}`}
              role="status"
            >
              {actions.demoMessage.error ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
              <span>{actions.demoMessage.text}</span>
            </div>
          )}
          <DashboardNavigation
            activeTab={activeTab}
            incidentCount={dashboard.incidents.length}
            onSelectView={setActiveTab}
          />
          {activeTab === 'fleet' && (
            <TelemetryView
              devices={dashboard.devices}
              selectedDevice={dashboard.selectedDevice}
              selected={dashboard.selected}
              loaded={dashboard.loaded}
              timeSeries={dashboard.timeSeries}
              errors={dashboard.errors}
              now={dashboard.now}
              onSelectDevice={dashboard.setSelectedDevice}
            />
          )}
          {activeTab === 'incidents' && (
            <IncidentsView
              incidents={dashboard.incidents}
              errors={dashboard.errors}
              rechecking={actions.rechecking}
              health={dashboard.health}
              stale={dashboard.stale}
              recheckMessages={actions.recheckMessages}
              onRecheck={(id) => void actions.recheckRecovery(id)}
            />
          )}
          {activeTab === 'architecture' && <ArchitectureView />}
        </main>
      </div>
      <DashboardFooter health={dashboard.health} wsConnected={dashboard.wsConnected} />
    </div>
  );
}
