import React, { useState } from 'react';
import {
  Camera,
  Maximize2,
  ExternalLink,
  ShieldCheck,
  MapPin,
  Calendar,
  Sparkles,
  X,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';
import { getEvidenceImageUrl, formatDate } from '../../lib/formatters';

interface EvidencePhotoCardProps {
  mediaUrl?: string | null;
  description?: string;
  timestamp?: string;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, any>;
  verificationStatus?: string;
}

export const EvidencePhotoCard: React.FC<EvidencePhotoCardProps> = ({
  mediaUrl,
  description,
  timestamp,
  latitude,
  longitude,
  metadata,
  verificationStatus = 'PENDING',
}) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const resolvedUrl = getEvidenceImageUrl(mediaUrl);
  const isS3 = resolvedUrl?.includes('amazonaws.com') || resolvedUrl?.includes('s3');
  const isLiveCapture = metadata?.isDeviceCapture ?? metadata?.source === 'LIVE_CAMERA_CAPTURE';

  if (!resolvedUrl) {
    return (
      <div className="rounded-xl border border-dashed border-emerald-900/40 bg-emerald-950/20 p-5 text-center">
        <div className="w-10 h-10 mx-auto rounded-full bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400 mb-2">
          <Camera className="w-5 h-5 opacity-60" />
        </div>
        <div className="text-xs font-mono font-medium text-slate-300">No Photo Evidence Attached</div>
        <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
          This incident was reported without photographic evidence or via automated telemetry.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-emerald-900/50 bg-gradient-to-b from-slate-900/90 to-slate-950 overflow-hidden shadow-lg shadow-black/40 group">
        {/* Card Header with Mobile EcoPulse Theme */}
        <div className="px-4 py-2.5 bg-emerald-950/50 border-b border-emerald-900/40 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-semibold">
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>CITIZEN EVIDENCE PHOTO</span>
            {isLiveCapture && (
              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                Live Camera
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            {isS3 ? (
              <span className="text-[10px] font-mono text-sky-400 bg-sky-950/50 px-2 py-0.5 rounded border border-sky-800/50">
                ☁️ AWS S3
              </span>
            ) : (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/50">
                ⚡ Secure Storage
              </span>
            )}
            <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
              ⭐ +20 Pts
            </span>
          </div>
        </div>

        {/* Image Preview Container */}
        <div className="relative aspect-video w-full bg-slate-950 overflow-hidden cursor-pointer" onClick={() => setIsLightboxOpen(true)}>
          {isLoading && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10">
              <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400">
                <span className="w-3 h-3 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                <span>Loading evidence...</span>
              </div>
            </div>
          )}

          {imageError ? (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center">
              <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
              <div className="text-xs text-slate-300 font-mono">Image preview unavailable</div>
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-2 text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-mono"
              >
                Open direct link <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <img
              src={resolvedUrl}
              alt={description || 'Environmental evidence photo'}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setImageError(true);
              }}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}

          {/* Hover Overlay with Zoom Icon */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
            <span className="text-[11px] font-mono text-white flex items-center gap-1.5 drop-shadow">
              <Maximize2 className="w-3.5 h-3.5" /> Click to inspect high-resolution
            </span>
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Metadata Footer */}
        <div className="p-3 bg-slate-900/60 border-t border-emerald-950 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
          <div className="flex items-center space-x-3 text-slate-300">
            {typeof latitude === 'number' && typeof longitude === 'number' && (
              <span className="flex items-center gap-1 text-slate-300">
                <MapPin className="w-3 h-3 text-emerald-400" />
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </span>
            )}
            {timestamp && (
              <span className="flex items-center gap-1 text-slate-400">
                <Calendar className="w-3 h-3 text-slate-500" />
                {formatDate(timestamp)}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                verificationStatus === 'VERIFIED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : verificationStatus === 'REJECTED'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {verificationStatus}
            </span>
          </div>
        </div>
      </div>

      {/* High-Resolution Inspection Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-fadeIn"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Lightbox Header */}
          <div className="flex items-center justify-between text-white shrink-0 mb-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center space-x-3 font-mono">
              <div className="w-8 h-8 rounded bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-sans">
                  {description || 'Environmental Report Evidence Inspection'}
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  High-Resolution Evidence Inspection • Verified Citizen Capture
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Full Raw
              </a>
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Image Preview */}
          <div
            className="flex-1 min-h-0 flex items-center justify-center overflow-auto p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={resolvedUrl}
              alt={description || 'Full Evidence'}
              className="max-h-full max-w-full object-contain rounded-lg border border-slate-800 shadow-2xl"
            />
          </div>

          {/* Lightbox Footer Info */}
          <div
            className="mt-3 p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 flex flex-wrap items-center justify-between gap-3 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-4">
              {typeof latitude === 'number' && typeof longitude === 'number' && (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <MapPin className="w-3.5 h-3.5" /> {latitude.toFixed(6)}°N, {longitude.toFixed(6)}°E
                </span>
              )}
              {timestamp && (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-3.5 h-3.5" /> {formatDate(timestamp)}
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-400 font-sans">
              Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-white">ESC</kbd> or click outside to dismiss
            </div>
          </div>
        </div>
      )}
    </>
  );
};
