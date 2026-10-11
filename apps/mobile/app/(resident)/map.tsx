import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { theme } from '../../constants/theme';
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

const DEFAULT_CENTER = {
  lat: 18.5204,
  lng: 73.8567,
};

export default function MapScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showReports, setShowReports] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // 1. Fetch Cluster & Map Overview
  const {
    data: mapData,
    isLoading: isMapLoading,
    refetch: refetchMap,
  } = useQuery({
    queryKey: ['map-overview'],
    queryFn: () => api.geo.mapOverview(),
    staleTime: 60 * 1000,
  });

  // 2. Fetch Active Reports List
  const {
    data: reportsData,
    isLoading: isReportsLoading,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ['map-reports'],
    queryFn: () => api.reports.list(),
    staleTime: 60 * 1000,
  });

  const clusters = mapData?.clusters ?? [];
  const reportsList = reportsData ?? [];

  // Filter nearby reports based on search query
  const nearbyReports = useMemo(() => {
    if (!searchQuery.trim()) return reportsList.slice(0, 15);
    const q = searchQuery.toLowerCase();
    return reportsList.filter(
      (r) =>
        r.title?.toLowerCase().includes(q) ||
        r.locationAddress?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q)
    );
  }, [reportsList, searchQuery]);

  // Generate self-contained Leaflet HTML (works 100% on iOS, Android, Expo Go, Web)
  const leafletHtml = useMemo(() => {
    const clusterFeatures = clusters.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      lat: c.center.lat,
      lng: c.center.lng,
      openReports: c.openReportsCount ?? 0,
      boundary: c.boundaryGeoJson,
    }));

    const reportFeatures = reportsList
      .map((r) => {
        const coords = (r.locationGeoJson as any)?.coordinates;
        if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') return null;
        return {
          id: r.id,
          title: r.title || 'Waste report',
          category: r.category || 'WASTE_HOTSPOT',
          status: r.status,
          lat: coords[1],
          lng: coords[0],
          address: r.locationAddress || 'Civic location',
        };
      })
      .filter(Boolean);

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
      background: #F4F8F5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .leaflet-popup-content-wrapper {
      border-radius: 14px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      padding: 2px;
    }
    .leaflet-popup-content {
      margin: 10px 14px;
      line-height: 1.4;
      font-size: 13px;
    }
    .popup-title {
      font-weight: 800;
      color: #0E3B2E;
      font-size: 14px;
      margin-bottom: 2px;
    }
    .popup-sub {
      color: #64748B;
      font-size: 11px;
      margin-bottom: 6px;
    }
    .popup-tag {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      background: #FAF5FF;
      color: #7E22CE;
      border: 1px solid #E9D5FF;
    }
    .hotspot-pin {
      background: #EF4444;
      border: 2.5px solid #FFFFFF;
      border-radius: 50%;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.45);
      font-size: 11px;
      color: white;
    }
    .report-pin {
      background: #7E22CE;
      border: 2.5px solid #FFFFFF;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(126, 34, 206, 0.4);
      font-size: 10px;
      color: white;
    }
    .user-pulse {
      background: #0284C7;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      box-shadow: 0 0 0 4px rgba(2, 132, 199, 0.35);
    }
    .leaflet-control-attribution {
      font-size: 8px !important;
      background: rgba(255, 255, 255, 0.6) !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: true
    }).setView([${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng}], 13);

    // Reliable OpenStreetMap standard tiles (Zero API keys required)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var clustersGroup = L.layerGroup().addTo(map);
    var reportsGroup = L.layerGroup().addTo(map);
    var userGroup = L.layerGroup().addTo(map);

    var clustersData = ${JSON.stringify(clusterFeatures)};
    var reportsData = ${JSON.stringify(reportFeatures)};

    // 1. Render Cluster Hotspots
    function renderClusters() {
      clustersGroup.clearLayers();
      clustersData.forEach(function(c) {
        // Red radar coverage circle
        L.circle([c.lat, c.lng], {
          radius: 550,
          color: '#EF4444',
          weight: 1.5,
          fillColor: '#EF4444',
          fillOpacity: 0.16
        }).addTo(clustersGroup);

        // Flame pin icon
        var icon = L.divIcon({
          className: 'custom-icon',
          html: '<div class="hotspot-pin">🔥</div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        var marker = L.marker([c.lat, c.lng], { icon: icon }).addTo(clustersGroup);
        marker.bindPopup(
          '<div class="popup-title">🔥 ' + c.name + '</div>' +
          '<div class="popup-sub">Ward Code: ' + c.code + '</div>' +
          '<span class="popup-tag" style="background:#FEF2F2;color:#DC2626;border-color:#FCA5A5;">' + c.openReports + ' Active Alerts</span>'
        );
      });
    }

    // 2. Render Incident Reports
    function renderReports() {
      reportsGroup.clearLayers();
      reportsData.forEach(function(r) {
        var icon = L.divIcon({
          className: 'custom-icon',
          html: '<div class="report-pin">📍</div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        var marker = L.marker([r.lat, r.lng], { icon: icon }).addTo(reportsGroup);
        marker.bindPopup(
          '<div class="popup-title">' + r.title + '</div>' +
          '<div class="popup-sub">' + r.address + '</div>' +
          '<span class="popup-tag">' + r.status.replace(/_/g, ' ') + '</span>'
        );

        marker.on('click', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'REPORT_CLICKED',
              id: r.id
            }));
          }
        });
      });
    }

    renderClusters();
    renderReports();

    // Layer Visibility Controllers
    window.toggleHotspots = function(visible) {
      if (visible) { map.addLayer(clustersGroup); } else { map.removeLayer(clustersGroup); }
    };

    window.toggleReports = function(visible) {
      if (visible) { map.addLayer(reportsGroup); } else { map.removeLayer(reportsGroup); }
    };

    // Navigation and Camera API
    window.flyToLocation = function(lat, lng, zoom) {
      map.flyTo([lat, lng], zoom || 16, { duration: 1.2 });
    };

    window.setUserLocation = function(lat, lng) {
      userGroup.clearLayers();
      var icon = L.divIcon({
        className: 'user-icon',
        html: '<div class="user-pulse"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      L.marker([lat, lng], { icon: icon }).addTo(userGroup);
    };

    window.zoomIn = function() { map.zoomIn(); };
    window.zoomOut = function() { map.zoomOut(); };
    window.resetMapView = function() {
      map.flyTo([${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng}], 13, { duration: 1 });
    };
  </script>
</body>
</html>`;
  }, [clusters, reportsList]);

  // Center on user location via device GPS
  const handleMyLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission Required', 'Please enable location services to center on your position.');
        setIsLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      webViewRef.current?.injectJavaScript(`
        if (window.setUserLocation) { window.setUserLocation(${loc.coords.latitude}, ${loc.coords.longitude}); }
        if (window.flyToLocation) { window.flyToLocation(${loc.coords.latitude}, ${loc.coords.longitude}, 16); }
        true;
      `);
    } catch (err: any) {
      Alert.alert('Location Error', err.message || 'Could not acquire device position');
    } finally {
      setIsLocating(false);
    }
  };

  const handleZoom = (direction: 'IN' | 'OUT') => {
    if (direction === 'IN') {
      webViewRef.current?.injectJavaScript(`if (window.zoomIn) { window.zoomIn(); } true;`);
    } else {
      webViewRef.current?.injectJavaScript(`if (window.zoomOut) { window.zoomOut(); } true;`);
    }
  };

  const handleToggleReports = () => {
    const next = !showReports;
    setShowReports(next);
    webViewRef.current?.injectJavaScript(`if (window.toggleReports) { window.toggleReports(${next}); } true;`);
  };

  const handleToggleHotspots = () => {
    const next = !showHotspots;
    setShowHotspots(next);
    webViewRef.current?.injectJavaScript(`if (window.toggleHotspots) { window.toggleHotspots(${next}); } true;`);
  };

  const handleCardPress = (report: any) => {
    const coords = (report.locationGeoJson as any)?.coordinates;
    if (coords && coords[1] && coords[0]) {
      setSelectedReportId(report.id);
      webViewRef.current?.injectJavaScript(`
        if (window.flyToLocation) { window.flyToLocation(${coords[1]}, ${coords[0]}, 17); }
        true;
      `);
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'REPORT_CLICKED') {
        setSelectedReportId(data.id);
      }
    } catch {
      // Ignore non-json bridge messages
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ANALYZED':
        return { bg: theme.colors.status.analyzedBg, text: theme.colors.status.analyzedText, label: 'Analyzed' };
      case 'FLAGGED_FOR_REVIEW':
      case 'REVIEW_REQUIRED':
        return { bg: theme.colors.status.reviewBg, text: theme.colors.status.reviewText, label: 'Needs Review' };
      case 'RESOLVED':
        return { bg: theme.colors.status.resolvedBg, text: theme.colors.status.resolvedText, label: 'Resolved' };
      case 'IN_PROGRESS':
        return { bg: theme.colors.status.processingBg, text: theme.colors.status.processingText, label: 'In Progress' };
      default:
        return { bg: theme.colors.status.pendingBg, text: theme.colors.status.pendingText, label: 'Submitted' };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Search & Filter Bar */}
      <View style={styles.topHeader}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Pune area, street, or hotspot..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Quick Filter Chips */}
        <View style={styles.chipsRow}>
          {/* Reports Chip */}
          <TouchableOpacity
            style={[styles.chip, showReports && styles.chipActivePurple]}
            onPress={handleToggleReports}
            activeOpacity={0.8}
          >
            <Ionicons
              name="location"
              size={15}
              color={showReports ? '#7E22CE' : theme.colors.textSecondary}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.chipText, showReports && styles.chipTextPurple]}>
              Reports ({reportsList.length})
            </Text>
          </TouchableOpacity>

          {/* Hotspots Chip */}
          <TouchableOpacity
            style={[styles.chip, showHotspots && styles.chipActiveRed]}
            onPress={handleToggleHotspots}
            activeOpacity={0.8}
          >
            <Ionicons
              name="flame"
              size={15}
              color={showHotspots ? '#DC2626' : theme.colors.textSecondary}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.chipText, showHotspots && styles.chipTextRed]}>
              Hotspots ({clusters.length})
            </Text>
          </TouchableOpacity>

          {/* My Location Chip */}
          <TouchableOpacity
            style={styles.chip}
            onPress={handleMyLocation}
            activeOpacity={0.8}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color="#0284C7" style={{ marginRight: 5 }} />
            ) : (
              <Ionicons name="navigate-circle" size={16} color="#0284C7" style={{ marginRight: 5 }} />
            )}
            <Text style={[styles.chipText, { color: '#0284C7' }]}>My Location</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Map Surface (Leaflet OpenStreetMap in WebView) */}
      <View style={styles.mapWrap}>
        <RNCWebView
          ref={webViewRef}
          style={StyleSheet.absoluteFill}
          source={{ html: leafletHtml }}
          originWhitelist={['*']}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.mapLoadingText}>Loading live municipal map...</Text>
            </View>
          )}
        />

        {/* Map Floating Zoom & Reset Controls */}
        <View style={styles.floatingControls}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleMyLocation}
            activeOpacity={0.8}
          >
            <Ionicons name="locate" size={20} color={theme.colors.forest} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => handleZoom('IN')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={theme.colors.forest} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => handleZoom('OUT')}
            activeOpacity={0.8}
          >
            <Ionicons name="remove" size={20} color={theme.colors.forest} />
          </TouchableOpacity>
        </View>

        {/* Bottom Sheet for Nearby Reports */}
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>

          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <Ionicons name="navigate-circle" size={20} color={theme.colors.primary} />
              <Text style={styles.sheetHeaderTitle}>Nearby Incidents & Alerts</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                refetchMap();
                refetchReports();
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {/* List of nearby report items */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sheetScrollContent}
          >
            {nearbyReports.length === 0 ? (
              <View style={styles.emptyNearbyBox}>
                <Text style={styles.emptyNearbyText}>No nearby environmental incidents reported</Text>
              </View>
            ) : (
              nearbyReports.map((report) => {
                const badge = getStatusBadge(report.status);
                const thumb = report.evidence?.[0]?.mediaUrl;
                const isSelected = selectedReportId === report.id;

                return (
                  <TouchableOpacity
                    key={report.id}
                    style={[styles.nearbyCard, isSelected && styles.nearbyCardSelected]}
                    onPress={() => handleCardPress(report)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.nearbyThumbWrap}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.nearbyThumb} />
                      ) : (
                        <View style={styles.nearbyThumbFallback}>
                          <Ionicons name="trash-outline" size={18} color={theme.colors.primary} />
                        </View>
                      )}
                    </View>

                    <View style={styles.nearbyInfoWrap}>
                      <Text style={styles.nearbyTitle} numberOfLines={1}>
                        {report.title || 'Waste report'}
                      </Text>
                      <Text style={styles.nearbyAddress} numberOfLines={1}>
                        {report.locationAddress || 'Pune Municipal Ward'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                        <View style={[styles.nearbyBadge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.nearbyBadgeText, { color: badge.text }]}>
                            {badge.label}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => router.push(`/(resident)/report/${report.id}` as any)}
                          style={styles.viewLink}
                        >
                          <Text style={styles.viewLinkText}>Details ›</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  chipActivePurple: {
    borderColor: '#C084FC',
    backgroundColor: '#FAF5FF',
  },
  chipActiveRed: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  chipTextPurple: {
    color: '#7E22CE',
  },
  chipTextRed: {
    color: '#DC2626',
  },
  mapWrap: {
    flex: 1,
    position: 'relative',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  mapLoadingText: {
    marginTop: 10,
    fontSize: 13,
    color: theme.colors.forest,
    fontWeight: '600',
  },
  floatingControls: {
    position: 'absolute',
    top: 14,
    right: 14,
    gap: 8,
    zIndex: 5,
  },
  controlBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 22,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    ...theme.shadows.card,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  sheetHandle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sheetHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.forest,
    marginLeft: 6,
  },
  sheetScrollContent: {
    gap: 10,
    paddingVertical: 2,
  },
  emptyNearbyBox: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 280,
  },
  emptyNearbyText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  nearbyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: 260,
    ...theme.shadows.card,
  },
  nearbyCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F0FDF4',
  },
  nearbyThumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 10,
  },
  nearbyThumb: {
    width: '100%',
    height: '100%',
  },
  nearbyThumbFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyInfoWrap: {
    flex: 1,
  },
  nearbyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  nearbyAddress: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginVertical: 1,
  },
  nearbyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nearbyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  viewLink: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  viewLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});
