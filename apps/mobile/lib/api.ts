import { EcoPulseClient } from '@ecopulse/api-client';
import Constants from 'expo-constants';
import { useAuthStore } from '../stores/auth.store';

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // When running in Expo Go on a real Android/iOS device, hostUri contains the IP of the dev machine
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).manifest?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) {
      return `http://${ip}:4000`;
    }
  }

  return 'http://localhost:4000';
}

export const API_URL = getApiBaseUrl();

export const api = new EcoPulseClient({
  baseUrl: API_URL,
  getToken: () => useAuthStore.getState().token,
  onUnauthorized: () => {
    useAuthStore.getState().logout();
  },
});

