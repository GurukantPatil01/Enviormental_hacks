import type { User } from '@ecopulse/types';
import { create } from 'zustand';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  setAuth: (token: string, user: User) => {
    set({ token, user, isAuthenticated: true });
  },
  logout: () => {
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
