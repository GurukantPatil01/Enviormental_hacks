import React from 'react';
import { CheckCircle2, AlertCircle, Clock, Cpu, ShieldCheck } from 'lucide-react';

export interface ToolExecutionStep {
  round: number;
  tool?: string;
  toolName?: string;
  duration?: number;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT' | string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  error?: string | null;
}

interface AgentExecutionPanelProps {
  steps?: ToolExecutionStep[];
  runId?: string;
  totalDurationMs?: number;
  status?: string;
}

export const AgentExecutionPanel: React.FC<AgentExecutionPanelProps> = ({
  steps = [],
  runId,
  totalDurationMs,
  status = 'COMPLETED',
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 font-mono text-xs flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-200 tracking-wider uppercase text-[11px]">
            AI Investigation Execution
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {status === 'COMPLETED' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              <ShieldCheck className="w-3 h-3 mr-1" />
              VERIFIED RUN
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {status}
            </span>
          )}
        </div>
      </div>

      {/* Run Meta */}
      {runId && (
        <div className="py-2.5 px-3 my-3 bg-slate-950/70 border border-slate-800/80 rounded flex items-center justify-between text-[10px] text-slate-400">
          <span>RUN: <span className="text-slate-300 select-all">{runId.slice(0, 8)}...</span></span>
          {typeof totalDurationMs === 'number' && (
            <span className="flex items-center text-slate-300">
              <Clock className="w-3 h-3 mr-1 text-slate-400" />
              {totalDurationMs}ms
            </span>
          )}
        </div>
      )}

      {/* Rounds list */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {steps.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-sans">
            No agent investigation triggered yet. Submit an environmental inquiry to inspect tool reasoning.
          </div>
        ) : (
          steps.map((step, index) => {
            const toolName = step.toolName || step.tool || 'unknown_tool';
            const isSuccess = step.status === 'SUCCESS';

            return (
              <div
                key={index}
                className="p-2.5 bg-slate-950/90 border border-slate-800/90 rounded hover:border-slate-700/80 transition-colors"
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-400 font-semibold">
                    Round {step.round}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {step.duration ? `${step.duration}ms` : '<10ms'}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-900">
                  <div className="flex items-center space-x-1.5 truncate">
                    {isSuccess ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    )}
                    <span className="text-slate-200 font-mono font-medium truncate">
                      {toolName}
                    </span>
                  </div>

                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                      isSuccess
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {step.status}
                  </span>
                </div>

                {step.error && (
                  <div className="mt-1.5 p-1.5 bg-red-950/40 border border-red-800/50 rounded text-[10px] text-red-300">
                    {step.error}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
