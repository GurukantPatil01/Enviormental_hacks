import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Flame,
  TrendingUp,
  AlertTriangle,
  MapPin,
  Calendar,
  Layers,
  ShieldAlert,
  ArrowRight,
  Clock,
  Zap,
} from 'lucide-react';
import { useHotspots, useHotspotDetails, Hotspot } from '../hooks/useHotspots';
import { EnvironmentalMap, MapMarkerItem } from '../components/map/EnvironmentalMap';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatDate, formatRelativeTime } from '../lib/formatters';

export const HotspotIntelligence: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialId = searchParams.get('id');

  const { data: hotspots, isLoading } = useHotspots();
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(initialId);

  // Active selected hotspot
  const activeHotspot =
    hotspots?.find((h) => h.id === selectedHotspotId) || hotspots?.[0] || null;

  const { data: hotspotDetails } = useHotspotDetails(activeHotspot?.id || null);

  // Prepare map markers for selected hotspot
  const markers: MapMarkerItem[] = [];

  if (activeHotspot) {
    markers.push({
      id: activeHotspot.id,
      lat: activeHotspot.centerLatitude,
      lng: activeHotspot.centerLongitude,
      title: `Cluster: ${activeHotspot.dominantWasteType}`,
      severity: 'CRITICAL',
      wasteType: activeHotspot.dominantWasteType,
      status: activeHotspot.status,
      isHotspot: true,
      radius: activeHotspot.radius,
    });

    // Sub-events if available
    (hotspotDetails?.events || []).forEach((e) => {
      markers.push({
        id: e.id,
        lat: e.latitude,
        lng: e.longitude,
        title: e.description,
        severity: e.severity || 'HIGH',
        status: 'INCIDENT',
        isHotspot: false,
      });
    });
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" />
            Hotspot Intelligence & Cluster Telemetry
          </h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {hotspots?.length || 0} ACTIVE CLUSTERS
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Automated spatial clustering algorithm identifying persistent environmental hazards across Pune zones.
        </p>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs font-mono text-slate-400">
          Loading algorithmic hotspot clusters...
        </div>
      ) : !hotspots || hotspots.length === 0 ? (
        <EmptyState
          title="No active hotspots detected"
          description="Algorithmic clustering requires multiple proximate environmental events. Currently no recurring clusters meet threshold."
        />
      ) : (
        /* Split Two-Panel Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-12rem)]">
          {/* Left Panel: Ranked Hotspot List */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-lg flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                Ranked Hotspot Clusters
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                BY RISK SCORE
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {hotspots.map((hs, index) => {
                const isSelected = activeHotspot?.id === hs.id;
                return (
                  <div
                    key={hs.id}
                    onClick={() => setSelectedHotspotId(hs.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer font-sans ${
                      isSelected
                        ? 'bg-slate-900 border-emerald-500/50 text-slate-100 shadow-sm'
                        : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-900 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-mono text-slate-300 flex items-center justify-center font-bold">
                          #{index + 1}
                        </span>
                        <span className="font-semibold text-xs text-white">
                          {hs.dominantWasteType || 'Hazard Cluster'}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-200 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                        Score {hs.score ? hs.score.toFixed(1) : '85.0'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
                      <div>
                        <span className="block text-[9px] uppercase text-slate-400">Incidents</span>
                        <span className="text-slate-200 font-semibold">{hs.reportCount}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase text-slate-400">Radius</span>
                        <span className="text-slate-200">{hs.radius}m</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase text-slate-400">Trend</span>
                        <span
                          className={`font-semibold ${
                            hs.trend === 'EMERGING' || hs.trend === 'CRITICAL'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {hs.trend || 'ACTIVE'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Selected Hotspot Details & Map */}
          {activeHotspot && (
            <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-lg flex flex-col overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-bold text-white">
                      {activeHotspot.dominantWasteType} Hotspot Zone
                    </h2>
                    <StatusBadge status={activeHotspot.status} />
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center space-x-3">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {activeHotspot.centerLatitude.toFixed(4)}, {activeHotspot.centerLongitude.toFixed(4)}
                    </span>
                    <span>Radius: {activeHotspot.radius}m</span>
                    <span>First Detected: {formatRelativeTime(activeHotspot.firstDetectedAt)}</span>
                  </div>
                </div>

                <button
                  onClick={() =>
                    navigate(
                      `/operations/interventions?create=true&hotspotId=${activeHotspot.id}&type=${activeHotspot.dominantWasteType}`
                    )
                  }
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm flex items-center space-x-1.5 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Deploy Intervention</span>
                </button>
              </div>

              {/* Map View */}
              <div className="h-64 border-b border-slate-800">
                <EnvironmentalMap
                  markers={markers}
                  center={[activeHotspot.centerLatitude, activeHotspot.centerLongitude]}
                  zoom={15}
                  height="100%"
                />
              </div>

              {/* Sub-Details & Interventions Tab */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="grid grid-cols-4 gap-3 font-mono text-xs">
                  <div className="p-2.5 bg-slate-900/50 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-400 block uppercase">Composite Score</span>
                    <span className="text-rose-400 font-bold text-sm">
                      {activeHotspot.score ? activeHotspot.score.toFixed(1) : '85.0'} / 100
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900/50 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-400 block uppercase">Total Incidents</span>
                    <span className="text-slate-100 font-bold text-sm">
                      {activeHotspot.reportCount}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900/50 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-400 block uppercase">Avg Severity</span>
                    <span className="text-amber-400 font-bold text-sm">
                      {activeHotspot.averageSeverity ? activeHotspot.averageSeverity.toFixed(1) : '3.5'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900/50 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-400 block uppercase">Trajectory</span>
                    <span className="text-slate-100 font-bold text-sm">
                      {activeHotspot.trend || 'PERSISTENT'}
                    </span>
                  </div>
                </div>

                {/* Associated Interventions */}
                <div className="space-y-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
                    Intervention History for this Cluster
                  </span>

                  {(hotspotDetails?.interventions || []).length === 0 ? (
                    <div className="p-4 bg-slate-900/30 border border-slate-800/80 rounded text-center text-xs text-slate-400 font-mono">
                      No field interventions deployed to this cluster yet. Recommend dispatching clean-up or monitoring crew.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {hotspotDetails?.interventions.map((inv) => (
                        <div
                          key={inv.id}
                          className="p-3 bg-slate-900/60 border border-slate-800 rounded flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-200">{inv.type}</span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              Created: {formatDate(inv.createdAt)}
                            </span>
                          </div>
                          <StatusBadge status={inv.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
