import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  FileText,
  Flame,
  Search,
  Bot,
  ShieldAlert,
  TrendingUp,
  Activity,
  Settings,
  UserCheck,
  Leaf,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/operations', label: 'Command Center', icon: LayoutDashboard },
  { path: '/operations/map', label: 'Environmental Map', icon: Map },
  { path: '/operations/reports', label: 'Reports', icon: FileText },
  { path: '/operations/hotspots', label: 'Hotspots', icon: Flame },
  { path: '/operations/patterns', label: 'Patterns', icon: Search },
  { path: '/operations/ai', label: 'AI Command', icon: Bot },
  { path: '/operations/interventions', label: 'Interventions', icon: ShieldAlert },
  { path: '/operations/impact', label: 'Impact', icon: TrendingUp },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none z-30">
      <div>
        {/* Brand Header */}
        <div className="h-14 px-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Leaf className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-wider text-white font-mono flex items-center gap-1.5">
                ECOPULSE
                <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-mono">
                  OPS
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono tracking-tight uppercase">
                Environmental Operations
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          <div className="px-2 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Navigation
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/operations'}
                className={({ isActive }) =>
                  `flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer / System Status */}
      <div className="p-3 border-t border-slate-800/80 space-y-3 bg-slate-950/60">
        {/* Status indicator */}
        <div className="p-2.5 rounded border border-slate-800 bg-slate-900/40 text-[11px] font-mono">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              SYSTEM STATUS
            </span>
            <span className="text-emerald-400 font-bold">100% OK</span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Postgres + pgvector</span>
            <span className="text-slate-400">Connected</span>
          </div>
        </div>

        {/* Maintainer Identity */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2 truncate">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <div className="text-xs font-medium text-slate-200 truncate">Supervisor Patil</div>
              <div className="text-[10px] text-slate-400 font-mono truncate">Zone 3 • PMC Pune</div>
            </div>
          </div>
          <NavLink
            to="/operations/settings"
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </NavLink>
        </div>
      </div>
    </aside>
  );
};
