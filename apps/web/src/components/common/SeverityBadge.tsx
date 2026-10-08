import React from 'react';

interface SeverityBadgeProps {
  severity?: string;
  size?: 'sm' | 'md';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity = 'LOW', size = 'sm' }) => {
  const s = severity.toUpperCase();

  const styles: Record<string, string> = {
    CRITICAL: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    HIGH: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    LOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };

  const currentStyle = styles[s] || styles.LOW;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded border ${padding} ${currentStyle}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {s}
    </span>
  );
};
