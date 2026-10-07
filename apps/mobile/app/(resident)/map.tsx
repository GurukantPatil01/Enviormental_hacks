import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import type { ClusterSummary, MapOverview } from '@ecopulse/types';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import { api } from '../../lib/api';

const NativeMapView = MapView as unknown as React.ComponentType<any>;
const NativePolygon = Polygon as unknown as React.ComponentType<any>;
const NativeMarker = Marker as unknown as React.ComponentType<any>;

const PUNE_CENTER = { lat: 18.512, lng: 73.825 };

function stateColor(cluster: ClusterSummary): string {
  const m = cluster.metrics;
  const env = m?.environment ?? 60;
  const part = m?.participation ?? 50;
  const incidents = m?.incidentsOpen ?? 0;
  if (incidents >= 4 || env < 55) return 'rgba(220, 38, 38, 0.28)'; // needs attention
  if (env >= 80 && part >= 70) return 'rgba(22, 163, 74, 0.28)'; // thriving
  return 'rgba(217, 119, 6, 0.28)'; // steady
}

function strokeColor(cluster: ClusterSummary): string {
  const fill = stateColor(cluster);
  if (fill.includes('220')) return colors.status.error;
  if (fill.includes('22,')) return colors.status.success;
  return colors.status.warning;
}

function toPolygonCoords(geojson: Record<string, unknown>) {
  const coords = (geojson as any)?.coordinates?.[0] as Array<[number, number]> | undefined;
  if (!coords) return [];
  return coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

export default function MapScreen() {
  const router = useRouter();
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['map-overview'],
    queryFn: () => api.geo.mapOverview(),
  });

  const clusters = data?.clusters ?? [];
  const reports = useMemo(() => data?.reports ?? [], [data]);

  const initialRegion = useMemo(() => {
    if (clusters.length === 0) {
      return {
        latitude: PUNE_CENTER.lat,
        longitude: PUNE_CENTER.lng,
        latitudeDelta: 0.14,
        longitudeDelta: 0.18,
      };
    }
    const lats = clusters.flatMap((c) => [c.center.lat]);
    const lngs = clusters.flatMap((c) => [c.center.lng]);
    const lat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const lng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    return { latitude: lat, longitude: lng, latitudeDelta: 0.08, longitudeDelta: 0.1 };
  }, [clusters]);

  const selected = clusters.find((c) => c.id === selectedClusterId) ?? null;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[900]} />
        <Text style={styles.loadingText}>Loading community map…</Text>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Map unavailable</Text>
        <Text style={styles.errorSub}>{(error as Error)?.message}</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>EcoPulse Map</Text>
        <Text style={styles.subtitle}>
          What's happening environmentally around you
        </Text>
      </View>

      <View style={styles.mapContainer}>
        <NativeMapView
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          provider={PROVIDER_DEFAULT}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
        >
          {clusters.map((cluster) => {
            const coords = toPolygonCoords(cluster.boundaryGeoJson);
            if (coords.length === 0) return null;
            return (
              <NativePolygon
                key={cluster.id}
                coordinates={coords}
                fillColor={stateColor(cluster)}
                strokeColor={selectedClusterId === cluster.id ? colors.primary[900] : strokeColor(cluster)}
                strokeWidth={selectedClusterId === cluster.id ? 3 : 1.5}
                tappable
                onPress={() => setSelectedClusterId(cluster.id)}
              />
            );
          })}

          {reports.map((r) => (
            <NativeMarker
              key={r.id}
              coordinate={{ latitude: r.lat, longitude: r.lng }}
              title={r.category.replace(/_/g, ' ')}
              description={r.status.replace(/_/g, ' ')}
              pinColor={r.status === 'RESOLVED' || r.status === 'CLOSED' ? 'green' : 'red'}
            />
          ))}
        </NativeMapView>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: colors.status.success }]} />
            <Text style={styles.legendText}>Thriving</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: colors.status.warning }]} />
            <Text style={styles.legendText}>Steady</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: colors.status.error }]} />
            <Text style={styles.legendText}>Needs attention</Text>
          </View>
        </View>
      </View>

      {/* Cluster bottom sheet */}
      {selected && (
        <Pressable
          style={styles.sheet}
          onPress={() => router.push({ pathname: '/(resident)/cluster/[id]', params: { id: selected.id } })}
        >
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetCode}>{selected.code}</Text>
              <Text style={styles.sheetName}>{selected.name}</Text>
            </View>
            <Text style={styles.sheetMembers}>{selected.memberCount.toLocaleString()} members</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <View style={[styles.chip, { backgroundColor: colors.primary[50] }]}>
              <Text style={styles.chipLabel}>Environment</Text>
              <Text style={styles.chipValue}>{selected.metrics?.environment ?? '—'}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: colors.accent.pointsBg }]}>
              <Text style={styles.chipLabel}>Participation</Text>
              <Text style={styles.chipValue}>{selected.metrics?.participation ?? '—'}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: colors.neutral[100] }]}>
              <Text style={styles.chipLabel}>Service</Text>
              <Text style={styles.chipValue}>{selected.metrics?.service ?? '—'}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: colors.accent.streakBg }]}>
              <Text style={styles.chipLabel}>Open incidents</Text>
              <Text style={styles.chipValue}>{selected.openReportsCount ?? 0}</Text>
            </View>
          </ScrollView>

          <Text style={styles.sheetCta}>View cluster detail →</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.surface.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  loadingText: { ...typography.body, color: colors.neutral[600] },
  errorTitle: { ...typography.h2, color: colors.neutral[900] },
  errorSub: { ...typography.caption, color: colors.neutral[500], textAlign: 'center' },
  retryButton: {
    backgroundColor: colors.primary[900],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  retryButtonText: { ...typography.bodyBold, color: colors.surface.white },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.neutral[900] },
  subtitle: { ...typography.body, color: colors.neutral[600], marginTop: 2 },
  mapContainer: { flex: 1, overflow: 'hidden', marginHorizontal: spacing.base, borderRadius: radius.lg },
  legend: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.caption, color: colors.neutral[700] },
  sheet: {
    backgroundColor: colors.surface.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    gap: spacing.md,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetCode: { ...typography.caption, color: colors.primary[700], fontWeight: '700' },
  sheetName: { ...typography.h3, color: colors.neutral[900] },
  sheetMembers: { ...typography.caption, color: colors.neutral[500] },
  chipRow: { flexGrow: 0 },
  chip: { borderRadius: radius.md, padding: spacing.md, marginRight: spacing.sm, minWidth: 96 },
  chipLabel: { ...typography.caption, color: colors.neutral[600] },
  chipValue: { ...typography.h3, color: colors.neutral[900] },
  sheetCta: { ...typography.bodyBold, color: colors.primary[800] },
});
