import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { Intervention, InterventionOutcome } from '@ecopulse/types';

export function useInterventions(status?: string) {
  return useQuery({
    queryKey: ['interventions', status],
    queryFn: () => {
      const q = status && status !== 'ALL' ? `?status=${status}` : '';
      return apiFetch<Intervention[]>(`/api/interventions${q}`);
    },
    refetchInterval: 30000,
  });
}

export function useCreateIntervention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      hotspotId?: string;
      type: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      assignedTeam?: string;
      notes?: string;
    }) =>
      apiFetch<Intervention>('/api/interventions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
    },
  });
}

export function useApproveIntervention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      apiFetch<Intervention>(`/api/interventions/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approvedByUserId: 'supervisor-console', notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
    },
  });
}

export function useStartIntervention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assignedTeam }: { id: string; assignedTeam?: string }) =>
      apiFetch<Intervention>(`/api/interventions/${id}/start`, {
        method: 'POST',
        body: JSON.stringify({ assignedTeam }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
    },
  });
}

export function useCompleteIntervention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      apiFetch<Intervention>(`/api/interventions/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
    },
  });
}

export function useMeasureOutcome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        beforeReportRate: number;
        afterReportRate: number;
        beforeSeverity: number;
        afterSeverity: number;
        beforeHotspotSize: number;
        afterHotspotSize: number;
      };
    }) =>
      apiFetch<InterventionOutcome>(`/api/interventions/${id}/outcomes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['impact'] });
    },
  });
}

export function useInterventionOutcomes() {
  return useQuery({
    queryKey: ['impact', 'outcomes'],
    queryFn: () => apiFetch<InterventionOutcome[]>('/api/interventions/outcomes'),
    refetchInterval: 30000,
  });
}
