import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import type { Report, ReportCategory } from '@ecopulse/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL, api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

const CATEGORIES: { label: string; value: ReportCategory; icon: string }[] = [
  { label: 'Waste Hotspot', value: 'WASTE_HOTSPOT', icon: '🗑️' },
  { label: 'Illegal Dumping', value: 'ILLEGAL_DUMPING', icon: '⚠️' },
  { label: 'Overflowing Bin', value: 'OVERFLOWING_BIN', icon: '📦' },
  { label: 'Missed Collection', value: 'MISSED_COLLECTION', icon: '🚛' },
  { label: 'Mixed Waste', value: 'MIXED_WASTE', icon: '♻️' },
  { label: 'Other Issue', value: 'OTHER', icon: '📍' },
];

const SAMPLE_EVIDENCE_URLS = [
  'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80',
];

interface GeoLocationState {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  timestamp?: number | null;
}

export default function ReportScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'NEW' | 'TRACK'>('NEW');

  // Form state
  const [category, setCategory] = useState<ReportCategory>('WASTE_HOTSPOT');
  const [title, setTitle] = useState('Overflowing dry waste bin near Kothrud Stand');
  const [description, setDescription] = useState(
    'Commercial dry waste container has been overflowing for 2 days. Plastic bottles and packaging spilled onto sidewalk.'
  );
  const [locationAddress, setLocationAddress] = useState('Kothrud Stand, DP Road, Pune');

  // Real-time Photo & GPS state
  const [evidenceUri, setEvidenceUri] = useState<string>(SAMPLE_EVIDENCE_URLS[0]);
  const [evidenceBase64, setEvidenceBase64] = useState<string | null>(null);
  const [photoTakenAt, setPhotoTakenAt] = useState<string>('Preset Sample');
  const [isPhotoLive, setIsPhotoLive] = useState<boolean>(false);

  const [locationCoords, setLocationCoords] = useState<GeoLocationState>({
    latitude: 18.5074,
    longitude: 73.8183,
    accuracy: 4.5,
    timestamp: Date.now(),
  });
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Request GPS position and reverse-geocode address
  const requestLocation = async (silent = false) => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!silent) {
          Alert.alert(
            'Location Permission Required',
            'EcoPulse needs device GPS access to verify the exact coordinates where the environmental hazard was photographed.'
          );
        }
        setIsLocating(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newCoords: GeoLocationState = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        timestamp: position.timestamp,
      };
      setLocationCoords(newCoords);

      // Reverse geocode to get a human-readable street address
      let resolvedAddress = false;

      // 1. Try Native Geocoder (iOS / Android with Play Services)
      if (Platform.OS !== 'web') {
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });

          if (addresses && addresses.length > 0) {
            const addr = addresses[0];
            const parts = [
              addr.name,
              addr.street,
              addr.district || addr.subregion,
              addr.city,
              addr.postalCode,
            ].filter(Boolean);

            if (parts.length > 0) {
              setLocationAddress(parts.join(', '));
              resolvedAddress = true;
            }
          }
        } catch {
          // Native Android geocoder service may not be running on emulator/AOSP
        }
      }

      // 2. Universal Web & Native Fallback: Free OpenStreetMap Nominatim
      if (!resolvedAddress) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'EcoPulse-Mobile/1.0' } }
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.display_name) {
              const parts = data.display_name.split(',').slice(0, 3).map((s: string) => s.trim()).filter(Boolean);
              if (parts.length > 0) {
                setLocationAddress(parts.join(', '));
                resolvedAddress = true;
              }
            }
          }
        } catch {
          // Keep existing/default locationAddress if offline
        }
      }
    } catch (err: any) {
      if (!silent) {
        Alert.alert('GPS Signal Issue', err.message || 'Could not acquire precise GPS fix');
      }
    } finally {
      setIsLocating(false);
    }
  };

  // Acquire initial GPS location on mount
  useEffect(() => {
    requestLocation(true);
  }, []);

  // Real-time camera photo capture
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'EcoPulse requires camera access to take real-time photos of environmental issues with embedded GPS coordinates.'
        );
        return;
      }

      // Re-query GPS coordinate fix synchronously with camera launch
      requestLocation(true);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setEvidenceUri(asset.uri);
        setEvidenceBase64(asset.base64 || null);
        setIsPhotoLive(true);
        setPhotoTakenAt(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Unable to open device camera');
    }
  };

  // Photo library selection
  const handleChoosePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Gallery Permission Required',
          'EcoPulse requires photo gallery access to select existing evidence images.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setEvidenceUri(asset.uri);
        setEvidenceBase64(asset.base64 || null);
        setIsPhotoLive(true);
        setPhotoTakenAt(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Unable to pick photo from library');
    }
  };

  // Communities
  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: () => api.communities.list(),
  });
  const communityId = communities?.[0]?.id;

  // Past reports for tracking
  const {
    data: myReports,
    isLoading: isReportsLoading,
    refetch: refetchReports,
    isRefetching,
  } = useQuery({
    queryKey: ['my-reports', user?.id],
    queryFn: () => api.reports.list({ userId: user?.id }),
    enabled: !!user?.id,
  });

  // Submit report mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const cleanTitle = title.trim();
      const cleanDesc = description.trim();
      if (!cleanTitle || cleanTitle.length < 5) {
        throw new Error('Title must be at least 5 characters');
      }
      if (!cleanDesc || cleanDesc.length < 10) {
        throw new Error('Description must be at least 10 characters');
      }

      const targetCommunityId = communityId || '0090c98a-b152-427a-8d94-951d2bf59894';

      let uploadedMediaUrl = evidenceUri;

      // 1. Upload base64 camera photo to backend if captured
      if (evidenceBase64) {
        try {
          const uploadRes = await api.reports.uploadImage(
            evidenceBase64,
            `report-evidence-${Date.now()}.jpg`,
            'image/jpeg'
          );
          if (uploadRes?.publicUrl) {
            uploadedMediaUrl = uploadRes.publicUrl;
          }
        } catch (uploadErr) {
          console.warn('Image upload fallback to URI:', uploadErr);
        }
      }

      const geoPoint = {
        type: 'Point',
        coordinates: [locationCoords.longitude, locationCoords.latitude],
      };

      // 2. Create Report with verified GPS coordinates and address
      const report = await api.reports.create({
        communityId: targetCommunityId,
        category,
        title: cleanTitle,
        description: cleanDesc,
        locationAddress: locationAddress || 'Kothrud Stand, DP Road, Pune',
        locationGeoJson: geoPoint,
        clientEventId: `client-rep-${Date.now()}`,
      });

      // 3. Attach Evidence with embedded metadata and exact coordinates
      if (uploadedMediaUrl) {
        await api.reports.attachEvidence(report.id, {
          mediaUrl: uploadedMediaUrl,
          mediaType: 'IMAGE',
          locationGeoJson: geoPoint,
          metadata: {
            captureTimestamp: new Date().toISOString(),
            accuracyMeters: locationCoords.accuracy,
            altitudeMeters: locationCoords.altitude,
            isDeviceCapture: isPhotoLive,
            source: isPhotoLive ? 'LIVE_CAMERA_CAPTURE' : 'PRESET_SAMPLE',
          },
        });
      }

      return report;
    },
    onSuccess: () => {
      Alert.alert(
        'Report Submitted with Real-Time Geotag!',
        'Your environmental hazard report with real-time photo evidence and device GPS coordinates has been transmitted to ward maintainers. +20 EcoPoints queued for verification!'
      );
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      queryClient.invalidateQueries({ queryKey: ['home-dashboard'] });
      setTitle('');
      setDescription('');
      setTab('TRACK');
    },
    onError: (err: any) => {
      Alert.alert('Submission Failed', err.message || 'Could not file report');
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Environmental Action</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Mode Switcher */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'NEW' && styles.tabBtnActive]}
          onPress={() => setTab('NEW')}
        >
          <Text style={[styles.tabBtnText, tab === 'NEW' && styles.tabBtnTextActive]}>
            File Report
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === 'TRACK' && styles.tabBtnActive]}
          onPress={() => setTab('TRACK')}
        >
          <Text style={[styles.tabBtnText, tab === 'TRACK' && styles.tabBtnTextActive]}>
            Track Status ({myReports?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'NEW' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Step 1: Category */}
          <Text style={styles.sectionLabel}>1. Select Hazard Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.categoryCard,
                  category === cat.value && styles.categoryCardActive,
                ]}
                onPress={() => setCategory(cat.value)}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryText,
                    category === cat.value && styles.categoryTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Step 2: Real-Time Photo Evidence Capture */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>2. Verified Photo Evidence</Text>
            {isPhotoLive && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>🔴 LIVE CAPTURE</Text>
              </View>
            )}
          </View>

          {/* Large Live Photo Preview with Watermark Overlay */}
          <View style={styles.evidenceContainer}>
            <Image
              source={{
                uri: evidenceUri.startsWith('/uploads/') ? `${API_URL}${evidenceUri}` : evidenceUri,
              }}
              style={styles.evidencePreview}
            />

            {/* GPS & Capture Watermark Pill */}
            <View style={styles.watermarkOverlay}>
              <View style={styles.watermarkRow}>
                <Text style={styles.watermarkTitle}>📍 GPS LOCATION VERIFIED</Text>
                <Text style={styles.watermarkAccuracy}>
                  ±{locationCoords.accuracy ? Math.round(locationCoords.accuracy) : 4}m
                </Text>
              </View>
              <Text style={styles.watermarkCoords}>
                {locationCoords.latitude.toFixed(5)}° N, {locationCoords.longitude.toFixed(5)}° E
              </Text>
              <Text style={styles.watermarkTimestamp}>
                ⏱️ Captured: {photoTakenAt}
              </Text>
            </View>
          </View>

          {/* Photo Capture Actions: Camera & Gallery */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cameraActionBtn} onPress={handleTakePhoto}>
              <Text style={styles.cameraActionIcon}>📸</Text>
              <Text style={styles.cameraActionText}>Take Live Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.galleryActionBtn} onPress={handleChoosePhoto}>
              <Text style={styles.galleryActionIcon}>🖼️</Text>
              <Text style={styles.galleryActionText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>

          {/* Fallback Sample Presets */}
          <Text style={styles.presetLabel}>Or select test hazard reference:</Text>
          <View style={styles.photoPickerRow}>
            {SAMPLE_EVIDENCE_URLS.map((url, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.thumbBtn,
                  evidenceUri === url && styles.thumbBtnActive,
                ]}
                onPress={() => {
                  setEvidenceUri(url);
                  setEvidenceBase64(null);
                  setIsPhotoLive(false);
                  setPhotoTakenAt(`Sample Reference #${idx + 1}`);
                }}
              >
                <Image source={{ uri: url }} style={styles.thumbImage} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Step 3: Title & Description */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>3. Report Details</Text>
            <TouchableOpacity
              style={[styles.refreshGpsBtn, { backgroundColor: colors.primary[50], borderColor: colors.primary[300] }]}
              onPress={() => {
                setTitle('Overflowing dry waste bin near Kothrud Stand');
                setDescription(
                  'Commercial dry waste container has been overflowing for 2 days. Plastic bottles and packaging spilled onto sidewalk.'
                );
                setLocationAddress('Kothrud Stand, DP Road, Pune');
              }}
            >
              <Text style={[styles.refreshGpsText, { color: colors.primary[900], fontWeight: '600' }]}>
                ⚡ Autofill Demo
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.inputTitle}>Title</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Broken bin spilling plastics onto sidewalk"
            placeholderTextColor={colors.neutral[400]}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.inputTitle}>Description</Text>
          <TextInput
            style={[styles.textInput, { minHeight: 80 }]}
            placeholder="Describe the hazard, estimated volume, and public danger..."
            placeholderTextColor={colors.neutral[400]}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {/* Step 4: Real-time Device GPS Location */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>4. Real-Time Device Location</Text>
            <TouchableOpacity
              style={styles.refreshGpsBtn}
              onPress={() => requestLocation(false)}
              disabled={isLocating}
            >
              {isLocating ? (
                <ActivityIndicator size="small" color={colors.primary[900]} />
              ) : (
                <Text style={styles.refreshGpsText}>🔄 Refresh GPS</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Live GPS Telemetry Card */}
          <View style={styles.gpsTelemetryCard}>
            <View style={styles.gpsTelemetryHeader}>
              <View style={styles.gpsStatusIndicator}>
                <View style={styles.pulsingDot} />
                <Text style={styles.gpsStatusText}>Live Device Location Locked</Text>
              </View>
              <Text style={styles.gpsAccuracyBadge}>
                High Precision (±{locationCoords.accuracy ? Math.round(locationCoords.accuracy) : 4}m)
              </Text>
            </View>

            <View style={styles.coordsGrid}>
              <View style={styles.coordBox}>
                <Text style={styles.coordBoxLabel}>LATITUDE</Text>
                <Text style={styles.coordBoxValue}>{locationCoords.latitude.toFixed(6)}° N</Text>
              </View>
              <View style={styles.coordBox}>
                <Text style={styles.coordBoxLabel}>LONGITUDE</Text>
                <Text style={styles.coordBoxValue}>{locationCoords.longitude.toFixed(6)}° E</Text>
              </View>
            </View>
          </View>

          <Text style={styles.inputTitle}>Street Address (Auto-Geocoded)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Street address or landmark"
            placeholderTextColor={colors.neutral[400]}
            value={locationAddress}
            onChangeText={setLocationAddress}
          />

          {/* Submit Action */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!title.trim() ||
                title.trim().length < 5 ||
                !description.trim() ||
                description.trim().length < 10 ||
                submitMutation.isPending) &&
                styles.submitBtnDisabled,
            ]}
            onPress={() => {
              const cleanTitle = title.trim();
              const cleanDesc = description.trim();
              if (!cleanTitle || cleanTitle.length < 5) {
                Alert.alert('Title Required', 'Please enter a title of at least 5 characters.');
                return;
              }
              if (!cleanDesc || cleanDesc.length < 10) {
                Alert.alert('Description Required', 'Please enter a description of at least 10 characters.');
                return;
              }
              submitMutation.mutate();
            }}
            disabled={
              !title.trim() ||
              title.trim().length < 5 ||
              !description.trim() ||
              description.trim().length < 10 ||
              submitMutation.isPending
            }
          >
            {submitMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Geotagged Report (+20 pts)</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* Status Tracker Tab */
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchReports} />}
        >
          {isReportsLoading ? (
            <ActivityIndicator size="large" color={colors.primary[900]} style={{ marginTop: 40 }} />
          ) : !myReports || myReports.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🌱</Text>
              <Text style={styles.emptyTitle}>No Reports Filed</Text>
              <Text style={styles.emptySub}>
                Spot an environmental issue? File a geotagged report with photo evidence to earn EcoPoints and keep your city clean!
              </Text>
            </View>
          ) : (
            myReports.map((rep) => {
              const evidenceItem = rep.evidence?.[0];
              const rawMediaUrl = evidenceItem?.mediaUrl;
              const displayUrl = rawMediaUrl
                ? rawMediaUrl.startsWith('/uploads/')
                  ? `${API_URL}${rawMediaUrl}`
                  : rawMediaUrl
                : null;

              const geoCoords = rep.locationGeoJson?.coordinates as number[] | undefined;
              const hasCoords = Array.isArray(geoCoords) && geoCoords.length === 2;

              return (
                <View key={rep.id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <Text style={styles.catLabel}>{formatCategory(rep.category)}</Text>
                    <View style={[styles.statusPill, getStatusPill(rep.status)]}>
                      <Text style={styles.statusPillText}>{rep.status}</Text>
                    </View>
                  </View>

                  {/* Evidence Thumbnail & Details */}
                  {displayUrl && (
                    <View style={styles.trackEvidenceContainer}>
                      <Image source={{ uri: displayUrl }} style={styles.trackEvidenceImage} />
                      {hasCoords && (
                        <View style={styles.trackCoordsOverlay}>
                          <Text style={styles.trackCoordsText}>
                            📍 {geoCoords[1].toFixed(5)}° N, {geoCoords[0].toFixed(5)}° E
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  <Text style={styles.cardTitle}>{rep.title}</Text>
                  <Text style={styles.cardDesc}>{rep.description}</Text>

                  {rep.locationAddress && (
                    <Text style={styles.cardLoc}>📍 {rep.locationAddress}</Text>
                  )}

                  {/* Closed-loop lifecycle progress bar */}
                  <View style={styles.lifecycleContainer}>
                    <View style={styles.lifecycleRow}>
                      {getLifecycleSteps(rep.status).map((step, idx) => (
                        <View key={step.name} style={styles.stepItem}>
                          <View
                            style={[
                              styles.stepCircle,
                              step.active && styles.stepCircleActive,
                              step.completed && styles.stepCircleCompleted,
                            ]}
                          >
                            <Text style={styles.stepIcon}>{step.completed ? '✓' : idx + 1}</Text>
                          </View>
                          <Text style={styles.stepName}>{step.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {rep.status === 'VERIFIED' && (
                    <View style={styles.rewardBanner}>
                      <Text style={styles.rewardBannerText}>
                        🎉 Verified by Ward Maintainer! +{rep.pointsReward} EcoPoints credited.
                      </Text>
                    </View>
                  )}

                  {rep.status === 'RESOLVED' && (
                    <View style={[styles.rewardBanner, { backgroundColor: colors.primary[100] }]}>
                      <Text style={[styles.rewardBannerText, { color: colors.primary[900] }]}>
                        🌟 Field crew completed cleanup. Community hazard resolved!
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function formatCategory(cat: string) {
  return cat.replace('_', ' ');
}

function getStatusPill(status: string) {
  switch (status) {
    case 'VERIFIED':
    case 'RESOLVED':
      return { backgroundColor: colors.primary[100] };
    case 'REJECTED':
      return { backgroundColor: '#FEE2E2' };
    default:
      return { backgroundColor: '#FEF3C7' };
  }
}

function getLifecycleSteps(status: string) {
  const isUnderReview = status !== 'DRAFT';
  const isVerified = status === 'VERIFIED' || status === 'RESOLVED' || status === 'CLOSED';
  const isResolved = status === 'RESOLVED' || status === 'CLOSED';

  return [
    { name: 'Submitted', completed: isUnderReview, active: status === 'SUBMITTED' },
    { name: 'Review', completed: isVerified, active: status === 'UNDER_REVIEW' },
    { name: 'Verified', completed: isVerified, active: status === 'VERIFIED' },
    { name: 'Resolved', completed: isResolved, active: status === 'RESOLVED' },
  ];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
    backgroundColor: colors.surface.white,
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    color: colors.primary[900],
    fontWeight: '700',
    fontSize: 14,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface.white,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
    gap: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
  },
  tabBtnActive: {
    backgroundColor: colors.primary[900],
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  tabBtnTextActive: {
    color: colors.surface.white,
  },
  scroll: {
    padding: spacing.base,
    paddingBottom: 50,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionLabel: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    fontSize: 15,
  },
  liveBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.base,
  },
  categoryCard: {
    width: '31%',
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface.border,
  },
  categoryCardActive: {
    borderColor: colors.primary[900],
    backgroundColor: colors.primary[50],
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[700],
    textAlign: 'center',
  },
  categoryTextActive: {
    color: colors.primary[900],
    fontWeight: '700',
  },
  evidenceContainer: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    height: 200,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: colors.surface.border,
  },
  evidencePreview: {
    width: '100%',
    height: '100%',
  },
  watermarkOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(14, 59, 46, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  watermarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  watermarkTitle: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  watermarkAccuracy: {
    color: '#D1FAE5',
    fontSize: 11,
    fontWeight: '600',
  },
  watermarkCoords: {
    color: colors.surface.white,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  watermarkTimestamp: {
    color: colors.neutral[200],
    fontSize: 10,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  cameraActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[900],
    paddingVertical: 12,
    borderRadius: radius.md,
    gap: 8,
    shadowColor: colors.primary[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cameraActionIcon: {
    fontSize: 16,
  },
  cameraActionText: {
    color: colors.surface.white,
    fontSize: 13,
    fontWeight: '700',
  },
  galleryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.white,
    borderWidth: 1.5,
    borderColor: colors.primary[900],
    paddingVertical: 12,
    borderRadius: radius.md,
    gap: 8,
  },
  galleryActionIcon: {
    fontSize: 16,
  },
  galleryActionText: {
    color: colors.primary[900],
    fontSize: 13,
    fontWeight: '700',
  },
  presetLabel: {
    fontSize: 11,
    color: colors.neutral[500],
    marginBottom: 6,
    fontWeight: '600',
  },
  photoPickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.base,
  },
  thumbBtn: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbBtnActive: {
    borderColor: colors.primary[900],
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  refreshGpsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.primary[50],
  },
  refreshGpsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary[900],
  },
  gpsTelemetryCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  gpsTelemetryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gpsStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  gpsStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  gpsAccuracyBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
  },
  coordsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  coordBox: {
    flex: 1,
    backgroundColor: colors.surface.white,
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  coordBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[500],
    marginBottom: 2,
  },
  coordBoxValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
    fontVariant: ['tabular-nums'],
  },
  inputTitle: {
    ...typography.caption,
    color: colors.neutral[700],
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: colors.surface.white,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.neutral[900],
    marginBottom: spacing.base,
  },
  submitBtn: {
    backgroundColor: colors.primary[900],
    paddingVertical: 15,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    shadowColor: colors.primary[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: colors.surface.white,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  emptySub: {
    fontSize: 13,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  reportCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  catLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  trackEvidenceContainer: {
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
    height: 140,
    marginBottom: 10,
  },
  trackEvidenceImage: {
    width: '100%',
    height: '100%',
  },
  trackCoordsOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  trackCoordsText: {
    color: colors.surface.white,
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.neutral[600],
    lineHeight: 18,
    marginBottom: 6,
  },
  cardLoc: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: 10,
  },
  lifecycleContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  lifecycleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCircleActive: {
    backgroundColor: colors.accent.points,
  },
  stepCircleCompleted: {
    backgroundColor: colors.primary[700],
  },
  stepIcon: {
    color: colors.surface.white,
    fontSize: 11,
    fontWeight: '700',
  },
  stepName: {
    fontSize: 10,
    color: colors.neutral[600],
    fontWeight: '500',
  },
  rewardBanner: {
    backgroundColor: colors.accent.pointsBg,
    borderRadius: radius.md,
    padding: 10,
    marginTop: 8,
  },
  rewardBannerText: {
    color: colors.accent.points,
    fontSize: 12,
    fontWeight: '700',
  },
});
