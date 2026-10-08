import React, { useState } from 'react';
import { Settings, Save, ShieldCheck, MapPin, User, Bell } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [municipality, setMunicipality] = useState('Pune Municipal Corporation (PMC)');
  const [ward, setWard] = useState('Ward 14 - Kothrud / Bavdhan');
  const [maintainerName, setMaintainerName] = useState('Supervisor Patil');
  const [badgeNumber, setBadgeNumber] = useState('PMC-ENV-8841');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-3xl font-sans">
      <div>
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-300" />
            Operations Console Settings
          </h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            PREFERENCES
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Configure maintainer operational identity, municipal jurisdiction scope, and notification thresholds.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Jurisdiction Card */}
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-lg space-y-4">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Operational Jurisdiction</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-mono mb-1">Municipal Body</label>
              <input
                type="text"
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-mono mb-1">Assigned Ward / Sector</label>
              <input
                type="text"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Identity Card */}
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-lg space-y-4">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
            <User className="w-4 h-4 text-sky-400" />
            <span>Maintainer Credential</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-mono mb-1">Supervisor Full Name</label>
              <input
                type="text"
                value={maintainerName}
                onChange={(e) => setMaintainerName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-mono mb-1">Municipal Badge Identifier</label>
              <input
                type="text"
                value={badgeNumber}
                onChange={(e) => setBadgeNumber(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {saved ? (
            <span className="text-xs font-mono text-emerald-400 flex items-center space-x-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Settings successfully synchronized!</span>
            </span>
          ) : (
            <span />
          )}

          <button
            type="submit"
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950 flex items-center space-x-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
};
