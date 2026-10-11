function getApiBaseUrl(): string {
  const metaEnv = (import.meta as any).env;
  if (metaEnv?.VITE_API_URL) {
    return metaEnv.VITE_API_URL.replace(/\/$/, '');
  }

  // When hosted on AWS S3 static website or any non-localhost domain, route to public API
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('amazonaws.com') || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
      return 'https://thee-float-tiring.ngrok-free.dev';
    }
  }

  return '';
}

export const API_BASE = getApiBaseUrl();

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
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    'ngrok-skip-browser-warning': 'true',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = cleanEndpoint.startsWith('http')
    ? cleanEndpoint
    : API_BASE
      ? `${API_BASE}${cleanEndpoint}`
      : cleanEndpoint;

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
