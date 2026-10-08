export const API_BASE = '/api';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export function getAuthToken(): string | null {
  return localStorage.getItem('ecopulse_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('ecopulse_token', token);
}

export function removeAuthToken(): void {
  localStorage.removeItem('ecopulse_token');
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : endpoint.startsWith('/api') ? endpoint : `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMessage = `API Error ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      errorMessage = errJson.error?.message || errJson.error || errJson.message || errorMessage;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  const json = await res.json();
  if (json && typeof json === 'object' && 'data' in json && 'success' in json) {
    return json.data as T;
  }
  return json as T;
}
