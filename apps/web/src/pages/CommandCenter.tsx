import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Flame,
  AlertOctagon,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import {
  useEnvironmentalOverview,
  useWasteDistribution,
  useSeverityDistribution,
  useEventTimeline,
} from '../hooks/useIntelligence';
import { useEnvironmentalEvents } from '../hooks/useReports';
import { useHotspots } from '../hooks/useHotspots';
import { MetricCard } from '../components/common/MetricCard';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { EnvironmentalMap, MapMarkerItem } from '../components/map/EnvironmentalMap';
import { ChartRenderer } from '../components/charts/ChartRenderer';
import { EmptyState } from '../components/common/EmptyState';
import { ReportDetailPanel } from '../components/reports/ReportDetailPanel';
import { formatRelativeTime } from '../lib/formatters';
import type { ChartSpec } from '@ecopulse/types';

export const CommandCenter: React.FC = () => {
  const navigate = useNavigate();
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  // Real backend queries
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useEnvironmentalOverview();
  const { data: events, isLoading: eventsLoading } = useEnvironmentalEvents({ limit: 100 });
  const { data: hotspots } = useHotspots();
  const { data: wasteDistribution } = useWasteDistribution();
  const { data: severityDistribution } = useSeverityDistribution();
  const { data: timeline } = useEventTimeline(14);

  // Calculate resolution rate dynamically from API data
  const resolutionRate =
    overview && (overview.openReports + overview.resolvedIncidents > 0)
      ? `${Math.round((overview.resolvedIncidents / (overview.openReports + overview.resolvedIncidents)) * 100)}%`
      : '0%';

  // Critical events filter
  const criticalEvents = (events || []).filter((e) => {
    const sev = e.observation?.severity || (e as any).severity;
    return sev === 'CRITICAL' || sev === 'HIGH';
  });

  // Map markers aggregation
  const mapMarkers: MapMarkerItem[] = [];

  (events || []).forEach((e) => {
    mapMarkers.push({
      id: e.id,
      lat: e.latitude,
      lng: e.longitude,
      title: e.description,
      severity: e.observation?.severity || (e as any).severity || 'MEDIUM',
      wasteType: e.observation?.wasteType || (e as any).eventType || 'General Waste',
      status: e.status,
      isHotspot: false,
    });
  });

  (hotspots || []).forEach((h) => {
    mapMarkers.push({
      id: h.id,
      lat: h.centerLatitude,
      lng: h.centerLongitude,
      title: `Hotspot: ${h.dominantWasteType}`,
      severity: 'CRITICAL',
      wasteType: h.dominantWasteType,
      status: h.status,
      isHotspot: true,
      radius: h.radius,
    });
  });

  // Construct ChartSpec for Waste Distribution
  const wasteChartSpec: ChartSpec | null = wasteDistribution && wasteDistribution.length > 0 ? {
    type: 'bar',
    title: 'Waste Type Distribution',
    xAxis: 'Type',
    yAxis: 'Count',
    series: [
      {
        name: 'Reports',
        data: wasteDistribution.map((item) => ({ x: item.wasteType, y: item.count })),
      },
    ],
  } : null;

  // Construct ChartSpec for Severity Breakdown
  const severityChartSpec: ChartSpec | null = severityDistribution && severityDistribution.length > 0 ? {
    type: 'pie',
    title: 'Severity Breakdown',
    xAxis: 'Severity',
    yAxis: 'Count',
    series: [
      {
        name: 'Incidents',
        data: severityDistribution.map((item) => ({ x: item.severity, y: item.count })),
      },
    ],
  } : null;

  // Construct ChartSpec for Incident Timeline
  const timelineChartSpec: ChartSpec | null = timeline && timeline.length > 0 ? {
    type: 'line',
    title: 'Incident Velocity & Telemetry',
    xAxis: 'Timeline',
    yAxis: 'Incidents',
    series: [
      {
        name: 'Reported Events',
        data: timeline.map((pt: any, index: number) => {
          const rawDate = pt?.date || pt?.timestamp || pt?.created_at;
          let label = `Pt ${index + 1}`;
          if (rawDate) {
            try {
              const d = new Date(rawDate);
              label = isNaN(d.getTime()) ? String(rawDate).slice(0, 10) : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
            } catch {
              label = String(rawDate).slice(0, 10);
            }
          }
          const val = typeof pt?.count === 'number' ? pt.count : 1;
          return { x: label, y: val };
        }),
      },
    ],
  } : null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Environmental Operations
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              LIVE TELEMETRY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time environmental status, active clusters, and field operations across Pune Municipal Corporation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => refetchOverview()}
            className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
          </button>
          <button
            onClick={() => navigate('/operations/ai')}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950 transition-colors flex items-center space-x-1.5"
          >
            <span>Ask AI Operator</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top Operational Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Total Reports"
          value={overview?.totalEvents ?? (events?.length ?? 0)}
          icon={<FileText className="w-4 h-4 text-slate-400" />}
          loading={overviewLoading}
        />
        <MetricCard
          label="Active Hotspots"
          value={overview?.activeHotspots ?? (hotspots?.length ?? 0)}
          icon={<Flame className="w-4 h-4 text-slate-400" />}
          loading={overviewLoading}
        />
        <MetricCard
          label="Critical Events"
          value={criticalEvents.length}
          icon={<AlertOctagon className="w-4 h-4 text-amber-400" />}
          loading={eventsLoading}
        />
        <MetricCard
          label="Open Interventions"
          value={overview?.activeInterventions ?? 0}
          icon={<ShieldAlert className="w-4 h-4 text-slate-400" />}
          loading={overviewLoading}
        />
        <MetricCard
          label="Resolution Rate"
          value={resolutionRate}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          loading={overviewLoading}
        />
        <MetricCard
          label="Environmental Trend"
          value={overview?.dominantWasteType || 'Active'}
          icon={<TrendingUp className="w-4 h-4 text-slate-400" />}
          loading={overviewLoading}
        />
      </div>

      {/* Main Grid: Environmental Map & Critical Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Large Environmental Map */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Spatial Incident & Hotspot GIS Overlay
            </span>
            <button
              onClick={() => navigate('/operations/map')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-mono flex items-center space-x-1"
            >
              <span>Full View</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="h-[430px] rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
            <EnvironmentalMap
              markers={mapMarkers}
              center={[18.5204, 73.8567]}
              zoom={13}
              height="100%"
              onMarkerClick={(marker) => {
                const found = events?.find((e) => e.id === marker.id);
                if (found) setSelectedReport(found);
              }}
            />
          </div>
        </div>

        {/* Critical Events Feed */}
        <div className="flex flex-col h-[456px] bg-slate-950 rounded-lg border border-slate-800 p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
            <div className="flex items-center space-x-2">
              <AlertOctagon className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                Critical Events ({criticalEvents.length})
              </h3>
            </div>
            <button
              onClick={() => navigate('/operations/reports')}
              className="text-[11px] font-mono text-slate-400 hover:text-slate-200"
            >
              View All
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1">
            {criticalEvents.length === 0 ? (
              <EmptyState
                title="No critical events recorded"
                description="All environmental metrics in this jurisdiction are operating within nominal thresholds."
              />
            ) : (
              criticalEvents.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => setSelectedReport(evt)}
                  className="p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-md transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <SeverityBadge severity={evt.observation?.severity || (evt as any).severity || 'HIGH'} />
                    <span className="text-[10px] font-mono text-slate-400">
                      {formatRelativeTime(evt.timestamp)}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-slate-200 line-clamp-1">
                    {evt.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-slate-800/40 text-slate-400">
                    <span>{evt.observation?.wasteType || (evt as any).eventType || 'Waste Event'}</span>
                    <StatusBadge status={evt.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Analytical Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {wasteChartSpec ? (
          <ChartRenderer spec={wasteChartSpec} height={220} />
        ) : (
          <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-lg">
            <EmptyState title="No waste distribution telemetry" description="Awaiting telemetry records." />
          </div>
        )}

        {severityChartSpec ? (
          <ChartRenderer spec={severityChartSpec} height={220} />
        ) : (
          <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-lg">
            <EmptyState title="No severity telemetry" description="Awaiting telemetry records." />
          </div>
        )}

        {timelineChartSpec ? (
          <ChartRenderer spec={timelineChartSpec} height={220} />
        ) : (
          <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-lg">
            <EmptyState title="No timeline telemetry" description="Awaiting telemetry records." />
          </div>
        )}
      </div>

      {/* Selected Report Inspector Panel */}
      {selectedReport && (
        <ReportDetailPanel
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onInvestigateWithAI={(rep) => {
            navigate(`/operations/ai?query=Investigate event: ${encodeURIComponent(rep.description)}`);
          }}
          onCreateIntervention={(rep) => {
            navigate(`/operations/interventions?create=true&eventId=${rep.id}`);
          }}
        />
      )}
    </div>
  );
};
