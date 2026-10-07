import { Redirect } from 'expo-router';
import React from 'react';
import { useAuthStore } from '../stores/auth.store';

export default function Index() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (user?.role === 'MAINTAINER' || user?.role === 'WARD_ADMIN' || user?.role === 'SUPER_ADMIN') {
    return <Redirect href="/(maintainer)" />;
  }

  return <Redirect href="/(resident)" />;
}
