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
  RefreshCw,
  AlertCircle,
  Info,
} from 'lucide-react';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { EnvironmentalMap } from '../map/EnvironmentalMap';
import { formatDate, formatRelativeTime } from '../../lib/formatters';
import { apiFetch } from '../../lib/api';
import { EvidencePhotoCard } from './EvidencePhotoCard';
import { useEventDetails } from '../../hooks/useReports';

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
  const [isReprocessing, setIsReprocessing] = useState<boolean>(false);
  const [reprocessStatus, setReprocessStatus] = useState<string | null>(null);

  const { data: eventDetails, refetch: refetchEventDetails } = useEventDetails(report?.id || null);

  const handleReprocessAI = async () => {
    setIsReprocessing(true);
    setReprocessStatus(null);
    try {
      await apiFetch(`/api/intelligence/events/${report.id}/reprocess`, {
        method: 'POST',
      });
      setReprocessStatus('Vision AI re-analysis completed successfully.');
      await refetchEventDetails();
    } catch (err: any) {
      console.error('Failed to reprocess AI observation:', err);
      setReprocessStatus(err.message || 'Reprocessing failed');
    } finally {
      setIsReprocessing(false);
    }
  };

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
  const observation =
    report.observation ||
    report.aiObservation ||
    (eventDetails as any)?.aiObservation ||
    eventDetails?.observation;

  const rawMeta = observation?.rawMetadata || observation?.raw_metadata;
  const geminiData = rawMeta?.geminiAnalysis || (observation as any)?.geminiAnalysis;
  const eventStatus = (eventDetails as any)?.event?.status || report.status || currentStatus;

  const modelProvider =
    observation?.modelProvider ||
    observation?.model_provider ||
    (geminiData ? 'Google Gemini' : 'Vision AI Engine');

  const modelName =
    observation?.modelName ||
    observation?.model_name ||
    (geminiData ? 'gemini-2.5-flash-lite' : 'Autonomous Vision Agent');

  // Resolve mediaUrl from report object or fetched event details
  const mediaUrl =
    report.mediaUrl ||
    report.evidence?.[0]?.mediaUrl ||
    report.event?.mediaUrl ||
    eventDetails?.mediaUrl ||
    (eventDetails as any)?.evidence?.[0]?.mediaUrl;

  const evidenceMetadata =
    report.evidence?.[0]?.metadata ||
    (eventDetails as any)?.evidence?.[0]?.metadata ||
    report.metadata;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-slate-950 border-l border-emerald-900/30 shadow-2xl z-50 flex flex-col font-sans">
      {/* Top Bar with EcoPulse Emerald Theme */}
      <div className="h-14 px-5 border-b border-emerald-900/30 flex items-center justify-between shrink-0 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-950">
        <div className="flex items-center space-x-2.5">
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            🌲 INCIDENT INTELLIGENCE
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

        {/* 1. CITIZEN EVIDENCE PHOTO CARD (Maintainer Inspection) */}
        <div className="space-y-1.5">
          <EvidencePhotoCard
            mediaUrl={mediaUrl}
            description={report.description || report.title}
            timestamp={report.timestamp || report.createdAt}
            latitude={lat}
            longitude={lng}
            metadata={evidenceMetadata}
            verificationStatus={currentStatus}
          />
        </div>

        {/* AI Observation Section */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-emerald-900/30 space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-semibold">
              <Bot className="w-4 h-4" />
              <span>AI OBSERVATION SYNTHESIS</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                {modelProvider} • {modelName}
              </span>
              {observation?.confidence !== undefined && (
                <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {(observation.confidence * 100).toFixed(0)}% Confidence
                </span>
              )}
            </div>
          </div>

          {/* Warning / Review Required Banner */}
          {(eventStatus === 'REVIEW_REQUIRED' || geminiData?.requiresHumanReview) && (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-amber-300 flex items-center space-x-1.5">
                  <span>Human Verification Required</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Quality: {geminiData?.evidenceQuality || 'LOW'}
                  </span>
                </div>
                <div className="text-[11px] text-amber-200/80 leading-relaxed">
                  Evidence contains ambiguous items, occlusion, or reduced lighting. Automated observations are purely advisory; human review is required before scoring or dispatch.
                </div>
              </div>
            </div>
          )}

          {/* Failure Alert Banner */}
          {eventStatus === 'FAILED' && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-600/40 text-rose-200 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-rose-300">Vision Analysis Incomplete</div>
                <div className="text-[11px] text-rose-200/80 leading-relaxed">
                  The model encountered a timeout, rate limit, or image processing error. Maintainers can inspect the citizen photo and re-run analysis below.
                </div>
              </div>
            </div>
          )}

          {/* Reprocess message feedback */}
          {reprocessStatus && (
            <div className="p-2.5 rounded bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs flex items-center space-x-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{reprocessStatus}</span>
            </div>
          )}

          {/* Primary Structured Observation Attributes */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Waste Category</span>
              <span className="text-slate-200 font-medium">
                {geminiData?.wasteCategory || observation?.wasteType || report.wasteType || report.category || 'General Waste'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Visible Extent & Severity</span>
              <span className="text-slate-200 font-medium">
                {geminiData?.visibleSeverity || observation?.severity || 'MEDIUM'}
                {geminiData?.approximateExtent ? ` (${geminiData.approximateExtent.replace(/_/g, ' ').toLowerCase()})` : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Potential Obstruction</span>
              <span className="text-slate-200 font-medium">
                {geminiData?.potentialObstruction && geminiData.potentialObstruction !== 'NONE'
                  ? geminiData.potentialObstruction.replace(/_/g, ' ')
                  : 'No clear obstruction detected'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Evidence Quality</span>
              <span className={`font-medium ${geminiData?.evidenceQuality === 'HIGH' ? 'text-emerald-400' : geminiData?.evidenceQuality === 'LOW' || geminiData?.evidenceQuality === 'BLURRY_UNREADABLE' ? 'text-amber-400' : 'text-slate-200'}`}>
                {geminiData?.evidenceQuality || 'STANDARD'}
              </span>
            </div>
          </div>

          {/* Environmental Risk Indicators */}
          {geminiData?.environmentalRiskIndicators && geminiData.environmentalRiskIndicators.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-slate-400 block text-[10px] font-mono uppercase mb-1.5">
                Visible Environmental Risk Indicators
              </span>
              <div className="flex flex-wrap gap-1.5">
                {geminiData.environmentalRiskIndicators.map((risk: string, i: number) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20"
                  >
                    {risk.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Evidence Limitations / Uncertainties */}
          {geminiData?.limitations && geminiData.limitations.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-slate-400 block text-[10px] font-mono uppercase mb-1">
                Limitations & Uncertainties
              </span>
              <ul className="text-xs text-slate-400 list-disc list-inside space-y-0.5 font-mono text-[11px]">
                {geminiData.limitations.map((limit: string, idx: number) => (
                  <li key={idx} className="text-slate-300">{limit}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Action & Detailed Observations */}
          {(geminiData?.detailedObservations || observation?.recommendedAction) && (
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              {geminiData?.detailedObservations && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-mono uppercase mb-1">
                    Visual Findings
                  </span>
                  <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800 leading-relaxed">
                    {geminiData.detailedObservations}
                  </p>
                </div>
              )}
              {observation?.recommendedAction && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-mono uppercase mb-1">
                    Recommended Action (Advisory)
                  </span>
                  <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800 font-mono">
                    {observation.recommendedAction}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Maintainer Reprocessing Control Bar */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500">
              Responsible AI: Advisory only. Maintainer verification required.
            </span>
            <button
              onClick={handleReprocessAI}
              disabled={isReprocessing}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1.5 transition-colors border border-emerald-900/50 shadow-sm"
              title="Re-run Gemini Vision analysis on this evidence image"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReprocessing ? 'animate-spin' : ''}`} />
              <span>{isReprocessing ? 'Analyzing...' : 'Re-run AI Analysis'}</span>
            </button>
          </div>
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
