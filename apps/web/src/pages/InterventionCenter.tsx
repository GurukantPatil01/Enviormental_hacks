import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldAlert,
  Plus,
  CheckCircle2,
  Clock,
  Play,
  CheckSquare,
  Bot,
  AlertTriangle,
  UserCheck,
  X,
} from 'lucide-react';
import {
  useInterventions,
  useCreateIntervention,
  useApproveIntervention,
  useStartIntervention,
  useCompleteIntervention,
} from '../hooks/useInterventions';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { formatDate, formatRelativeTime } from '../lib/formatters';
import type { Intervention } from '@ecopulse/types';

export const InterventionCenter: React.FC = () => {
  const [searchParams] = useSearchParams();
  const shouldOpenCreate = searchParams.get('create') === 'true';
  const initialHotspotId = searchParams.get('hotspotId') || '';
  const initialType = searchParams.get('type') || 'Clean-up Crew Dispatch';

  // State
  const [activeTab, setActiveTab] = useState<'ALL' | 'DRAFT' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(shouldOpenCreate);

  // Form state
  const [formType, setFormType] = useState(initialType);
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [formTeam, setFormTeam] = useState('Zone 3 Sanitation Rapid Response Team');
  const [formNotes, setFormNotes] = useState('');
  const [formHotspotId, setFormHotspotId] = useState(initialHotspotId);

  // Completion modal state
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState('Waste cleared and bin capacity upgraded.');

  // Hooks
  const { data: interventions, isLoading, refetch } = useInterventions();
  const { mutate: createIntervention, isPending: isCreating } = useCreateIntervention();
  const { mutate: approveIntervention, isPending: isApproving } = useApproveIntervention();
  const { mutate: startIntervention, isPending: isStarting } = useStartIntervention();
  const { mutate: completeIntervention, isPending: isCompleting } = useCompleteIntervention();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createIntervention(
      {
        type: formType,
        priority: formPriority,
        assignedTeam: formTeam,
        notes: formNotes || undefined,
        hotspotId: formHotspotId || undefined,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setFormNotes('');
          refetch();
        },
      }
    );
  };

  const handleApprove = (id: string) => {
    approveIntervention(
      { id, notes: 'Approved by Supervisor Console' },
      { onSuccess: () => refetch() }
    );
  };

  const handleStart = (id: string) => {
    startIntervention(
      { id, assignedTeam: formTeam },
      { onSuccess: () => refetch() }
    );
  };

  const handleCompleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingId) return;
    completeIntervention(
      { id: completingId, notes: completionNotes },
      {
        onSuccess: () => {
          setCompletingId(null);
          refetch();
        },
      }
    );
  };

  // Filter list by tab
  const filteredList = (interventions || []).filter((inv) => {
    const s = inv.status.toLowerCase();
    if (activeTab === 'DRAFT') return s === 'draft' || s === 'proposed';
    if (activeTab === 'APPROVED') return s === 'approved';
    if (activeTab === 'IN_PROGRESS') return s === 'in_progress';
    if (activeTab === 'COMPLETED') return s === 'completed';
    return true;
  });

  return (
    <div className="space-y-5 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-slate-300" />
              Intervention Command & Field Dispatch
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {interventions?.length || 0} TOTAL INTERVENTIONS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Turn automated spatial intelligence into authorized municipal interventions with supervisor sign-off.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm flex items-center space-x-1.5 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Intervention</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 text-xs font-mono">
        {[
          { key: 'ALL', label: 'All Operations' },
          { key: 'DRAFT', label: 'Needs Supervisor Approval' },
          { key: 'APPROVED', label: 'Approved' },
          { key: 'IN_PROGRESS', label: 'In Progress' },
          { key: 'COMPLETED', label: 'Completed' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Interventions List */}
      {isLoading ? (
        <div className="p-12 text-center text-xs font-mono text-slate-400">
          Loading intervention records...
        </div>
      ) : filteredList.length === 0 ? (
        <EmptyState
          title="No interventions found in this category"
          description="Create a new intervention or inspect Hotspot Intelligence to authorize an automated field task."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map((item) => {
            const isDraft = item.status === 'draft' || item.status === 'PROPOSED';
            const isApproved = item.status === 'approved' || item.status === 'APPROVED';
            const isInProgress = item.status === 'in_progress' || item.status === 'IN_PROGRESS';
            const isCompleted = item.status === 'completed' || item.status === 'COMPLETED';

            const isAIProposed = item.notes?.toLowerCase().includes('ai') || isDraft;

            return (
              <div
                key={item.id}
                className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                      {item.type}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>

                  {isAIProposed && (
                    <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 font-mono">
                      <Bot className="w-3 h-3" />
                      <span>AI RECOMMENDATION</span>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{item.type}</h3>
                    {item.notes && (
                      <p className="text-xs text-slate-300 mt-1 line-clamp-2 font-mono">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 font-mono text-[11px] text-slate-400 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Priority:</span>
                      <span className="font-bold uppercase text-amber-400">{item.priority}</span>
                    </div>
                    {item.assignedTeam && (
                      <div className="flex items-center justify-between">
                        <span>Team:</span>
                        <span className="text-slate-300 truncate max-w-[140px]">
                          {item.assignedTeam}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px]">
                      <span>Created:</span>
                      <span>{formatRelativeTime(item.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Supervisor Action Buttons */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                  {isDraft && (
                    <button
                      onClick={() => handleApprove(item.id)}
                      disabled={isApproving}
                      className="flex-1 py-1.5 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center space-x-1 transition-colors"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>Approve</span>
                    </button>
                  )}

                  {isApproved && (
                    <button
                      onClick={() => handleStart(item.id)}
                      disabled={isStarting}
                      className="flex-1 py-1.5 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center space-x-1 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      <span>Start Operation</span>
                    </button>
                  )}

                  {isInProgress && (
                    <button
                      onClick={() => setCompletingId(item.id)}
                      className="flex-1 py-1.5 px-2.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center space-x-1 transition-colors"
                    >
                      <CheckSquare className="w-3 h-3" />
                      <span>Complete</span>
                    </button>
                  )}

                  {isCompleted && (
                    <div className="w-full text-center py-1 text-[11px] font-mono text-emerald-400 flex items-center justify-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Field Intervention Closed</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                Initiate Municipal Intervention
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-mono mb-1">Intervention Type</label>
                <input
                  type="text"
                  required
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  placeholder="E.g., Clean-up Crew Dispatch, Bin Installation, Drain Desilting"
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Priority Tier</label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 font-mono"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="critical">Critical (Immediate Hazard)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Assigned Crew / Team</label>
                <input
                  type="text"
                  value={formTeam}
                  onChange={(e) => setFormTeam(e.target.value)}
                  placeholder="PMC Sanitation Division 3"
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Operational Notes</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Directives for field teams..."
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold font-mono shadow-sm"
                >
                  {isCreating ? 'Creating...' : 'Submit Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {completingId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                Confirm Intervention Completion
              </h3>
              <button
                onClick={() => setCompletingId(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-mono mb-1">
                  Field Verification Notes & Outcome
                </label>
                <textarea
                  rows={3}
                  required
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Record what was done, quantity cleared, and ongoing safeguards..."
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCompletingId(null)}
                  className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCompleting}
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold font-mono"
                >
                  {isCompleting ? 'Completing...' : 'Mark Complete & Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
