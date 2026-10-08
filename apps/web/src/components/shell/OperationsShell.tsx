import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export const OperationsShell: React.FC = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Fixed Left Navigation */}
      <Sidebar />

      {/* Main Viewport Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 min-h-0 overflow-y-auto bg-slate-950 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
