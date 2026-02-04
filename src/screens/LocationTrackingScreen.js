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
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Card, Button, ActivityIndicator, SegmentedButtons, IconButton } from 'react-native-paper';
import { supabase } from '../services/supabase';
import geofencingService, { GEOFENCE_RADIUS } from '../services/geofencing';

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

  // Animation states
  const slideUpAnim = useRef(new Animated.Value(100)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const mapRef = useRef(null);

  useEffect(() => {
    initialize();
    return () => {
      geofencingService.stopMonitoring();
    };
  }, []);

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

      // Load fall locations and geofences
      await loadFallLocations();
      await loadGeofences();

      setIsLoading(false);
      triggerAnimations();
    } catch (error) {
      console.error('Error initializing location tracking:', error);
      setIsLoading(false);
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
      setActiveGeofences(geofencingService.getActiveGeofences());
      console.log(`Loaded ${activeGeofences.length} geofences`);
    } catch (error) {
      console.error('Error loading geofences:', error);
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

        {/* Geofence Circles */}
        {showGeofences &&
          activeGeofences.map((geofence, index) => (
            <Circle
              key={`geofence_${index}`}
              center={{
                latitude: geofence.latitude,
                longitude: geofence.longitude,
              }}
              radius={geofence.radius}
              fillColor="rgba(0, 188, 212, 0.2)"
              strokeColor="rgba(0, 188, 212, 0.8)"
              strokeWidth={2}
            />
          ))}
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
              >
                {isTracking ? 'Stop' : 'Start'}
              </Button>
              <Button
                mode="contained"
                onPress={handleCreateGeofence}
                style={[styles.button, styles.safeZoneButton]}
                icon="map-marker-plus"
              >
                Add Zone
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
