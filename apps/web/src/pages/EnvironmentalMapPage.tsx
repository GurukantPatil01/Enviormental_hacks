import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Filter,
  Eye,
  EyeOff,
  Flame,
  FileText,
  ShieldAlert,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { EnvironmentalMap, MapMarkerItem } from '../components/map/EnvironmentalMap';
import { useEnvironmentalEvents } from '../hooks/useReports';
import { useHotspots } from '../hooks/useHotspots';
import { useInterventions } from '../hooks/useInterventions';
import { ReportDetailPanel } from '../components/reports/ReportDetailPanel';
import { SeverityBadge } from '../components/common/SeverityBadge';

export const EnvironmentalMapPage: React.FC = () => {
  const navigate = useNavigate();

  // Filter state
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedWasteType, setSelectedWasteType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Layer toggles
  const [showReports, setShowReports] = useState<boolean>(true);
  const [showHotspots, setShowHotspots] = useState<boolean>(true);
  const [showInterventions, setShowInterventions] = useState<boolean>(true);

  // Inspector state
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  // Fetch real data
  const { data: events, isLoading: eventsLoading } = useEnvironmentalEvents({ limit: 200 });
  const { data: hotspots, isLoading: hotspotsLoading } = useHotspots();
  const { data: interventions } = useInterventions();

  // Filter events
  const filteredEvents = (events || []).filter((e) => {
    const sev = e.observation?.severity || (e as any).severity || 'MEDIUM';
    const waste = e.observation?.wasteType || (e as any).eventType || 'General Waste';
    if (selectedSeverity !== 'ALL' && sev !== selectedSeverity) return false;
    if (selectedWasteType !== 'ALL' && waste !== selectedWasteType) return false;
    if (selectedStatus !== 'ALL' && e.status !== selectedStatus) return false;
    return true;
  });

  // Unique waste types from data
  const wasteTypes = Array.from(
    new Set((events || []).map((e) => e.observation?.wasteType || (e as any).eventType).filter(Boolean))
  );

  // Build markers
  const markers: MapMarkerItem[] = [];

  if (showReports) {
    filteredEvents.forEach((e) => {
      markers.push({
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
  }

  if (showHotspots) {
    (hotspots || []).forEach((h) => {
      markers.push({
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
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] space-y-3 font-sans">
      {/* Control Strip */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        {/* Layer Toggles */}
        <div className="flex items-center space-x-2">
          <span className="font-mono text-[10px] uppercase text-slate-400 mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            Layers:
          </span>

          <button
            onClick={() => setShowReports(!showReports)}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors flex items-center space-x-1.5 border ${
              showReports
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Reports ({filteredEvents.length})</span>
          </button>

          <button
            onClick={() => setShowHotspots(!showHotspots)}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors flex items-center space-x-1.5 border ${
              showHotspots
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span>Hotspots ({hotspots?.length || 0})</span>
          </button>

          <button
            onClick={() => setShowInterventions(!showInterventions)}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors flex items-center space-x-1.5 border ${
              showInterventions
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            <span>Interventions ({interventions?.length || 0})</span>
          </button>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center space-x-2 font-mono">
          <span className="text-[10px] uppercase text-slate-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Filter:
          </span>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-slate-700"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={selectedWasteType}
            onChange={(e) => setSelectedWasteType(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-slate-700 max-w-[140px] truncate"
          >
            <option value="ALL">All Categories</option>
            {wasteTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-slate-700"
          >
            <option value="ALL">All Status</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="VERIFIED">Verified</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      {/* Full Viewport Map */}
      <div className="flex-1 relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
        <EnvironmentalMap
          markers={markers}
          center={[18.5204, 73.8567]}
          zoom={13}
          height="100%"
          onMarkerClick={(marker) => {
            if (marker.isHotspot) {
              navigate(`/operations/hotspots?id=${marker.id}`);
            } else {
              const found = events?.find((e) => e.id === marker.id);
              if (found) setSelectedReport(found);
            }
          }}
        />

        {/* Floating Legend / Telemetry Info */}
        <div className="absolute bottom-4 left-4 z-[400] bg-slate-950/90 border border-slate-800 p-3 rounded-lg shadow-xl backdrop-blur font-mono text-[11px] space-y-1.5 pointer-events-auto">
          <div className="text-slate-400 font-bold uppercase text-[9px] mb-1">Active Map Telemetry</div>
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>Critical Incident / Active Hotspot</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>High Severity Hazard</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Medium / Routine Waste</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Low / Resolved Action</span>
          </div>
        </div>
      </div>

      {/* Selected Report Detail Slide-Over */}
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
