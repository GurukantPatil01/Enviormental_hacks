import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { useAuthStore } from '../../stores/auth.store';

export default function ResidentLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      {/* 1. Home Destination */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 2. Map Destination */}
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'map' : 'map-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 3. Report Destination (Visually Emphasized Center Floating Camera Button) */}
      <Tabs.Screen
        name="report"
        options={{
          title: 'Report',
          tabBarLabel: ({ focused }) => (
            <Text
              style={[
                styles.reportTabLabel,
                { color: focused ? theme.colors.forest : theme.colors.forest },
              ]}
            >
              Report
            </Text>
          ),
          tabBarIcon: () => (
            <View style={styles.centerCameraBtn}>
              <Ionicons name="camera" size={26} color="#FFFFFF" />
            </View>
          ),
        }}
      />

      {/* 4. Reports Destination (My Reports list) */}
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'document-text' : 'document-text-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 5. Profile Destination */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* Hidden Screens & Modals */}
      <Tabs.Screen
        name="report/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="points"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="impact"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="cluster/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="missions"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="mission/[id]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerCameraBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22, // Float slightly above the bottom tab bar
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  reportTabLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
});
