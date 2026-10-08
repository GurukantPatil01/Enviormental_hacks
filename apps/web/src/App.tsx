import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { OperationsShell } from './components/shell/OperationsShell';
import { CommandCenter } from './pages/CommandCenter';
import { EnvironmentalMapPage } from './pages/EnvironmentalMapPage';
import { ReportsIntelligence } from './pages/ReportsIntelligence';
import { HotspotIntelligence } from './pages/HotspotIntelligence';
import { PatternSearch } from './pages/PatternSearch';
import { AICommandCenter } from './pages/AICommandCenter';
import { InterventionCenter } from './pages/InterventionCenter';
import { ImpactAnalytics } from './pages/ImpactAnalytics';
import { SystemStatus } from './pages/SystemStatus';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/operations" replace />} />
      <Route element={<OperationsShell />}>
        <Route path="/operations" element={<CommandCenter />} />
        <Route path="/operations/map" element={<EnvironmentalMapPage />} />
        <Route path="/operations/reports" element={<ReportsIntelligence />} />
        <Route path="/operations/hotspots" element={<HotspotIntelligence />} />
        <Route path="/operations/patterns" element={<PatternSearch />} />
        <Route path="/operations/ai" element={<AICommandCenter />} />
        <Route path="/operations/interventions" element={<InterventionCenter />} />
        <Route path="/operations/impact" element={<ImpactAnalytics />} />
        <Route path="/operations/status" element={<SystemStatus />} />
        <Route path="/operations/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/operations" replace />} />
    </Routes>
  );
};
