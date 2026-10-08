import React, { useState, useEffect } from 'react';
import { Search, MapPin, RefreshCw, Bell, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export const TopBar: React.FC = () => {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Kolkata',
        }) + ' IST'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <header className="h-14 bg-slate-950/80 border-b border-slate-800/80 px-4 flex items-center justify-between shrink-0 select-none z-20 backdrop-blur-sm">
      {/* Scope / Location Scope */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-semibold text-slate-200">SCOPE:</span>
          <span>Pune Municipal Corp (PMC)</span>
          <span className="text-slate-400">•</span>
          <span className="text-emerald-400">All Wards</span>
        </div>
      </div>

      {/* Center Search & Context */}
      <div className="flex-1 max-w-md mx-6">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search reports, hotspots, waste types, coordinates (e.g. 18.52, 73.85)..."
            className="w-full bg-slate-900/80 border border-slate-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 font-mono transition-all"
          />
        </div>
      </div>

      {/* Right Telemetry & Controls */}
      <div className="flex items-center space-x-3 font-mono text-xs text-slate-400">
        <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-semibold text-emerald-400">OPERATIONAL</span>
        </div>

        <div className="text-[11px] text-slate-400 hidden sm:block">
          {currentTime}
        </div>

        <button
          onClick={handleRefresh}
          className={`p-1.5 rounded hover:bg-slate-900 border border-slate-800/60 text-slate-400 hover:text-slate-200 transition-all ${
            isRefreshing ? 'animate-spin text-emerald-400' : ''
          }`}
          title="Refresh Operations Data"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
