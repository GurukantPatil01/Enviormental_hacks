import { EcoPulseClient } from '@ecopulse/api-client';
import Constants from 'expo-constants';
import { useAuthStore } from '../stores/auth.store';

import { Platform } from 'react-native';

function getApiBaseUrl(): string {
  // If running locally in browser (Expo Web dev on localhost), use direct local API to avoid internet loopback & ngrok limits
  if (Platform.OS === 'web' && typeof window !== 'undefined' && (window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1')) {
    return `http://${window.location.hostname}:4000`;
  }

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

