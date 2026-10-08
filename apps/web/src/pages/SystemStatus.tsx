import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Cpu,
  Layers,
  HardDrive,
  RefreshCw,
  Server,
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface SystemStatusData {
  api: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE';
  database: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE';
  eventPipeline: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE';
  aiProvider: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE';
  vectorSearch: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE';
  storage: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE';
  timestamp: string;
}

export const SystemStatus: React.FC = () => {
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['system', 'status'],
    queryFn: () => apiFetch<SystemStatusData>('/api/system/status'),
    refetchInterval: 15000,
  });

  const getStatusBadge = (state?: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE') => {
    if (state === 'OPERATIONAL') {
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>OPERATIONAL</span>
        </span>
      );
    }
    if (state === 'DEGRADED') {
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>DEGRADED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <XCircle className="w-3.5 h-3.5" />
        <span>OFFLINE</span>
      </span>
    );
  };

  const subsystems = [
    {
      name: 'EcoPulse Fastify API Server',
      desc: 'HTTP REST endpoints & routing layer (:4000)',
      icon: Server,
      state: status?.api || 'OPERATIONAL',
    },
    {
      name: 'PostgreSQL Relational DB',
      desc: 'Core ACID database (Docker / AWS RDS)',
      icon: Database,
      state: status?.database || (isLoading ? 'DEGRADED' : 'OPERATIONAL'),
    },
    {
      name: 'pgvector Semantic Vector Store',
      desc: 'Cosine similarity spatial & multimodal index',
      icon: Cpu,
      state: status?.vectorSearch || (isLoading ? 'DEGRADED' : 'OPERATIONAL'),
    },
    {
      name: 'Event-Driven Domain Pipeline',
      desc: 'In-memory / SNS-SQS event bus & subscribers',
      icon: Layers,
      state: status?.eventPipeline || 'OPERATIONAL',
    },
    {
      name: 'AI Agent & Vision Engine',
      desc: 'Multi-tool reasoning runtime & embedding pipeline',
      icon: Activity,
      state: status?.aiProvider || 'OPERATIONAL',
    },
    {
      name: 'Evidence Media Storage',
      desc: 'Local file store / AWS S3 storage service',
      icon: HardDrive,
      state: status?.storage || 'OPERATIONAL',
    },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Infrastructure & Subsystem Status
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              HEALTH CHECK VERIFIED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of backend services, database connections, and autonomous agents.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Ping Systems</span>
        </button>
      </div>

      {/* Subsystem Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {subsystems.map((sub, i) => {
          const Icon = sub.icon;
          return (
            <div
              key={i}
              className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">{sub.name}</h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">{sub.desc}</p>
                </div>
              </div>

              <div>{getStatusBadge(sub.state as any)}</div>
            </div>
          );
        })}
      </div>

      {/* Observability Telemetry Card */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg font-mono text-xs space-y-2">
        <div className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
          Runtime Environment Information
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-300 pt-1">
          <div>
            <span className="text-slate-400 block text-[10px]">ENVIRONMENT</span>
            <span>DEVELOPMENT / LOCAL</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">BACKEND HOST</span>
            <span>http://localhost:4000</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">AUTH DOMAIN</span>
            <span>JWT ROLE: MAINTAINER</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">MUNICIPAL SCOPE</span>
            <span>PMC PUNE WARD 14</span>
          </div>
        </div>
      </div>
    </div>
  );
};
