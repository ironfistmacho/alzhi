import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker, Circle, Polyline, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, ActivityIndicator, SegmentedButtons, IconButton, Badge } from 'react-native-paper';
import { supabase } from '../services/supabase';
import geofencingService, { GEOFENCE_RADIUS } from '../services/geofencing';
import { DeviceEventEmitter } from 'react-native';

const LocationTrackingScreen = () => {
  const [location, setLocation] = useState(null);
  const [fallLocations, setFallLocations] = useState([]);
  const [activeGeofences, setActiveGeofences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedRadius, setSelectedRadius] = useState(GEOFENCE_RADIUS.MEDIUM);
  const [showFalls, setShowFalls] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);
  const [patientLocation, setPatientLocation] = useState(null);
  const [patientData, setPatientData] = useState(null);

  // Animation states
  const slideUpAnim = useRef(new Animated.Value(100)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const mapRef = useRef(null);

  useEffect(() => {
    initialize();

    // Listen for real-time location updates from SMS
    const locSubscription = DeviceEventEmitter.addListener('LOCATION_UPDATED', (data) => {
      console.log('Received real-time location update in UI:', data);
      const newLoc = {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        timestamp: new Date(data.timestamp)
      };
      setPatientLocation(newLoc);
      setLastUpdated(new Date().toLocaleTimeString());

      // Optionally auto-center if tracking is enabled
      if (isTracking && mapRef.current) {
        mapRef.current.animateToRegion({
          ...newLoc,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
    });

    return () => {
      geofencingService.stopMonitoring();
      locSubscription.remove();
    };
  }, [isTracking]);

  const initialize = async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for this feature');
        setIsLoading(false);
        return;
      }

      // Get current location
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation.coords);
      setLastUpdated(new Date().toLocaleTimeString());

      // Initialize geofencing
      await geofencingService.initialize();
      await geofencingService.setDefaultRadius(selectedRadius);

      // Load initial patient and location
      await loadInitialData();
      await loadFallLocations();
      await loadGeofences();

      setIsLoading(false);
      triggerAnimations();
    } catch (error) {
      console.error('Error initializing location tracking:', error);
      setIsLoading(false);
    }
  };

  const loadInitialData = async () => {
    try {
      // Get first patient
      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .limit(1)
        .single();

      if (patient) {
        setPatientData(patient);

        // Get last known location from DB
        const { data: lastLoc } = await supabase
          .from('patient_locations')
          .select('*')
          .eq('patient_id', patient.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (lastLoc) {
          setPatientLocation({
            latitude: lastLoc.latitude,
            longitude: lastLoc.longitude,
            timestamp: new Date(lastLoc.timestamp)
          });
        }
      }
    } catch (e) {
      console.log('Error loading initial patient data:', e);
    }
  };

  const triggerAnimations = () => {
    Animated.timing(slideUpAnim, {
      toValue: 0,
      duration: 600,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start();

    Animated.timing(fadeInAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.quad,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.quad,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const loadFallLocations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get fall events with locations
      const { data: fallEvents, error } = await supabase
        .from('fall_events')
        .select(`
          id,
          patient_id,
          created_at,
          notes,
          patient_locations (
            id,
            latitude,
            longitude,
            location_type,
            notes
          )
        `)
        .not('location_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Extract fall locations
      const falls = fallEvents
        .filter((event) => event.patient_locations)
        .map((event) => ({
          id: event.id,
          patientId: event.patient_id,
          latitude: event.patient_locations.latitude,
          longitude: event.patient_locations.longitude,
          timestamp: new Date(event.created_at),
          notes: event.notes,
        }));

      setFallLocations(falls);
      console.log(`Loaded ${falls.length} fall locations`);
    } catch (error) {
      console.error('Error loading fall locations:', error);
    }
  };

  const loadGeofences = async () => {
    try {
      await geofencingService.loadGeofencesFromDatabase();
      const currentGfs = geofencingService.getActiveGeofences();
      setActiveGeofences(currentGfs);
      console.log(`Loaded ${currentGfs.length} geofences`);
    } catch (error) {
      console.error('Error loading geofences:', error);
    }
  };

  const handleDeleteGeofence = async (geofenceId) => {
    Alert.alert(
      'Delete Zone',
      'Are you sure you want to remove this safe zone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await geofencingService.removeGeofence(geofenceId);
              if (success) {
                await loadGeofences();
                Alert.alert('Success', 'Zone removed successfully');
              } else {
                Alert.alert('Error', 'Failed to remove zone');
              }
            } catch (error) {
              console.error('Error deleting geofence:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            }
          }
        }
      ]
    );
  };

  const handleResetMap = async () => {
    setIsLoading(true);
    try {
      // Refresh current location
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation.coords);

      // Refresh patient data
      await loadInitialData();
      await loadFallLocations();
      await loadGeofences();

      setLastUpdated(new Date().toLocaleTimeString());

      // Center map on patient if available, otherwise current user
      const target = patientLocation || currentLocation.coords;
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: target.latitude,
          longitude: target.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 1000);
      }

      setIsLoading(false);
      Alert.alert('Reset Complete', 'Map and data have been refreshed');
    } catch (error) {
      console.error('Error resetting map:', error);
      setIsLoading(false);
      Alert.alert('Error', 'Failed to reset map');
    }
  };

  const handleCreateGeofence = async () => {
    if (!location) {
      Alert.alert('Error', 'Current location not available');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get first patient (for demo)
      const { data: patient } = await supabase
        .from('patients')
        .select('id, first_name, last_name')
        .limit(1)
        .single();

      if (!patient) {
        Alert.alert('Error', 'No patient found');
        return;
      }

      const geofenceId = await geofencingService.createGeofence({
        patientId: patient.id,
        latitude: location.latitude,
        longitude: location.longitude,
        radius: selectedRadius,
      });

      if (geofenceId) {
        Alert.alert(
          'Geofence Created',
          `Safe zone of ${selectedRadius}m created at current location for ${patient.first_name} ${patient.last_name}`
        );
        await loadGeofences();
      } else {
        Alert.alert('Error', 'Failed to create geofence');
      }
    } catch (error) {
      console.error('Error creating geofence:', error);
      Alert.alert('Error', 'Failed to create geofence');
    }
  };

  const handleStartTracking = async () => {
    if (isTracking) {
      geofencingService.stopMonitoring();
      setIsTracking(false);
    } else {
      await geofencingService.startMonitoring();
      setIsTracking(true);

      // Start location updates
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 30000,
        },
        (loc) => {
          setLocation(loc.coords);
          setLastUpdated(new Date().toLocaleTimeString());
          geofencingService.checkGeofences(loc);
        }
      );

      return () => subscription.remove();
    }
  };

  const zoomToFallLocation = (fall) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: fall.latitude,
        longitude: fall.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00acc1" />
        <Text style={styles.loadingText}>Loading location data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={
          location
            ? {
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }
            : null
        }
        showsUserLocation={true}
        followsUserLocation={isTracking}
        showsMyLocationButton={true}
      >
        {/* Fall Incident Markers */}
        {showFalls &&
          fallLocations.map((fall) => (
            <Marker
              key={`fall_${fall.id}`}
              coordinate={{
                latitude: fall.latitude,
                longitude: fall.longitude,
              }}
              title="Fall Detected"
              description={`${fall.timestamp.toLocaleString()}`}
              pinColor="#e74c3c"
              onPress={() => zoomToFallLocation(fall)}
            >
              <View style={styles.fallMarker}>
                <Text style={styles.fallMarkerText}>⚠️</Text>
              </View>
            </Marker>
          ))}

        {/* Geofence Circles & Delete Markers */}
        {showGeofences &&
          activeGeofences.map((geofence, index) => (
            <React.Fragment key={`gf_group_${index}`}>
              <Circle
                center={{
                  latitude: geofence.latitude,
                  longitude: geofence.longitude,
                }}
                radius={geofence.radius}
                fillColor="rgba(0, 188, 212, 0.2)"
                strokeColor="rgba(0, 188, 212, 0.8)"
                strokeWidth={2}
              />
              <Marker
                coordinate={{
                  latitude: geofence.latitude,
                  longitude: geofence.longitude,
                }}
                onPress={() => console.log('Geofence pressed')}
              >
                <View style={styles.geofenceMarker}>
                  <Ionicons name="shield-checkmark" size={16} color="white" />
                </View>
                <Callout onPress={() => handleDeleteGeofence(geofence.id || `db_${geofence.id}`)}>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>Safe Zone</Text>
                    <Text style={styles.calloutAction}>Tap to Delete</Text>
                  </View>
                </Callout>
              </Marker>
            </React.Fragment>
          ))}

        {/* Live Patient Marker */}
        {patientLocation && (
          <Marker
            coordinate={{
              latitude: patientLocation.latitude,
              longitude: patientLocation.longitude,
            }}
            title={`${patientData?.first_name || 'Patient'}'s Live Location`}
            description={`Updated: ${patientLocation.timestamp?.toLocaleTimeString()}`}
            zIndex={10}
          >
            <View style={styles.patientMarkerContainer}>
              <View style={styles.patientMarkerPulse} />
              <View style={styles.patientMarker}>
                <Ionicons name="person" size={18} color="white" />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Controls Panel */}
      <Animated.View
        style={[
          styles.controlsContainer,
          {
            transform: [{ translateY: slideUpAnim }],
            opacity: fadeInAnim,
          },
        ]}
      >
        <Card style={styles.card}>
          <Card.Content>
            {/* Toggle Switches */}
            <View style={styles.toggleRow}>
              <Button
                mode={showFalls ? 'contained' : 'outlined'}
                onPress={() => setShowFalls(!showFalls)}
                compact
                icon="alert-circle"
                style={styles.toggleButton}
              >
                Falls ({fallLocations.length})
              </Button>
              <Button
                mode={showGeofences ? 'contained' : 'outlined'}
                onPress={() => setShowGeofences(!showGeofences)}
                compact
                icon="map-marker-radius"
                style={styles.toggleButton}
              >
                Zones ({activeGeofences.length})
              </Button>
            </View>

            {/* Status Info */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <Animated.Text
                style={[
                  styles.infoValue,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                {isTracking ? '🔴 Tracking Active' : '⚪ Tracking Paused'}
              </Animated.Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Updated:</Text>
              <Text style={styles.infoValue}>{lastUpdated || 'N/A'}</Text>
            </View>

            {/* Geofence Radius Selector */}
            <View style={styles.radiusSection}>
              <Text style={styles.sectionLabel}>Geofence Radius:</Text>
              <SegmentedButtons
                value={selectedRadius.toString()}
                onValueChange={(value) => {
                  setSelectedRadius(parseInt(value));
                  geofencingService.setDefaultRadius(parseInt(value));
                }}
                buttons={[
                  { value: '100', label: '100m' },
                  { value: '250', label: '250m' },
                  { value: '500', label: '500m' },
                  { value: '1000', label: '1km' },
                ]}
                style={styles.segmentedButtons}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <Button
                mode={isTracking ? 'contained' : 'outlined'}
                onPress={handleStartTracking}
                style={[styles.button, isTracking ? styles.stopButton : styles.startButton]}
                labelStyle={{ color: isTracking ? 'white' : '#00acc1' }}
                icon={isTracking ? 'stop' : 'play'}
                compact
              >
                {isTracking ? 'Stop' : 'Start'}
              </Button>
              <Button
                mode="contained"
                onPress={handleCreateGeofence}
                style={[styles.button, styles.safeZoneButton]}
                icon="map-marker-plus"
                compact
              >
                Zone
              </Button>
              <Button
                mode="outlined"
                onPress={handleResetMap}
                style={[styles.button, styles.resetButton]}
                icon="refresh"
                textColor="#00838f"
                compact
              >
                Reset
              </Button>
            </View>
          </Card.Content>
        </Card>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9fb',
  },
  map: {
    width: '100%',
    height: Dimensions.get('window').height - 350,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 12,
    elevation: 8,
  },
  card: {
    borderRadius: 12,
    elevation: 3,
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#00bcd4',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#00838f',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#00acc1',
  },
  radiusSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#00838f',
    marginBottom: 6,
    fontWeight: '600',
  },
  segmentedButtons: {
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  startButton: {
    borderColor: '#00acc1',
  },
  stopButton: {
    backgroundColor: '#00acc1',
  },
  safeZoneButton: {
    backgroundColor: '#00bcd4',
  },
  resetButton: {
    borderColor: '#00838f',
  },
  geofenceMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00acc1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    elevation: 4,
  },
  calloutContainer: {
    width: 120,
    padding: 8,
    alignItems: 'center',
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00838f',
    marginBottom: 4,
  },
  calloutAction: {
    fontSize: 12,
    color: '#e74c3c',
    fontWeight: '600',
  },
  fallMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  fallMarkerText: {
    fontSize: 18,
  },
  patientMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  patientMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#00acc1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    elevation: 4,
  },
  patientMarkerPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 172, 193, 0.3)',
    transform: [{ scale: 1 }],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9fb',
  },
  loadingText: {
    marginTop: 16,
    color: '#00acc1',
  },
});

export default LocationTrackingScreen;
