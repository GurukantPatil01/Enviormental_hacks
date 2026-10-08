import React from 'react';
import { AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Records Found',
  message,
  description,
  icon,
  action,
}) => {
  const text = description || message || '';
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-slate-800/80 bg-slate-900/30">
      <div className="w-10 h-10 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-400 mb-3 border border-slate-700/40">
        {icon || <AlertCircle className="w-5 h-5 text-slate-400" />}
      </div>
      <h4 className="text-sm font-semibold text-slate-200 mb-1">{title}</h4>
      {text && <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">{text}</p>}
      {action && <div>{action}</div>}
    </div>
  );
};
