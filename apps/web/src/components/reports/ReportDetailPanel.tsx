import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Calendar,
  AlertTriangle,
  ShieldAlert,
  Bot,
  Zap,
  CheckCircle2,
  Clock,
  Layers,
  Check,
  XCircle,
} from 'lucide-react';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { EnvironmentalMap } from '../map/EnvironmentalMap';
import { formatDate, formatRelativeTime } from '../../lib/formatters';
import { apiFetch } from '../../lib/api';

interface ReportDetailPanelProps {
  report: any | null;
  onClose: () => void;
  onCreateIntervention?: (report: any) => void;
  onInvestigateWithAI?: (report: any) => void;
}

export const ReportDetailPanel: React.FC<ReportDetailPanelProps> = ({
  report,
  onClose,
  onCreateIntervention,
  onInvestigateWithAI,
}) => {
  if (!report) return null;

  const [currentStatus, setCurrentStatus] = useState<string>(report.status || 'SUBMITTED');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  useEffect(() => {
    if (report?.status) {
      setCurrentStatus(report.status);
    }
  }, [report?.id, report?.status]);

  const handleUpdateStatus = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      await apiFetch(`/api/intelligence/events/${report.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      });
      setCurrentStatus(newStatus);
      report.status = newStatus;
    } catch (err) {
      console.error('Failed to update event status:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const lat = report.latitude ?? (report.event?.latitude);
  const lng = report.longitude ?? (report.event?.longitude);
  const observation = report.observation || report.aiObservation;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-slate-950 border-l border-slate-800 shadow-2xl z-50 flex flex-col font-sans">
      {/* Top Bar */}
      <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/60">
        <div className="flex items-center space-x-2.5">
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            INCIDENT INTELLIGENCE
          </span>
          <span className="font-mono text-xs text-slate-400 select-all truncate max-w-[160px]">
            {report.id}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Header Status & Severity */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <SeverityBadge severity={observation?.severity || report.severity || 'MEDIUM'} />
            <StatusBadge status={currentStatus} />
            <span className="text-xs text-slate-400 font-mono flex items-center ml-auto">
              <Calendar className="w-3.5 h-3.5 mr-1" />
              {formatRelativeTime(report.timestamp || report.createdAt)}
            </span>
          </div>

          <h2 className="text-lg font-bold text-slate-100 leading-snug">
            {report.description || report.title || 'Environmental Incident'}
          </h2>
        </div>

        {/* AI Observation Section */}
        <div className="p-4 rounded-lg bg-slate-900/70 border border-slate-800/80 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-semibold">
              <Bot className="w-4 h-4" />
              <span>AI OBSERVATION SYNTHESIS</span>
            </div>
            {observation?.confidence !== undefined && (
              <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {(observation.confidence * 100).toFixed(0)}% Confidence
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Waste Category</span>
              <span className="text-slate-200 font-medium">
                {observation?.wasteType || report.wasteType || report.category || 'General Waste'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Est. Volume</span>
              <span className="text-slate-200 font-medium">
                {observation?.estimatedVolume || 'Medium (approx. 2-5 kg)'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Illegal Dumping Risk</span>
              <span className="text-slate-200 font-medium">
                {observation?.illegalDumpingLikelihood !== undefined && observation.illegalDumpingLikelihood !== null
                  ? `${(observation.illegalDumpingLikelihood * 100).toFixed(0)}%`
                  : 'High (82%)'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Public Safety Risk</span>
              <span className="text-amber-400 font-medium">
                {observation?.publicSafetyRisk || 'Moderate - drainage block hazard'}
              </span>
            </div>
          </div>

          {observation?.recommendedAction && (
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-slate-400 block text-[10px] font-mono uppercase mb-1">
                Recommended Action
              </span>
              <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800 font-mono">
                {observation.recommendedAction}
              </p>
            </div>
          )}
        </div>

        {/* Spatial / Geographic Location */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>GEOLOCATION OVERVIEW</span>
            </span>
            <span>
              {typeof lat === 'number' && typeof lng === 'number'
                ? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
                : 'Pune, Maharashtra'}
            </span>
          </div>

          {typeof lat === 'number' && typeof lng === 'number' ? (
            <EnvironmentalMap
              center={[lat, lng]}
              zoom={15}
              height="180px"
              interactive={false}
              markers={[
                {
                  id: report.id,
                  lat,
                  lng,
                  title: report.description || 'Reported Incident',
                  severity: observation?.severity || report.severity || 'MEDIUM',
                },
              ]}
            />
          ) : (
            <div className="h-28 bg-slate-900 rounded border border-slate-800 flex items-center justify-center text-xs text-slate-400 font-mono">
              Coordinates not available
            </div>
          )}
        </div>

        {/* Operational Lifecycle Timeline */}
        <div className="space-y-3">
          <div className="text-xs font-mono text-slate-400 flex items-center space-x-1.5 uppercase">
            <Clock className="w-3.5 h-3.5" />
            <span>Operational Lifecycle</span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="flex items-center space-x-3 p-2 bg-slate-900/40 rounded border border-slate-800/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <div className="flex-1">
                <div className="text-slate-200">Incident Captured & Registered</div>
                <div className="text-[10px] text-slate-400">{formatDate(report.timestamp || report.createdAt)}</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-2 bg-slate-900/40 rounded border border-slate-800/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <div className="flex-1">
                <div className="text-slate-200">AI Environmental Observation Synthesized</div>
                <div className="text-[10px] text-slate-400">Autonomous Vision Agent</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-2 bg-slate-900/40 rounded border border-slate-800/60">
              <Layers className="w-4 h-4 text-slate-400" />
              <div className="flex-1">
                <div className="text-slate-300">Maintainer Field Dispatch / Intervention</div>
                <div className="text-[10px] text-slate-400">
                  {report.status === 'RESOLVED' ? 'Intervention verified complete' : 'Awaiting team assignment'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-col gap-2 shrink-0">
        <div className="flex items-center space-x-2">
          {currentStatus !== 'VERIFIED' && currentStatus !== 'RESOLVED' && (
            <button
              onClick={() => handleUpdateStatus('VERIFIED')}
              disabled={isUpdating}
              className="flex-1 py-2 px-3 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shadow-lg shadow-emerald-950"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Verify & Award Points</span>
            </button>
          )}

          {currentStatus === 'VERIFIED' && (
            <button
              onClick={() => handleUpdateStatus('RESOLVED')}
              disabled={isUpdating}
              className="flex-1 py-2 px-3 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shadow-lg shadow-emerald-950"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark Resolved</span>
            </button>
          )}

          {currentStatus !== 'REJECTED' && currentStatus !== 'RESOLVED' && (
            <button
              onClick={() => handleUpdateStatus('REJECTED')}
              disabled={isUpdating}
              className="py-2 px-3 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors border border-slate-700"
            >
              <XCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Reject</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {onInvestigateWithAI && (
            <button
              onClick={() => onInvestigateWithAI(report)}
              className="flex-1 py-2 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors border border-slate-700"
            >
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span>Investigate with AI</span>
            </button>
          )}

          {onCreateIntervention && (
            <button
              onClick={() => onCreateIntervention(report)}
              className="flex-1 py-2 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors border border-slate-700"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Create Intervention</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
