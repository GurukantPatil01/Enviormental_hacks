import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface Hotspot {
  id: string;
  centerLatitude: number;
  centerLongitude: number;
  radius: number;
  reportCount: number;
  averageSeverity: number;
  dominantWasteType: string;
  trend: 'EMERGING' | 'STABLE' | 'CRITICAL' | 'IMPROVING';
  score: number;
  status: 'ACTIVE' | 'RESOLVED' | 'UNDER_INVESTIGATION';
  firstDetectedAt: string;
  lastDetectedAt: string;
}

export interface HotspotDetail extends Hotspot {
  events: Array<{
    id: string;
    description: string;
    severity: string;
    latitude: number;
    longitude: number;
    timestamp: string;
  }>;
  interventions: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
  }>;
}

export function useHotspots(status?: string) {
  return useQuery({
    queryKey: ['intelligence', 'hotspots', status],
    queryFn: () => {
      const q = status ? `?status=${status}` : '';
      return apiFetch<Hotspot[]>(`/api/intelligence/hotspots${q}`);
    },
    refetchInterval: 30000,
  });
}

export function useHotspotDetails(id: string | null) {
  return useQuery({
    queryKey: ['intelligence', 'hotspots', id],
    queryFn: () => {
      if (!id) return null;
      return apiFetch<HotspotDetail>(`/api/intelligence/hotspots/${id}`);
    },
    enabled: Boolean(id),
  });
}
