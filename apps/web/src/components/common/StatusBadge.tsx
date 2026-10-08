import React from 'react';

interface StatusBadgeProps {
  status?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status = 'ACTIVE', size = 'sm' }) => {
  const normalized = status.toUpperCase().replace(/\s+/g, '_');

  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    REPORTED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    ANALYZED: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    VERIFIED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    UNDER_INVESTIGATION: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    CRITICAL: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    EMERGING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    STABLE: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    IMPROVING: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    DRAFT: 'bg-slate-600/10 text-slate-400 border-slate-600/30',
    APPROVED: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    IN_PROGRESS: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    RESOLVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };

  const currentStyle = styles[normalized] || 'bg-slate-700/20 text-slate-300 border-slate-700/40';
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span className={`inline-flex items-center font-mono font-medium rounded border ${padding} ${currentStyle}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};
