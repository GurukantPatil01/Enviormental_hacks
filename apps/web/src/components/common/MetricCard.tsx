import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  loading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  badge,
  icon,
  loading,
}) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between hover:border-slate-700/80 transition-colors">
      <div className="flex items-center justify-between text-slate-400 mb-1">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">{label}</span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <div className="flex items-baseline justify-between mt-0.5">
        <span className="text-2xl font-bold font-mono tracking-tight text-white">{value}</span>
        {badge}
      </div>
      {subtext && <div className="text-[11px] text-slate-400 mt-1.5 truncate">{subtext}</div>}
    </div>
  );
};
