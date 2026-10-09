import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import type { ClusterSummary, MapOverview } from '@ecopulse/types';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { api } from '../../lib/api';

const RNCWebView =
  Platform.OS === 'web'
    ? ({ source, style }: any) => (
        <iframe
          srcDoc={source?.html}
          style={{ border: 'none', width: '100%', height: '100%', ...(style || {}) }}
        />
      )
    : (WebView as any);
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PUNE_CENTER = { lat: 18.512, lng: 73.825 };

function getClusterColor(cluster: ClusterSummary): { stroke: string; fill: string; label: string } {
  const m = cluster.metrics;
  const env = m?.environment ?? 60;
  const incidents = m?.incidentsOpen ?? 0;
  if (incidents >= 4 || env < 55) {
    return { stroke: '#DC2626', fill: 'rgba(220, 38, 38, 0.35)', label: 'Needs Attention' };
  }
  if (env >= 75) {
    return { stroke: '#16A34A', fill: 'rgba(22, 163, 74, 0.35)', label: 'Optimal / Thriving' };
  }
  return { stroke: '#D97706', fill: 'rgba(217, 119, 6, 0.35)', label: 'Normal Operations' };
}

export default function MaintainerMapScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['maintainer-map-overview'],
    queryFn: () => api.geo.mapOverview(),
  });

  const clusters = data?.clusters ?? [];
  const reports = useMemo(() => data?.reports ?? [], [data]);

  const selectedCluster = useMemo(
    () => clusters.find((c) => c.id === selectedClusterId) ?? null,
    [clusters, selectedClusterId]
  );

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) ?? null,
    [reports, selectedReportId]
  );

  // Generate self-contained HTML running Leaflet.js with OpenStreetMap tiles
  const leafletHtml = useMemo(() => {
    const clusterFeatures = clusters.map((c) => {
      const colorInfo = getClusterColor(c);
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        center: c.center,
        boundary: c.boundaryGeoJson,
        stroke: colorInfo.stroke,
        fill: colorInfo.fill,
        statusLabel: colorInfo.label,
        openReports: c.openReportsCount ?? 0,
        activeMissions: c.activeMissionsCount ?? 0,
      };
    });

    const reportFeatures = reports.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      status: r.status,
      lat: r.lat,
      lng: r.lng,
      clusterCode: r.clusterCode,
    }));

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background: #F3F4F6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .cluster-tooltip {
      background: rgba(14, 59, 46, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #FFFFFF;
      font-weight: 700;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    }
    .report-marker {
      background: #DC2626;
      border: 2px solid #FFFFFF;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }
    .report-marker.VERIFIED {
      background: #16A34A;
    }
    .report-marker.UNDER_REVIEW {
      background: #D97706;
    }
    .leaflet-control-attribution {
      font-size: 9px;
      background: rgba(255, 255, 255, 0.7) !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([${PUNE_CENTER.lat}, ${PUNE_CENTER.lng}], 13);

    // Open-source OpenStreetMap standard tile layer (NO Google Maps required)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    var clustersData = ${JSON.stringify(clusterFeatures)};
    var reportsData = ${JSON.stringify(reportFeatures)};
    var polygonLayers = {};

    clustersData.forEach(function(c) {
      if (c.boundary && c.boundary.coordinates) {
        var geoLayer = L.geoJSON(c.boundary, {
          style: {
            color: c.stroke,
            weight: 2.5,
            fillColor: c.fill,
            fillOpacity: 0.35
          }
        }).addTo(map);

        geoLayer.bindTooltip(c.code + ' (' + c.openReports + ' alerts)', {
          permanent: true,
          direction: 'center',
          className: 'cluster-tooltip'
        });

        geoLayer.on('click', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'CLUSTER_SELECTED',
              id: c.id
            }));
          }
        });

        polygonLayers[c.id] = geoLayer;
      }
    });

    reportsData.forEach(function(r) {
      var icon = L.divIcon({
        className: 'report-marker ' + r.status,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      var marker = L.marker([r.lat, r.lng], { icon: icon }).addTo(map);
      marker.bindPopup('<b>' + r.category + '</b><br/>' + r.title + '<br/>Status: ' + r.status);
      marker.on('click', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'REPORT_SELECTED',
            id: r.id
          }));
        }
      });
    });

    window.flyToCluster = function(lat, lng) {
      map.flyTo([lat, lng], 15, { duration: 1 });
    };

    window.resetMapView = function() {
      map.flyTo([${PUNE_CENTER.lat}, ${PUNE_CENTER.lng}], 13, { duration: 1 });
    };
  </script>
