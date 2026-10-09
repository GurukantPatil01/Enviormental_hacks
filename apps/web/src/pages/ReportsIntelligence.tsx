import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  FileText,
  MapPin,
  Calendar,
  Eye,
  Bot,
  AlertTriangle,
  RefreshCw,
  Camera,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { useEnvironmentalEvents } from '../hooks/useReports';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { ReportDetailPanel } from '../components/reports/ReportDetailPanel';
import { EmptyState } from '../components/common/EmptyState';
import { formatDate, formatRelativeTime, getEvidenceImageUrl } from '../lib/formatters';

export const ReportsIntelligence: React.FC = () => {
  const navigate = useNavigate();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [wasteTypeFilter, setWasteTypeFilter] = useState('ALL');

  // Inspector state
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  // Real backend query
  const { data: events, isLoading, refetch, isRefetching } = useEnvironmentalEvents({ limit: 150 });

  // Filter computation
  const filteredEvents = (events || []).filter((e) => {
    const eventSeverity = e.observation?.severity || (e as any).severity || 'MEDIUM';
    const eventWasteType = e.observation?.wasteType || (e as any).eventType || 'General Waste';

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchDesc = e.description?.toLowerCase().includes(q);
      const matchType = eventWasteType.toLowerCase().includes(q);
      const matchStatus = e.status?.toLowerCase().includes(q);
      if (!matchDesc && !matchType && !matchStatus) return false;
    }

    if (severityFilter !== 'ALL' && eventSeverity !== severityFilter) return false;
    if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
    if (wasteTypeFilter !== 'ALL' && eventWasteType !== wasteTypeFilter) return false;

    return true;
  });

  const availableWasteTypes = Array.from(
    new Set((events || []).map((e) => e.observation?.wasteType || (e as any).eventType).filter(Boolean))
  );

  // Summary statistics matching mobile app telemetry cards
  const totalReportsCount = events?.length || 0;
  const verifiedCount = events?.filter((e) => e.status === 'VERIFIED').length || 0;
  const resolvedCount = events?.filter((e) => e.status === 'RESOLVED').length || 0;
  const withPhotoCount = events?.filter((e) => Boolean(e.mediaUrl || (e as any).evidence?.[0]?.mediaUrl)).length || 0;

  return (
    <div className="space-y-5 font-sans">
      {/* Header Banner - EcoPulse Theme */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-emerald-950/60 via-slate-900/80 to-slate-950 p-4 sm:p-5 rounded-2xl border border-emerald-900/40 shadow-lg">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Reports Intelligence
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                {filteredEvents.length} RECORDS
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-300 mt-1 pl-10 max-w-2xl leading-relaxed">
            Maintainer review portal for citizen reports, geo-tagged photographic evidence, and autonomous AI vision observations.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-xs font-mono text-emerald-300 hover:text-white hover:bg-emerald-900/60 transition-all flex items-center space-x-2 self-start sm:self-auto shadow-sm active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin text-emerald-400' : ''}`} />
          <span>{isRefetching ? 'Refreshing...' : 'Refresh Telemetry'}</span>
        </button>
      </div>

      {/* Telemetry Metric Cards matching Mobile UI (EcoPoints, Photo Evidence, Verified, Resolved) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Citizen Reports */}
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center space-x-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Total Reports</div>
            <div className="text-lg font-bold text-white font-mono">{totalReportsCount}</div>
            <div className="text-[10px] text-emerald-400 font-mono">Citizen & Sensor Feeds</div>
          </div>
        </div>

        {/* Photo Evidence Coverage */}
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center space-x-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Photo Evidence</div>
            <div className="text-lg font-bold text-white font-mono">{withPhotoCount}</div>
            <div className="text-[10px] text-sky-400 font-mono">
              {totalReportsCount > 0 ? `${Math.round((withPhotoCount / totalReportsCount) * 100)}% Photo Coverage` : 'No photos yet'}
            </div>
          </div>
        </div>

        {/* Verified & Rewarded */}
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center space-x-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Verified Reports</div>
            <div className="text-lg font-bold text-white font-mono">{verifiedCount}</div>
            <div className="text-[10px] text-amber-400 font-mono">⭐ EcoPoints Awarded</div>
          </div>
        </div>

        {/* Resolved Incidents */}
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center space-x-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Resolved Incidents</div>
            <div className="text-lg font-bold text-white font-mono">{resolvedCount}</div>
            <div className="text-[10px] text-emerald-400 font-mono">Field Action Complete</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3 bg-slate-900/80 border border-emerald-950/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search descriptions, waste types, locations..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
          />
        </div>

        {/* Filter controls */}
        <div className="flex items-center space-x-2 font-mono">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500/50"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={wasteTypeFilter}
            onChange={(e) => setWasteTypeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500/50 max-w-[150px] truncate"
          >
            <option value="ALL">All Waste Types</option>
            {availableWasteTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500/50"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="VERIFIED">Verified</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      {/* Dense Technical Table with Photo Preview */}
      <div className="bg-slate-950 border border-emerald-950/60 rounded-xl overflow-hidden shadow-lg shadow-black/20">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-emerald-400 flex items-center justify-center space-x-2">
            <span className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <span>Querying environmental report telemetry & evidence...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No environmental events match criteria"
              description="Adjust the filter parameters or wait for incoming sensor/citizen reports."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-900/90 text-slate-400 font-mono text-[10px] uppercase border-b border-emerald-950/80">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-center w-12">Evidence</th>
                  <th className="py-2.5 px-4 font-semibold">Incident Ref</th>
                  <th className="py-2.5 px-4 font-semibold">Waste Category</th>
                  <th className="py-2.5 px-4 font-semibold">Severity</th>
                  <th className="py-2.5 px-4 font-semibold">Location (Geo)</th>
                  <th className="py-2.5 px-4 font-semibold">AI Confidence</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold">Detected</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {filteredEvents.map((evt) => {
                  const rawUrl = evt.mediaUrl || (evt as any).evidence?.[0]?.mediaUrl;
                  const photoUrl = getEvidenceImageUrl(rawUrl);

                  return (
                    <tr
                      key={evt.id}
                      onClick={() => setSelectedReport(evt)}
                      className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                    >
                      {/* Photo Thumbnail Column */}
                      <td className="py-2.5 px-3 text-center">
                        {photoUrl ? (
                          <div className="w-9 h-9 mx-auto rounded-lg overflow-hidden border border-emerald-900/50 bg-slate-900 relative group/thumb shadow-sm">
                            <img
                              src={photoUrl}
                              alt="Evidence"
                              className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-200"
                              onError={(e) => {
                                // Fallback icon on broken image
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-9 h-9 mx-auto rounded-lg border border-dashed border-slate-800 bg-slate-900/50 flex items-center justify-center text-slate-400">
                            <Camera className="w-4 h-4 opacity-40" />
                          </div>
                        )}
                      </td>

                      {/* Incident Ref */}
                      <td className="py-3 px-4 text-slate-300">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-200 font-sans truncate max-w-[200px]" title={evt.description}>
                            {evt.description}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          ID: {evt.id.slice(0, 8)}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-slate-300">
                        <span className="text-slate-200 font-sans">
                          {evt.observation?.wasteType || (evt as any).eventType || 'General Waste'}
                        </span>
                      </td>

                      {/* Severity */}
                      <td className="py-3 px-4">
                        <SeverityBadge severity={evt.observation?.severity || (evt as any).severity || 'MEDIUM'} />
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4 text-slate-400">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          <span>
                            {evt.latitude?.toFixed(4)}, {evt.longitude?.toFixed(4)}
                          </span>
                        </div>
                      </td>

                      {/* AI Confidence */}
                      <td className="py-3 px-4">
                        {evt.observation?.confidence !== undefined ? (
                          <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 text-[10px] font-bold">
                            {(evt.observation.confidence * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge status={evt.status} />
                      </td>

                      {/* Detected */}
                      <td className="py-3 px-4 text-slate-400">
                        {formatRelativeTime(evt.timestamp)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReport(evt);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 text-emerald-300 hover:text-white transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Slide-Over */}
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
