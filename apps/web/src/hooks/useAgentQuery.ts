import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { AgentToolCall } from '@ecopulse/types';

export interface AgentQueryResult {
  runId: string;
  conversationId: string;
  finalResponse: string;
  roundsExecuted: number;
  status: string;
  durationMs: number;
  steps: AgentToolCall[];
}

export function useAgentQuery() {
  return useMutation({
    mutationFn: (params: { query: string; conversationId?: string; maxRounds?: number }) =>
      apiFetch<AgentQueryResult>('/api/agent/query', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
  });
}

export function useAgentRun(runId: string | null) {
  return useQuery({
    queryKey: ['agent', 'runs', runId],
    queryFn: () => {
      if (!runId) return null;
      return apiFetch<{ run: any; steps: AgentToolCall[] }>(`/api/agent/runs/${runId}`);
    },
    enabled: Boolean(runId),
  });
}
