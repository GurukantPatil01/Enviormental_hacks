import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
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
    Alert.alert('Log Out', 'Are you sure you want to log out of EcoPulse?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const impactStats = dashboard?.impactStats;
  const userInitials = (user?.fullName || user?.email || 'Citizen')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userInitials}</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
            </View>
          </View>

          <Text style={styles.userName}>{user?.fullName || 'Resident Citizen'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.roleTag}>
              <Ionicons name="shield-checkmark" size={13} color={theme.colors.forest} style={{ marginRight: 4 }} />
              <Text style={styles.roleTagText}>Verified Citizen</Text>
            </View>
            <View style={styles.communityTag}>
              <Ionicons name="business" size={13} color={theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.communityTagText}>
                {dashboard?.community?.name || 'Central Ward'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Impact Stats Grid */}
        <View style={styles.statsCard}>
          <Text style={styles.cardHeaderTitle}>Your Civic Contributions</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{dashboard?.pointBalance ?? 0}</Text>
              <Text style={styles.statLabel}>EcoPoints</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{impactStats?.reportsCount ?? 0}</Text>
              <Text style={styles.statLabel}>Reports</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{impactStats?.verifiedCount ?? 0}</Text>
              <Text style={styles.statLabel}>Verified</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{streak?.currentStreak ?? 1}d</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
          </View>
        </View>

        {/* Account & App Settings */}
        <View style={styles.settingsGroupCard}>
          <Text style={styles.groupTitle}>Preferences & Notifications</Text>

          {/* Notifications */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('Notifications', 'Environmental status alerts and cleanup dispatches are enabled.')}
            activeOpacity={0.7}
          >
            <View style={styles.settingIconCircle}>
              <Ionicons name="notifications-outline" size={18} color={theme.colors.forest} />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Notifications</Text>
              <Text style={styles.settingSub}>Status updates, rewards & warnings</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>

          {/* Language */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('Language', 'Default language is English. Additional regional localizations supported in subsequent releases.')}
            activeOpacity={0.7}
          >
            <View style={styles.settingIconCircle}>
              <Ionicons name="globe-outline" size={18} color={theme.colors.forest} />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Language</Text>
              <Text style={styles.settingSub}>English (US)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>

          {/* Location Permissions */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('Location Permissions', 'Foreground GPS permission is utilized exclusively during waste report evidence capture.')}
            activeOpacity={0.7}
          >
            <View style={styles.settingIconCircle}>
              <Ionicons name="location-outline" size={18} color={theme.colors.forest} />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Location Services</Text>
              <Text style={styles.settingSub}>Foreground GPS high-precision</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Security & Support */}
        <View style={styles.settingsGroupCard}>
          <Text style={styles.groupTitle}>Security & Support</Text>

          {/* Privacy Information */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('Privacy Policy', 'EcoPulse preserves citizen privacy. Evidence media is stored on private encrypted S3 buckets.')}
            activeOpacity={0.7}
          >
            <View style={styles.settingIconCircle}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.colors.forest} />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Privacy & Data Protection</Text>
              <Text style={styles.settingSub}>Encrypted private media storage</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>

          {/* Help & Support */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('Help & Support', 'Reach municipal response support via support@ecopulse.civic or in-app hotline.')}
            activeOpacity={0.7}
          >
            <View style={styles.settingIconCircle}>
              <Ionicons name="help-buoy-outline" size={18} color={theme.colors.forest} />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Help & Support</Text>
              <Text style={styles.settingSub}>Community guidelines and FAQ</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Log Out Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>

        {/* App Version Footer */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerBrand}>EcoPulse Mobile v1.2.0</Text>
          <Text style={styles.footerSub}>Civic Environmental Intelligence & Waste Action</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background, // #F4F8F5
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.forest,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C6E7D2',
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.forest,
  },
  communityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  communityTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.forest,
  },

  // Stats Card
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.forest,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },

  // Settings Group Card
  settingsGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.forest,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingTextWrap: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.forest,
  },
  settingSub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 1,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 20,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },

  // Footer
  footerWrap: {
    alignItems: 'center',
  },
  footerBrand: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  footerSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