</body>
</html>`;
  }, [clusters, reports]);

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'CLUSTER_SELECTED') {
        setSelectedClusterId(msg.id);
        setSelectedReportId(null);
      } else if (msg.type === 'REPORT_SELECTED') {
        setSelectedReportId(msg.id);
      }
    } catch {
      // Ignore unparseable messages
    }
  };

  const focusCluster = (c: ClusterSummary) => {
    setSelectedClusterId(c.id);
    setSelectedReportId(null);
    webViewRef.current?.injectJavaScript(`window.flyToCluster(${c.center.lat}, ${c.center.lng}); true;`);
  };

  const resetView = () => {
    setSelectedClusterId(null);
    setSelectedReportId(null);
    webViewRef.current?.injectJavaScript(`window.resetMapView(); true;`);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[900]} />
        <Text style={styles.loadingText}>Loading OpenStreetMap cluster overview…</Text>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Map data unavailable</Text>
        <Text style={styles.errorSub}>{(error as Error)?.message}</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Maintenance Top Bar */}
      <View style={styles.header}>
        <View>
          <View style={styles.badgeRow}>
            <View style={styles.liveDot} />
            <Text style={styles.headerKicker}>MAINTENANCE OPERATIONS</Text>
            <View style={styles.osmBadge}>
              <Text style={styles.osmBadgeText}>OpenStreetMap</Text>
            </View>
          </View>
          <Text style={styles.title}>Geographic Cluster Center</Text>
        </View>
        <Pressable
          style={styles.refreshIcon}
          onPress={() => {
            refetch();
            resetView();
          }}
        >
          <Text style={{ fontSize: 16 }}>🔄</Text>
        </Pressable>
      </View>

      {/* Cluster Quick-Switcher Carousel */}
      <View style={styles.clusterPillContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clusterPillScroll}>
          <Pressable
            style={[styles.pill, !selectedClusterId && styles.pillActive]}
            onPress={resetView}
          >
            <Text style={[styles.pillText, !selectedClusterId && styles.pillTextActive]}>
              All Clusters ({clusters.length})
            </Text>
          </Pressable>
          {clusters.map((c) => {
            const isActive = selectedClusterId === c.id;
            return (
              <Pressable
                key={c.id}
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => focusCluster(c)}
              >
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                  {c.code}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Embedded OpenStreetMap View */}
      <View style={styles.mapContainer}>
        <RNCWebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: leafletHtml }}
          style={styles.webView}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.webLoading}>
              <ActivityIndicator size="small" color={colors.primary[900]} />
              <Text style={styles.webLoadingText}>Rendering OpenStreetMap tiles…</Text>
            </View>
          )}
        />
      </View>

      {/* Bottom Inspector Sheet */}
      {selectedReport ? (
        <View style={styles.drawer}>
          <View style={styles.drawerHeader}>
            <View style={styles.incidentTag}>
              <Text style={styles.incidentTagText}>{selectedReport.category}</Text>
            </View>
            <Text style={styles.drawerStatus}>{selectedReport.status}</Text>
            <Pressable onPress={() => setSelectedReportId(null)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.drawerTitle}>{selectedReport.title}</Text>
          <Text style={styles.drawerSub}>
            Cluster: {selectedReport.clusterCode || 'Unassigned'} • Geo-tagged incident
          </Text>
          <View style={styles.actionRow}>
            <Pressable
              style={styles.primaryActionBtn}
              onPress={() => router.push('/(maintainer)/incidents')}
            >
              <Text style={styles.primaryActionBtnText}>Inspect in Incident Center</Text>
            </Pressable>
          </View>
        </View>
      ) : selectedCluster ? (
        <View style={styles.drawer}>
          <View style={styles.drawerHeader}>
            <View style={styles.clusterCodeBadge}>
              <Text style={styles.clusterCodeText}>{selectedCluster.code}</Text>
            </View>
            <Text style={styles.clusterStatusLabel}>
              {getClusterColor(selectedCluster).label}
            </Text>
            <Pressable onPress={() => setSelectedClusterId(null)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.drawerTitle}>{selectedCluster.name}</Text>
          <Text style={styles.drawerSub}>
            Ward: {selectedCluster.wardName || 'Pune Ward'} • Members: {selectedCluster.memberCount}
          </Text>

          {/* Metric Indicators */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricVal}>
                {selectedCluster.metrics?.environment != null ? `${selectedCluster.metrics.environment}%` : '—'}
              </Text>
              <Text style={styles.metricLabel}>Environment</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricVal}>
                {selectedCluster.metrics?.participation != null ? `${selectedCluster.metrics.participation}%` : '—'}
              </Text>
              <Text style={styles.metricLabel}>Participation</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricVal}>
                {selectedCluster.openReportsCount ?? 0}
              </Text>
              <Text style={styles.metricLabel}>Open Alerts</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricVal}>
                {selectedCluster.activeMissionsCount ?? 0}
              </Text>
              <Text style={styles.metricLabel}>Missions</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={styles.primaryActionBtn}
              onPress={() => router.push('/(maintainer)/tasks')}
            >
              <Text style={styles.primaryActionBtnText}>Dispatch Field Crew</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryActionBtn}
              onPress={() => router.push('/(maintainer)/incidents')}
            >
              <Text style={styles.secondaryActionBtnText}>Cluster Incidents</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            💡 Tap any cluster polygon or incident marker to inspect field status.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.neutral[600],
  },
  errorTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: '700',
    color: colors.status.error,
  },
  errorSub: {
    marginTop: spacing.sm,
    fontSize: typography.caption.fontSize,
    color: colors.neutral[600],
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.base,
    backgroundColor: colors.primary[900],
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  retryButtonText: {
    color: colors.surface.white,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success,
  },
  headerKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.primary[900],
  },
  osmBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  osmBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0369A1',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  refreshIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterPillContainer: {
    backgroundColor: colors.surface.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    paddingVertical: spacing.sm,
  },
  clusterPillScroll: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  pillActive: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  pillTextActive: {
    color: colors.surface.white,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  webLoading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webLoadingText: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.neutral[600],
  },
  drawer: {
    backgroundColor: colors.surface.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  clusterCodeBadge: {
    backgroundColor: colors.primary[900],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  clusterCodeText: {
    color: colors.surface.white,
    fontSize: 12,
    fontWeight: '700',
  },
  clusterStatusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  incidentTag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  incidentTagText: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '700',
  },
  drawerStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  closeBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.neutral[100],
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  drawerSub: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
    marginBottom: spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    padding: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary[900],
  },
  metricLabel: {
    fontSize: 10,
    color: colors.neutral[600],
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryActionBtn: {
    flex: 1,
    backgroundColor: colors.primary[900],
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryActionBtnText: {
    color: colors.surface.white,
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryActionBtn: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  secondaryActionBtnText: {
    color: colors.neutral[800],
    fontWeight: '600',
    fontSize: 13,
  },
  summaryBar: {
    backgroundColor: colors.surface.white,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  summaryText: {
    fontSize: 12,
    color: colors.neutral[600],
  },
});
