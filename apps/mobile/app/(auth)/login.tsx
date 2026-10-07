import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Required', 'Please fill in both email and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.auth.login({ email: email.trim(), password });
      setAuth(res.token, res.user);
      if (res.user.role === 'MAINTAINER' || res.user.role === 'WARD_ADMIN' || res.user.role === 'SUPER_ADMIN') {
        router.replace('/(maintainer)');
      } else {
        router.replace('/(resident)');
      }
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleResidentDemoFill = () => {
    setEmail('priya.sharma@example.com');
    setPassword('password123');
  };

  const handleMaintainerDemoFill = () => {
    setEmail('maintainer@ecopulse.org');
    setPassword('password123');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to access your community pulse & operations</Text>

          {/* Quick Demo Pre-fills */}
          <View style={{ gap: 8, marginBottom: spacing.md }}>
            <TouchableOpacity style={styles.demoCard} onPress={handleResidentDemoFill} activeOpacity={0.8}>
              <Text style={styles.demoCardTitle}>👤 Resident Demo (Priya Sharma)</Text>
              <Text style={styles.demoCardSubtitle}>Tap to auto-fill resident citizen credentials</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoCard, { borderColor: colors.primary[600], backgroundColor: colors.primary[50] }]}
              onPress={handleMaintainerDemoFill}
              activeOpacity={0.8}
            >
              <Text style={[styles.demoCardTitle, { color: colors.primary[900] }]}>
                👷 Maintainer Operations Demo (Suresh Kulkarni)
              </Text>
              <Text style={styles.demoCardSubtitle}>Tap to auto-fill municipal maintainer credentials</Text>
            </TouchableOpacity>
          </View>


          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={colors.neutral[400]}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.neutral[400]}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.surface.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                <Text style={styles.footerLink}>Register</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.xl,
  },
  backButtonText: {
    ...typography.bodyBold,
    color: colors.primary[900],
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[600],
    marginBottom: spacing.xl,
  },
  demoCard: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  demoCardTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary[900],
  },
  demoCardSubtitle: {
    ...typography.caption,
    color: colors.primary[700],
    marginTop: 2,
  },
  form: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface.white,
    borderColor: colors.neutral[300],
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.neutral[900],
  },
  primaryButton: {
    backgroundColor: colors.primary[900],
    paddingVertical: spacing.base,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: colors.surface.white,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.base,
  },
  footerText: {
    ...typography.body,
    color: colors.neutral[600],
  },
  footerLink: {
    ...typography.bodyBold,
    color: colors.primary[800],
  },
});
