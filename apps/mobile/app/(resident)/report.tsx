import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { theme } from '../../constants/theme';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

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

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'WASTE_HOTSPOT' | 'ILLEGAL_DUMPING' | 'OVERFLOWING_BIN' | 'MIXED_WASTE' | 'OTHER'>('WASTE_HOTSPOT');

  // Evidence state
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [evidenceBase64, setEvidenceBase64] = useState<string | null>(null);
  const [evidenceFileSize, setEvidenceFileSize] = useState<number | null>(null);

  // GPS Location state
  const [locationCoords, setLocationCoords] = useState<GeoLocationState | null>(null);
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Submission Progress
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitProgressStep, setSubmitProgressStep] = useState<string>('');

  // Fetch Community
  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: () => api.communities.list(),
  });
  const communityId = communities?.[0]?.id || '0090c98a-b152-427a-8d94-951d2bf59894';

  // Automatically acquire GPS location on screen mount
  useEffect(() => {
    fetchCurrentLocation(true);
  }, []);

  const fetchCurrentLocation = async (silent = false) => {
    setIsLocating(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Foreground location permission denied.');
        if (!silent) {
          Alert.alert(
            'Location Permission Required',
            'EcoPulse needs device GPS access to verify the exact location of the environmental hazard.'
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

      // Reverse geocoding
      let resolvedAddress = false;
      if (Platform.OS !== 'web') {
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });

          if (addresses && addresses.length > 0) {
            const addr = addresses[0];
            const parts = [
              addr.street || addr.name,
              addr.subregion || addr.district,
              addr.city,
            ].filter(Boolean);

            if (parts.length > 0) {
              setLocationAddress(parts.join(', '));
              resolvedAddress = true;
            }
          }
        } catch {
          // Native reverse geocoder not available or errored
        }
      }

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
          // Fallback to formatted coords
        }
      }

      if (!resolvedAddress) {
        setLocationAddress(`${newCoords.latitude.toFixed(4)}, ${newCoords.longitude.toFixed(4)}`);
      }
    } catch (err: any) {
      setLocationError(err?.message || 'Failed to acquire GPS position');
    } finally {
      setIsLocating(false);
    }
  };

  // Open Camera
  const handleCapturePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'EcoPulse needs camera access so you can take live photos of waste piles and environmental hazards.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.55,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setEvidenceUri(asset.uri);
        setEvidenceBase64(asset.base64 || null);
        setEvidenceFileSize(asset.fileSize || null);
        if (!title) {
          setTitle('Waste report');
        }
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Unable to open camera');
    }
  };

  // Choose from Gallery
  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Gallery Permission Required',
          'EcoPulse needs gallery access to select existing evidence photos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.55,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setEvidenceUri(asset.uri);
        setEvidenceBase64(asset.base64 || null);
        setEvidenceFileSize(asset.fileSize || null);
        if (!title) {
          setTitle('Waste report');
        }
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Unable to pick photo from gallery');
    }
  };

  const handleRemovePhoto = () => {
    setEvidenceUri(null);
    setEvidenceBase64(null);
    setEvidenceFileSize(null);
  };

  // Submit Report to Real Backend
  const handleSubmitReport = async () => {
    if (!evidenceUri && !evidenceBase64) {
      Alert.alert('Evidence Required', 'Please take or choose a photo of the waste before submitting.');
      return;
    }

    if (!locationCoords) {
      Alert.alert(
        'GPS Location Required',
        'Device coordinates are required to dispatch waste cleanup. Please tap "Retry Location".'
      );
      return;
    }

    const reportTitle = title.trim() || 'Waste report';
    const reportDesc = description.trim() || 'Citizen reported waste accumulation for municipal cleanup.';

    setIsSubmitting(true);
    try {
      // Step 1: Upload image to Private S3
      setSubmitProgressStep('Uploading photo evidence to secure S3...');
      let finalMediaUrl = evidenceUri;

      if (evidenceBase64) {
        const uploadRes = await api.reports.uploadImage(
          evidenceBase64,
          `evidence-${Date.now()}.jpg`,
          'image/jpeg'
        );
        if (uploadRes?.publicUrl) {
          finalMediaUrl = uploadRes.publicUrl;
        }
      }

      const geoPoint = {
        type: 'Point',
        coordinates: [locationCoords.longitude, locationCoords.latitude],
      };

      // Step 2: Create report in backend
      setSubmitProgressStep('Creating report and registering geo-point...');
      const createdReport = await api.reports.create({
        communityId,
        category,
        title: reportTitle,
        description: reportDesc,
        locationAddress: locationAddress || 'Civic location',
        locationGeoJson: geoPoint,
        clientEventId: `client-rep-${Date.now()}`,
      });

      // Step 3: Attach evidence to trigger backend AI processing pipeline
      setSubmitProgressStep('Attaching evidence & queueing Gemini Vision AI...');
      if (finalMediaUrl) {
        await api.reports.attachEvidence(createdReport.id, {
          mediaUrl: finalMediaUrl,
          mediaType: 'IMAGE',
          locationGeoJson: geoPoint,
          metadata: {
            captureTimestamp: new Date().toISOString(),
            accuracyMeters: locationCoords.accuracy,
            altitudeMeters: locationCoords.altitude,
            isDeviceCapture: true,
            source: 'LIVE_DEVICE_CAMERA',
          },
        });
      }

      setSubmitProgressStep('Success! Opening report details...');

      // Invalidate queries so dashboard and reports list reflect the new report
      queryClient.invalidateQueries({ queryKey: ['home-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });

      // Reset form
      handleRemovePhoto();
      setTitle('');
      setDescription('');

      // Navigate directly to the real report detail screen
      router.push(`/(resident)/report/${createdReport.id}` as any);
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Could not submit report. Please check connection and retry.');
    } finally {
      setIsSubmitting(false);
      setSubmitProgressStep('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.forest} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Waste</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section 1: Capture Evidence */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.stepNumCircle}>
                <Text style={styles.stepNumText}>1</Text>
              </View>
              <Text style={styles.sectionTitle}>Capture Evidence</Text>
            </View>

            {evidenceUri ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: evidenceUri }} style={styles.previewImg} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removePhotoBtn}
                  onPress={handleRemovePhoto}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle" size={28} color="#EF4444" />
                </TouchableOpacity>

                <View style={styles.retakeRow}>
                  <TouchableOpacity
                    style={styles.retakeBtn}
                    onPress={handleCapturePhoto}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera-outline" size={16} color={theme.colors.forest} style={{ marginRight: 6 }} />
                    <Text style={styles.retakeBtnText}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.retakeBtn}
                    onPress={handlePickFromGallery}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="images-outline" size={16} color={theme.colors.forest} style={{ marginRight: 6 }} />
                    <Text style={styles.retakeBtnText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.captureBox}>
                <View style={styles.cameraIconCircle}>
                  <Ionicons name="camera" size={36} color={theme.colors.primary} />
                </View>
                <Text style={styles.captureHeading}>Take a photo of the waste</Text>
                <Text style={styles.captureSub}>
                  Clear photos help Vision AI identify waste categories and dispatch cleanup teams faster.
                </Text>

                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={styles.cameraActionBtn}
                    onPress={handleCapturePhoto}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="camera" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.cameraActionBtnText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.galleryActionBtn}
                    onPress={handlePickFromGallery}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="images" size={20} color={theme.colors.forest} style={{ marginRight: 8 }} />
                    <Text style={styles.galleryActionBtnText}>Choose Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Section 2: Verified Location */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.stepNumCircle}>
                <Text style={styles.stepNumText}>2</Text>
              </View>
              <Text style={styles.sectionTitle}>Location Coordinates</Text>
            </View>

            <View style={styles.locationContainer}>
              <View style={styles.locationInfoRow}>
                <Ionicons name="location" size={22} color={theme.colors.primary} />
                <View style={styles.locationTextWrap}>
                  <Text style={styles.addressText} numberOfLines={2}>
                    {locationAddress || (isLocating ? 'Acquiring GPS position...' : 'Location not acquired')}
                  </Text>
                  {locationCoords && (
                    <Text style={styles.coordsText}>
                      {locationCoords.latitude.toFixed(5)}, {locationCoords.longitude.toFixed(5)}
                      {locationCoords.accuracy ? ` (±${Math.round(locationCoords.accuracy)}m)` : ''}
                    </Text>
                  )}
                  {locationError && (
                    <Text style={styles.locationErrorText}>{locationError}</Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={styles.retryLocationBtn}
                onPress={() => fetchCurrentLocation(false)}
                disabled={isLocating}
                activeOpacity={0.7}
              >
                {isLocating ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={16} color={theme.colors.forest} style={{ marginRight: 4 }} />
                    <Text style={styles.retryLocationText}>Update GPS</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Section 3: Details & Confirmation */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.stepNumCircle}>
                <Text style={styles.stepNumText}>3</Text>
              </View>
              <Text style={styles.sectionTitle}>Report Details</Text>
            </View>

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Waste report"
              placeholderTextColor={theme.colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.inputLabel}>Notes / Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe what kind of waste it is, accessibility, or hazards..."
              placeholderTextColor={theme.colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Submission Indicator / Status */}
          {isSubmitting && (
            <View style={styles.progressCard}>
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 10 }} />
              <Text style={styles.progressText}>{submitProgressStep}</Text>
            </View>
          )}

          {/* Submit Action Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!evidenceUri || isSubmitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmitReport}
            disabled={!evidenceUri || isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>Submit Report</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background, // #F4F8F5
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  stepNumCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stepNumText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.forest,
  },

  // Capture Box
  captureBox: {
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  cameraIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  captureHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.forest,
    marginBottom: 4,
  },
  captureSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cameraActionBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  galleryActionBtn: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#C6E7D2',
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryActionBtnText: {
    color: theme.colors.forest,
    fontWeight: '700',
    fontSize: 14,
  },

  // Preview Box
  previewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImg: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  retakeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  retakeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.forest,
  },

  // Location
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
  },
  locationInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  locationTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.forest,
  },
  coordsText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  locationErrorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 2,
  },
  retryLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  retryLocationText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.forest,
  },

  // Inputs
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.forest,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },

  // Progress
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C6E7D2',
    marginBottom: 16,
  },
  progressText: {
    fontSize: 13,
    color: theme.colors.forest,
    fontWeight: '600',
  },

  // Submit
  submitButton: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
