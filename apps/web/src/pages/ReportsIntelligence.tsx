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
} from 'lucide-react';
import { useEnvironmentalEvents } from '../hooks/useReports';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { ReportDetailPanel } from '../components/reports/ReportDetailPanel';
import { EmptyState } from '../components/common/EmptyState';
import { formatDate, formatRelativeTime } from '../lib/formatters';

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
  const { data: events, isLoading, refetch } = useEnvironmentalEvents({ limit: 150 });

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

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Reports Intelligence
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {filteredEvents.length} RECORDS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dense technical review of citizen and sensor telemetry with autonomous vision classification.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search descriptions, waste types, locations..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-slate-700"
          />
        </div>

        {/* Filter controls */}
        <div className="flex items-center space-x-2 font-mono">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-slate-700"
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
            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-slate-700 max-w-[150px] truncate"
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
            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="VERIFIED">Verified</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      {/* Dense Technical Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-slate-400">
            Querying environmental report telemetry...
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
              <thead className="bg-slate-900/90 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                <tr>
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
                {filteredEvents.map((evt) => (
                  <tr
                    key={evt.id}
                    onClick={() => setSelectedReport(evt)}
                    className="hover:bg-slate-900/50 transition-colors cursor-pointer group"
                  >
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

                    <td className="py-3 px-4 text-slate-300">
                      <span className="text-slate-200">
                        {evt.observation?.wasteType || (evt as any).eventType || 'General Waste'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <SeverityBadge severity={evt.observation?.severity || (evt as any).severity || 'MEDIUM'} />
                    </td>

                    <td className="py-3 px-4 text-slate-400">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>
                          {evt.latitude?.toFixed(4)}, {evt.longitude?.toFixed(4)}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {evt.observation?.confidence !== undefined ? (
                        <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 text-[10px]">
                          {(evt.observation.confidence * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <StatusBadge status={evt.status} />
                    </td>

                    <td className="py-3 px-4 text-slate-400">
                      {formatRelativeTime(evt.timestamp)}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReport(evt);
                        }}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
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
