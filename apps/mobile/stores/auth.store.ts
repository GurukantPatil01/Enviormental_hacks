import type { User } from '@ecopulse/types';
import { create } from 'zustand';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

const STORAGE_KEY = 'ecopulse_mobile_auth_session';

function getStoredAuth(): { token: string | null; user: User | null } {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = window.localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed?.token && parsed?.user) {
          return { token: parsed.token, user: parsed.user };
        }
      }
    }
  } catch {
    // ignore
  }
  return { token: null, user: null };
}

const initialAuth = getStoredAuth();

export const useAuthStore = create<AuthState>((set) => ({
  token: initialAuth.token,
  user: initialAuth.user,
  isAuthenticated: Boolean(initialAuth.token),
  setAuth: (token: string, user: User) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
      }
    } catch {
      // ignore
    }
    set({ token, user, isAuthenticated: true });
  },
  logout: () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    set({ token: null, user: null, isAuthenticated: false });
  },
}));

