import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { theme } from '../../constants/theme';
import { api } from '../../lib/api';

// Conditional import for map components
let NativeMapView: any;
let NativePolygon: any;
let NativeCircle: any;
let NativeMarker: any;
let PROVIDER_DEFAULT: any;

if (Platform.OS === 'web') {
  NativeMapView = (props: any) => {
    const mapHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #F4F8F5; }
          .leaflet-popup-content-wrapper { border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([18.5204, 73.8567], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          // Hotspots
          var hotspots = [
            { lat: 18.528, lng: 73.850, r: 600 },
            { lat: 18.515, lng: 73.865, r: 500 },
            { lat: 18.508, lng: 73.840, r: 700 },
            { lat: 18.530, lng: 73.870, r: 550 }
          ];
          hotspots.forEach(function(h) {
            L.circle([h.lat, h.lng], {
              color: '#EF4444',
              fillColor: '#EF4444',
              fillOpacity: 0.15,
              radius: h.r
            }).addTo(map);
            L.circleMarker([h.lat, h.lng], {
              radius: 9,
              fillColor: '#EF4444',
              color: '#ffffff',
              weight: 2,
              fillOpacity: 1
            }).addTo(map).bindPopup('🔥 <b>Waste Hotspot</b><br>High incident frequency');
          });
        </script>
      </body>
      </html>
    `;
    return (
      <View style={[props.style, { overflow: 'hidden' }]}>
        <iframe
          srcDoc={mapHtml}
          style={{ border: 'none', width: '100%', height: '100%' }}
        />
      </View>
    );
  };
  NativePolygon = () => null;
  NativeCircle = () => null;
  NativeMarker = () => null;
  PROVIDER_DEFAULT = undefined;
} else {
  const MapView = require('react-native-maps').default;
  const { Polygon, Circle, Marker, PROVIDER_DEFAULT: prov } = require('react-native-maps');
  NativeMapView = MapView as unknown as React.ComponentType<any>;
  NativePolygon = Polygon as unknown as React.ComponentType<any>;
  NativeCircle = Circle as unknown as React.ComponentType<any>;
  NativeMarker = Marker as unknown as React.ComponentType<any>;
  PROVIDER_DEFAULT = prov;
}

const DEFAULT_CENTER = {
  latitude: 18.5204,
  longitude: 73.8567,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<any>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showReports, setShowReports] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [isLocating, setIsLocating] = useState(false);

  // Queries
  const {
    data: mapData,
    isLoading: isMapLoading,
    refetch: refetchMap,
  } = useQuery({
    queryKey: ['map-overview'],
    queryFn: () => api.geo.mapOverview(),
  });

  const {
    data: reportsData,
    isLoading: isReportsLoading,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ['map-reports'],
    queryFn: () => api.reports.list(),
  });

  const clusters = mapData?.clusters ?? [];
  const reportsList = reportsData ?? [];

  // Filter nearby reports based on search
  const nearbyReports = useMemo(() => {
    if (!searchQuery.trim()) return reportsList.slice(0, 10);
    const q = searchQuery.toLowerCase();
    return reportsList.filter(
      (r) =>
        r.title?.toLowerCase().includes(q) ||
        r.locationAddress?.toLowerCase().includes(q)
    );
  }, [reportsList, searchQuery]);

  // Center on user location
  const handleMyLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to center on your position.');
        setIsLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (mapRef.current && mapRef.current.animateToRegion) {
        mapRef.current.animateToRegion(
          {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          1000
        );
      }
    } catch (err: any) {
      Alert.alert('Location Error', err.message || 'Could not acquire position');
    } finally {
      setIsLocating(false);
    }
  };

  const handleZoom = (inOrOut: 'IN' | 'OUT') => {
    // Zoom helper for native maps if available
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
        return { bg: theme.colors.status.processingBg, text: theme.colors.status.processingText, label: 'Processing' };
      default:
        return { bg: theme.colors.status.pendingBg, text: theme.colors.status.pendingText, label: 'Submitted' };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Bar & Filter Header (Screenshot 1) */}
      <View style={styles.topHeader}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search location or area..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => {
              Alert.alert('Map Filters', 'Toggle between all reports and municipal hotspot zones.');
            }}
          >
            <Ionicons name="options-outline" size={20} color={theme.colors.forest} />
          </TouchableOpacity>
        </View>

        {/* Quick Filter Chips (Screenshot 1) */}
        <View style={styles.chipsRow}>
          {/* Reports Chip */}
          <TouchableOpacity
            style={[styles.chip, showReports && styles.chipActivePurple]}
            onPress={() => setShowReports(!showReports)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="location"
              size={15}
              color={showReports ? '#7E22CE' : theme.colors.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.chipText, showReports && styles.chipTextPurple]}>Reports</Text>
          </TouchableOpacity>

          {/* Hotspots Chip */}
          <TouchableOpacity
            style={[styles.chip, showHotspots && styles.chipActiveRed]}
            onPress={() => setShowHotspots(!showHotspots)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="flame"
              size={15}
              color={showHotspots ? '#DC2626' : theme.colors.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.chipText, showHotspots && styles.chipTextRed]}>Hotspots</Text>
          </TouchableOpacity>

          {/* My Location Chip */}
          <TouchableOpacity
            style={styles.chip}
            onPress={handleMyLocation}
            activeOpacity={0.8}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 4 }} />
            ) : (
              <Ionicons name="navigate-circle-outline" size={16} color="#0284C7" style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.chipText, { color: '#0284C7' }]}>My Location</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Map Surface */}
      <View style={styles.mapWrap}>
        <NativeMapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={DEFAULT_CENTER}
          provider={PROVIDER_DEFAULT}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
        >
          {/* Hotspot Circles & Markers */}
          {showHotspots &&
            clusters.map((cluster) => {
              return (
                <React.Fragment key={cluster.id}>
                  {NativeCircle && (
                    <NativeCircle
                      center={{ latitude: cluster.center.lat, longitude: cluster.center.lng }}
                      radius={600}
                      fillColor="rgba(239, 68, 68, 0.18)"
                      strokeColor="rgba(239, 68, 68, 0.4)"
                      strokeWidth={1.5}
                    />
                  )}
                  {NativeMarker && (
                    <NativeMarker
                      coordinate={{ latitude: cluster.center.lat, longitude: cluster.center.lng }}
                      title={cluster.name}
                      description={`Open incidents: ${cluster.openReportsCount ?? 0}`}
                    >
                      <View style={styles.hotspotPin}>
                        <Ionicons name="flame" size={14} color="#FFFFFF" />
                      </View>
                    </NativeMarker>
                  )}
                </React.Fragment>
              );
            })}

          {/* Report Markers */}
          {showReports &&
            reportsList.map((rep) => {
              const coords = (rep.locationGeoJson as any)?.coordinates;
              if (!coords || !coords[0] || !coords[1]) return null;
              return (
                NativeMarker && (
                  <NativeMarker
                    key={rep.id}
                    coordinate={{ latitude: coords[1], longitude: coords[0] }}
                    title={rep.title || 'Waste report'}
                    description={rep.status}
                    onCalloutPress={() => router.push(`/(resident)/report/${rep.id}` as any)}
                  >
                    <View style={styles.reportPin}>
                      <Ionicons name="location" size={16} color="#7E22CE" />
                    </View>
                  </NativeMarker>
                )
              );
            })}
        </NativeMapView>

        {/* Map Floating Controls (Screenshot 1: right side) */}
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

        {/* Bottom Sheet for Nearby Reports (Screenshot 1) */}
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>

          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <Ionicons name="navigate-circle" size={22} color={theme.colors.primary} />
              <Text style={styles.sheetHeaderTitle}>Nearby Reports</Text>
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
                <Text style={styles.emptyNearbyText}>No nearby environmental reports recorded</Text>
              </View>
            ) : (
              nearbyReports.map((report) => {
                const badge = getStatusBadge(report.status);
                const thumb = report.evidence?.[0]?.mediaUrl;

                return (
                  <TouchableOpacity
                    key={report.id}
                    style={styles.nearbyCard}
                    onPress={() => router.push(`/(resident)/report/${report.id}` as any)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.nearbyThumbWrap}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.nearbyThumb} />
                      ) : (
                        <View style={styles.nearbyThumbFallback}>
                          <Ionicons name="trash-outline" size={20} color={theme.colors.primary} />
                        </View>
                      )}
                    </View>

                    <View style={styles.nearbyInfoWrap}>
                      <Text style={styles.nearbyTitle} numberOfLines={1}>
                        {report.title || 'Waste report'}
                      </Text>
                      <Text style={styles.nearbyAddress} numberOfLines={1}>
                        {report.locationAddress || 'Pimpri Colony, Pune'}
                      </Text>
                      <View style={[styles.nearbyBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.nearbyBadgeText, { color: badge.text }]}>
                          {badge.label}
                        </Text>
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
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  filterBtn: {
    padding: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
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
    fontSize: 12,
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
  floatingControls: {
    position: 'absolute',
    top: 16,
    right: 16,
    gap: 8,
    zIndex: 5,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  hotspotPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
  },
  reportPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#C084FC',
    elevation: 3,
  },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    ...theme.shadows.card,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sheetHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.forest,
    marginLeft: 8,
  },
  sheetScrollContent: {
    gap: 12,
    paddingVertical: 4,
  },
  emptyNearbyBox: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    width: 300,
  },
  emptyNearbyText: {
    fontSize: 13,
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
    width: 250,
    ...theme.shadows.card,
  },
  nearbyThumbWrap: {
    width: 50,
    height: 50,
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
    marginVertical: 2,
  },
  nearbyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  nearbyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
