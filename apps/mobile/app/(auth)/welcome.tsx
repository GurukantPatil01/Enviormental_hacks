import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

export default function WelcomeScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const handleQuickDemo = async (role: 'RESIDENT' | 'MAINTAINER') => {
    try {
      setDemoLoading(role);
      const email = role === 'RESIDENT' ? 'priya.sharma@example.com' : 'maintainer@ecopulse.org';
      const res = await api.auth.login({ email, password: 'password123' });
      setAuth(res.token, res.user);
      if (role === 'MAINTAINER') {
        router.replace('/(maintainer)');
      } else {
        router.replace('/(resident)');
      }
    } catch (err: any) {
      console.error('Quick demo login error:', err);
      // Fallback to login screen
      router.push('/(auth)/login');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🌱 Environmental Platform</Text>
        </View>

        <Text style={styles.title}>EcoPulse</Text>
        <Text style={styles.subtitle}>
          Community environmental accountability and incentivization platform.
        </Text>

        <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>✓</Text>
            <Text style={styles.featureText}>Participate in verified civic missions</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>✓</Text>
            <Text style={styles.featureText}>Earn auditable EcoPoints on an immutable ledger</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>✓</Text>
            <Text style={styles.featureText}>Build daily ecological streaks with your neighbors</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.demoPrimaryButton}
          onPress={() => handleQuickDemo('RESIDENT')}
          activeOpacity={0.8}
          disabled={Boolean(demoLoading)}
        >
          {demoLoading === 'RESIDENT' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>⚡ Quick Launch (Resident Demo)</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.demoMaintainerButton}
          onPress={() => handleQuickDemo('MAINTAINER')}
          activeOpacity={0.8}
          disabled={Boolean(demoLoading)}
        >
          {demoLoading === 'MAINTAINER' ? (
            <ActivityIndicator color={colors.primary[900]} size="small" />
          ) : (
            <Text style={[styles.secondaryButtonText, { color: colors.primary[900], fontWeight: '700' }]}>
              👷 Quick Launch (Maintainer Demo)
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
          <TouchableOpacity
            style={[styles.secondaryButton, { flex: 1 }]}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Register</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { flex: 1 }]}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['2xl'],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.base,
  },
  badgeText: {
    ...typography.caption,
    color: colors.primary[900],
    fontWeight: '700',
  },
  title: {
    ...typography.h1,
    fontSize: 36,
    color: colors.primary[900],
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[600],
    lineHeight: 22,
    marginBottom: spacing['2xl'],
  },
  featureList: {
    marginTop: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  featureBullet: {
    color: colors.primary[600],
    fontWeight: 'bold',
    marginRight: spacing.md,
    fontSize: 16,
  },
  featureText: {
    ...typography.body,
    color: colors.neutral[700],
    flex: 1,
  },
  actions: {
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary[900],
    paddingVertical: spacing.base,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  demoPrimaryButton: {
    backgroundColor: colors.primary[900],
    paddingVertical: spacing.base,
    borderRadius: radius.lg,
    alignItems: 'center',
    shadowColor: colors.primary[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  demoMaintainerButton: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
    borderWidth: 1.5,
    paddingVertical: spacing.base,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: colors.surface.white,
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: colors.surface.white,
    borderColor: colors.neutral[300],
    borderWidth: 1,
    paddingVertical: spacing.base,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...typography.bodyBold,
    color: colors.neutral[800],
  },
});
