import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface VectorSearchParams {
  text?: string;
  vector?: number[];
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  limit?: number;
}

export interface VectorSearchResultItem {
  eventId: string;
  similarity: number;
  distanceMeters?: number;
  event?: {
    id: string;
    description: string;
    latitude: number;
    longitude: number;
    status: string;
    source: string;
    timestamp: string;
  } | null;
}

export function useVectorSearch() {
  return useMutation({
    mutationFn: (params: VectorSearchParams) =>
      apiFetch<VectorSearchResultItem[]>('/api/intelligence/vector-search', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
  });
}
