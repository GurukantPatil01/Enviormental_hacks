import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bot,
  Send,
  Sparkles,
  HelpCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Cpu,
  BarChart2,
  Map as MapIcon,
} from 'lucide-react';
import { useAgentQuery, AgentQueryResult } from '../hooks/useAgentQuery';
import { AgentExecutionPanel } from '../components/agent/AgentExecutionPanel';
import { ChartRenderer } from '../components/charts/ChartRenderer';
import { MapRenderer } from '../components/map/MapRenderer';
import { EmptyState } from '../components/common/EmptyState';
import type { ChartSpec, MapSpec } from '@ecopulse/types';

const SUGGESTED_QUERIES = [
  'Which hotspots are getting worse this week?',
  'Generate visualization of waste distribution across categories',
  'Generate map visualization of active hazards in Pune',
  'Find recurring plastic dumping patterns near drainage',
  'What is the environmental overview across municipal sectors?',
];

export const AICommandCenter: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('query') || '';

  const [prompt, setPrompt] = useState(initialQuery);
  const [activeResult, setActiveResult] = useState<AgentQueryResult | null>(null);

  const { mutate: runQuery, isPending } = useAgentQuery();

  const handleExecute = (queryText: string) => {
    if (!queryText.trim() || isPending) return;

    runQuery(
      { query: queryText.trim(), maxRounds: 6 },
      {
        onSuccess: (res) => {
          setActiveResult(res);
        },
      }
    );
  };

  useEffect(() => {
    if (initialQuery) {
      handleExecute(initialQuery);
    }
  }, []);

  // Look for ChartSpec and MapSpec in tool outputs
  let detectedChart: ChartSpec | null = null;
  let detectedMap: MapSpec | null = null;

  if (activeResult?.steps) {
    for (const step of activeResult.steps) {
      const output = step.output as any;
      if (output) {
        if (output.series && output.type && (output.type === 'bar' || output.type === 'line' || output.type === 'pie')) {
          detectedChart = output as ChartSpec;
        }
        if (output.center && output.layers) {
          detectedMap = output as MapSpec;
        }
      }
    }
  }

  return (
    <div className="space-y-4 font-sans h-[calc(100vh-6rem)] flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              AI Command & Investigation Center
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              REASONING RUNTIME ACTIVE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Query the multi-tool environmental agent to synthesize field telemetry, inspect spatial correlations, and generate reactive visual specs.
          </p>
        </div>
      </div>

      {/* Suggested Prompt Pills */}
      <div className="shrink-0 flex items-center space-x-2 overflow-x-auto pb-1 text-xs font-mono">
        <span className="text-[10px] uppercase text-slate-400 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          Quick Inquiries:
        </span>
        {SUGGESTED_QUERIES.map((sq, i) => (
          <button
            key={i}
            onClick={() => {
              setPrompt(sq);
              handleExecute(sq);
            }}
            className="px-2.5 py-1 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors shrink-0 text-[11px]"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Query Bar */}
      <div className="shrink-0 bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExecute(prompt);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask a technical environmental inquiry (e.g., 'Compare Kothrud with Baner' or 'Generate visualization of waste')..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={isPending || !prompt.trim()}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950 flex items-center space-x-1.5 transition-colors disabled:opacity-50 shrink-0"
          >
            {isPending ? (
              <span className="flex items-center space-x-1">
                <Cpu className="w-3.5 h-3.5 animate-spin" />
                <span>Investigating...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1">
                <Send className="w-3.5 h-3.5" />
                <span>Execute Inquiry</span>
              </span>
            )}
          </button>
        </form>
      </div>

      {/* Main 2-Panel Split: Analysis Center vs Execution Inspector */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Center/Left: Synthesis & Visualizations */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-lg flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Agent Synthesis & Output Artifacts
            </span>
            {activeResult && (
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Rounds Executed: {activeResult.roundsExecuted}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!activeResult && !isPending ? (
              <EmptyState
                title="Environmental Agent Ready"
                description="Select a suggested quick query or type a prompt above. The agent will autonomously decide required tools across multiple rounds and synthesize operational intelligence."
              />
            ) : isPending ? (
              <div className="p-16 text-center space-y-3">
                <div className="inline-block p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-pulse">
                  <Cpu className="w-6 h-6 animate-spin" />
                </div>
                <div className="text-xs font-mono text-slate-300">
                  Autonomous Agent Reasoning & Tool Invocation in Progress...
                </div>
                <p className="text-[11px] text-slate-400">
                  Executing verified database queries and telemetry aggregations
                </p>
              </div>
            ) : (
              <>
                {/* Final Response Text */}
                <div className="p-4 bg-slate-900/70 border border-slate-800/80 rounded-lg space-y-2">
                  <div className="flex items-center space-x-1.5 text-emerald-400 font-mono text-[11px] font-bold uppercase">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Operational Intelligence Briefing</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    {activeResult?.finalResponse}
                  </p>
                </div>

                {/* Rendered Chart Spec if Generated */}
                {detectedChart && (
                  <div className="space-y-2">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                      Dynamic Chart Artifact (ChartSpec)
                    </div>
                    <ChartRenderer spec={detectedChart} height={240} />
                  </div>
                )}

                {/* Rendered Map Spec if Generated */}
                {detectedMap && (
                  <div className="space-y-2">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapIcon className="w-3.5 h-3.5 text-emerald-400" />
                      Dynamic Spatial Map Artifact (MapSpec)
                    </div>
                    <MapRenderer spec={detectedMap} height="280px" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Actual Agent Execution Panel */}
        <div className="lg:col-span-4 h-full">
          <AgentExecutionPanel
            steps={activeResult?.steps || []}
            runId={activeResult?.runId}
            totalDurationMs={activeResult?.durationMs}
            status={activeResult?.status || (isPending ? 'EXECUTING' : 'IDLE')}
          />
        </div>
      </div>
    </div>
  );
};
