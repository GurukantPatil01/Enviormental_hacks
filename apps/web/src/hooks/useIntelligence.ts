import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface IntelligenceOverview {
  totalEvents: number;
  activeHotspots: number;
  openReports: number;
  verifiedReports: number;
  resolvedIncidents: number;
  dominantWasteType: string;
  averageSeverity: number;
  activeInterventions: number;
  lastUpdated: string;
}

export interface WasteDistributionItem {
  wasteType: string;
  count: number;
  percentage: number;
}

export interface SeverityDistributionItem {
  severity: string;
  count: number;
  percentage: number;
}

export interface TimelineEntry {
  date: string;
  count: number;
}

export function useEnvironmentalOverview() {
  return useQuery({
    queryKey: ['intelligence', 'overview'],
    queryFn: () => apiFetch<IntelligenceOverview>('/api/intelligence/overview'),
    refetchInterval: 30000,
  });
}

export function useWasteDistribution() {
  return useQuery({
    queryKey: ['intelligence', 'waste-distribution'],
    queryFn: () => apiFetch<WasteDistributionItem[]>('/api/intelligence/waste-distribution'),
    refetchInterval: 60000,
  });
}

export function useSeverityDistribution() {
  return useQuery({
    queryKey: ['intelligence', 'severity-distribution'],
    queryFn: () => apiFetch<SeverityDistributionItem[]>('/api/intelligence/severity-distribution'),
    refetchInterval: 60000,
  });
}

export function useEventTimeline(days = 30) {
  return useQuery({
    queryKey: ['intelligence', 'timeline', days],
    queryFn: () => apiFetch<TimelineEntry[]>(`/api/intelligence/timeline?days=${days}`),
    refetchInterval: 60000,
  });
}

export function usePatternSearch() {
  return useQuery({
    queryKey: ['intelligence', 'patterns'],
    queryFn: () => apiFetch<any>('/api/intelligence/pattern-search', { method: 'POST' }),
  });
}
