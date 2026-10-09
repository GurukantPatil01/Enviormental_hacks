import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface EnvironmentalEventItem {
  id: string;
  reportId?: string;
  latitude: number;
  longitude: number;
  description: string;
  status: string;
  source: string;
  timestamp: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  evidence?: Array<{
    id: string;
    mediaUrl: string;
    mediaType?: string;
    verificationStatus?: string;
    metadata?: Record<string, unknown>;
    uploadedAt?: string;
  }>;
  observation?: {
    wasteType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    confidence: number;
    estimatedVolume?: string;
    environmentalRisk?: string;
    publicSafetyRisk?: string;
    recommendedAction?: string;
    illegalDumpingLikelihood?: number;
  } | null;
}

export function useEnvironmentalEvents(options: { limit?: number; status?: string } = {}) {
  const { limit = 50, status } = options;
  return useQuery({
    queryKey: ['intelligence', 'events', limit, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (limit) params.set('limit', String(limit));
      if (status && status !== 'ALL') params.set('status', status);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      return apiFetch<EnvironmentalEventItem[]>(`/api/intelligence/events${queryStr}`);
    },
    refetchInterval: 30000,
  });
}

export function useEventDetails(id: string | null) {
  return useQuery({
    queryKey: ['intelligence', 'events', id],
    queryFn: () => {
      if (!id) return null;
      return apiFetch<EnvironmentalEventItem & { similarEvents?: any[]; nearbyEvents?: any[] }>(
        `/api/intelligence/events/${id}`
      );
    },
    enabled: Boolean(id),
  });
}
