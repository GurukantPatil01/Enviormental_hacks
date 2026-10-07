import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const { data: dashboard } = useQuery({
    queryKey: ['home-dashboard'],
    queryFn: () => api.me.get(),
  });

  const { data: streak } = useQuery({
    queryKey: ['my-streak'],
    queryFn: () => api.me.getStreak(),
  });

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/welcome');
  };

  const badges = [
    { title: 'Corridor Pioneer', icon: '🌿', desc: '10+ Verified Cleanups' },
    { title: 'Habit Champion', icon: '🔥', desc: '7-Day Continuous Streak' },
    { title: 'Waste Segregator', icon: '♻️', desc: 'Daily Source Segregation' },
    { title: 'Civic Watchdog', icon: '🚨', desc: 'First Hotspot Remediated' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.fullName?.charAt(0) || 'E'}</Text>
          </View>
          <Text style={styles.userName}>{user?.fullName || 'Resident'}</Text>
          <Text style={styles.userRole}>
            Verified Resident • {dashboard?.community?.name || 'Pune Ward'}
          </Text>
        </View>

        {/* Impact Passport Card */}
        <View style={styles.passportCard}>
          <View style={styles.passportHeader}>
            <Text style={styles.passportTitle}>CITIZEN IMPACT PASSPORT</Text>
            <Text style={styles.passportId}>EP-{user?.id.slice(0, 8).toUpperCase()}</Text>
          </View>

          <View style={styles.passportStats}>
            <View style={styles.pStat}>
              <Text style={styles.pStatVal}>{dashboard?.pointBalance ?? 0}</Text>
              <Text style={styles.pStatLabel}>EcoPoints</Text>
            </View>

            <View style={styles.pStat}>
              <Text style={styles.pStatVal}>{streak?.currentStreak ?? 1}</Text>
              <Text style={styles.pStatLabel}>Current Streak</Text>
            </View>

            <View style={styles.pStat}>
              <Text style={styles.pStatVal}>{streak?.longestStreak ?? 1}</Text>
              <Text style={styles.pStatLabel}>Longest Streak</Text>
            </View>
          </View>

          <View style={styles.verifiedStamp}>
            <Text style={styles.stampText}>OFFICIALLY VERIFIED • PMC</Text>
          </View>
        </View>

        {/* Achievements / Badges */}
        <Text style={styles.sectionHeader}>EcoPulse Achievements</Text>
        <View style={styles.badgesGrid}>
          {badges.map((b) => (
            <View key={b.title} style={styles.badgeCard}>
              <Text style={styles.badgeIcon}>{b.icon}</Text>
              <Text style={styles.badgeTitle}>{b.title}</Text>
              <Text style={styles.badgeDesc}>{b.desc}</Text>
            </View>
          ))}
        </View>

        {/* Account actions */}
        <Text style={styles.sectionHeader}>Account & Settings</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Email</Text>
            <Text style={styles.settingVal}>{user?.email}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Language</Text>
            <Text style={styles.settingVal}>English (Marathi coming soon)</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Environmental Notifications</Text>
            <Text style={styles.settingVal}>Active</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  scroll: {
    padding: spacing.base,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary[900],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    color: colors.surface.white,
    fontSize: 26,
    fontWeight: '800',
  },
  userName: {
    ...typography.h2,
    color: colors.neutral[900],
  },
  userRole: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 2,
  },
  passportCard: {
    backgroundColor: colors.primary[900],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.base,
  },
  passportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  passportTitle: {
    color: colors.primary[200],
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  passportId: {
    color: colors.primary[300],
    fontSize: 11,
    fontWeight: '700',
  },
  passportStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  pStat: {
    alignItems: 'center',
    flex: 1,
  },
  pStatVal: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.surface.white,
  },
  pStatLabel: {
    fontSize: 11,
    color: colors.primary[200],
    marginTop: 2,
  },
  verifiedStamp: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 8,
    alignItems: 'center',
  },
  stampText: {
    color: colors.primary[300],
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionHeader: {
    ...typography.h3,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.base,
  },
  badgeCard: {
    width: '48%',
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  badgeIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  badgeTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    textAlign: 'center',
    fontSize: 13,
  },
  badgeDesc: {
    fontSize: 11,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: 2,
  },
  settingsCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: spacing.lg,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  settingLabel: {
    fontSize: 13,
    color: colors.neutral[600],
  },
  settingVal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  logoutButton: {
    backgroundColor: colors.neutral[200],
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: colors.status.error,
    fontWeight: '700',
    fontSize: 14,
  },
});
