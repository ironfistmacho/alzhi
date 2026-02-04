/**
 * Geofencing Service
 * Creates and monitors geofences around fall incident locations
 * Triggers alerts when patient enters or exits defined zones
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

const GEOFENCE_TASK_NAME = 'GEOFENCE_MONITORING';

// Geofence radius options (in meters)
export const GEOFENCE_RADIUS = {
    SMALL: 100,
    MEDIUM: 250,
    LARGE: 500,
    XLARGE: 1000,
};

class GeofencingService {
    constructor() {
        this.activeGeofences = new Map();
        this.monitoringEnabled = false;
        this.defaultRadius = GEOFENCE_RADIUS.MEDIUM;
    }

    /**
     * Initialize geofencing service
     */
    async initialize() {
        try {
            // Request location permissions
            const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
            if (foregroundStatus !== 'granted') {
                console.error('Foreground location permission denied');
                return false;
            }

            const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
            if (backgroundStatus !== 'granted') {
                console.warn('Background location permission denied - geofencing will work only in foreground');
            }

            console.log('Geofencing service initialized');
            return true;
        } catch (error) {
            console.error('Error initializing geofencing:', error);
            return false;
        }
    }

    /**
     * Create geofence around a location
     * @param {object} params - Geofence parameters
     * @returns {string|null} - Geofence ID or null
     */
    async createGeofence({ patientId, latitude, longitude, radius = this.defaultRadius, identifier }) {
        try {
            if (!latitude || !longitude) {
                console.error('Invalid coordinates for geofence');
                return null;
            }

            // Generate unique identifier if not provided
            const geofenceId = identifier || `geofence_${patientId}_${Date.now()}`;

            // Store geofence in database
            const { data: geofence, error } = await supabase
                .from('geofences')
                .insert([
                    {
                        patient_id: patientId,
                        name: `Fall Incident Zone - ${new Date().toLocaleDateString()}`,
                        center_latitude: latitude,
                        center_longitude: longitude,
                        radius_meters: radius,
                        is_active: true,
                        geofence_type: 'fall_incident',
                        notes: 'Auto-created from fall detection alert',
                    },
                ])
                .select()
                .single();

            if (error) {
                console.error('Error creating geofence in database:', error);
                return null;
            }

            // Add to active geofences
            this.activeGeofences.set(geofenceId, {
                id: geofence.id,
                patientId,
                latitude,
                longitude,
                radius,
                createdAt: new Date(),
            });

            console.log(`Geofence created: ${geofenceId} at (${latitude}, ${longitude}) with radius ${radius}m`);

            // Start monitoring if not already running
            await this.startMonitoring();

            return geofenceId;
        } catch (error) {
            console.error('Error creating geofence:', error);
            return null;
        }
    }

    /**
     * Create geofence from fall event
     * @param {object} fallEvent - Fall event data
     * @param {object} location - Location data
     * @returns {string|null} - Geofence ID
     */
    async createGeofenceFromFallEvent(fallEvent, location) {
        if (!location || !location.latitude || !location.longitude) {
            console.warn('No location data available for geofence creation');
            return null;
        }

        return await this.createGeofence({
            patientId: fallEvent.patient_id,
            latitude: location.latitude,
            longitude: location.longitude,
            radius: this.defaultRadius,
            identifier: `fall_${fallEvent.id}`,
        });
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     * @param {number} lat1 - Latitude 1
     * @param {number} lon1 - Longitude 1
     * @param {number} lat2 - Latitude 2
     * @param {number} lon2 - Longitude 2
     * @returns {number} - Distance in meters
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    }

    /**
     * Check if location is inside geofence
     * @param {number} lat - Current latitude
     * @param {number} lon - Current longitude
     * @param {object} geofence - Geofence data
     * @returns {boolean} - True if inside geofence
     */
    isInsideGeofence(lat, lon, geofence) {
        const distance = this.calculateDistance(lat, lon, geofence.latitude, geofence.longitude);
        return distance <= geofence.radius;
    }

    /**
     * Check current location against all active geofences
     * @param {object} location - Current location
     */
    async checkGeofences(location) {
        if (!location || !location.coords) {
            return;
        }

        const { latitude, longitude } = location.coords;

        for (const [geofenceId, geofence] of this.activeGeofences) {
            const wasInside = geofence.isInside || false;
            const isInside = this.isInsideGeofence(latitude, longitude, geofence);

            // Update state
            geofence.isInside = isInside;

            // Detect zone exit
            if (wasInside && !isInside) {
                console.log(`Geofence EXIT detected: ${geofenceId}`);
                await this.handleGeofenceExit(geofenceId, geofence);
            }

            // Detect zone entry
            if (!wasInside && isInside) {
                console.log(`Geofence ENTRY detected: ${geofenceId}`);
                await this.handleGeofenceEntry(geofenceId, geofence);
            }
        }
    }

    /**
     * Handle geofence exit event
     * @param {string} geofenceId - Geofence identifier
     * @param {object} geofence - Geofence data
     */
    async handleGeofenceExit(geofenceId, geofence) {
        try {
            // Get patient info
            const { data: patient } = await supabase
                .from('patients')
                .select('first_name, last_name')
                .eq('id', geofence.patientId)
                .single();

            const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Patient';

            // Create alert
            await supabase.from('patient_alerts').insert([
                {
                    patient_id: geofence.patientId,
                    alert_type: 'geofence_violation',
                    title: '⚠️ Geofence Exit',
                    message: `${patientName} has left the safe zone (${geofence.radius}m radius)`,
                    priority: 'high',
                    is_read: false,
                    metadata: {
                        geofence_id: geofenceId,
                        event_type: 'exit',
                    },
                },
            ]);

            // Send push notification
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '⚠️ Safe Zone Alert',
                    body: `${patientName} has left the safe zone`,
                    data: { type: 'geofence_exit', patientId: geofence.patientId },
                    sound: true,
                },
                trigger: null,
            });

            console.log('Geofence exit notification sent');
        } catch (error) {
            console.error('Error handling geofence exit:', error);
        }
    }

    /**
     * Handle geofence entry event
     * @param {string} geofenceId - Geofence identifier
     * @param {object} geofence - Geofence data
     */
    async handleGeofenceEntry(geofenceId, geofence) {
        try {
            // Get patient info
            const { data: patient } = await supabase
                .from('patients')
                .select('first_name, last_name')
                .eq('id', geofence.patientId)
                .single();

            const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Patient';

            // Create alert (lower priority)
            await supabase.from('patient_alerts').insert([
                {
                    patient_id: geofence.patientId,
                    alert_type: 'geofence_entry',
                    title: '✅ Geofence Entry',
                    message: `${patientName} has entered the safe zone`,
                    priority: 'low',
                    is_read: false,
                    metadata: {
                        geofence_id: geofenceId,
                        event_type: 'entry',
                    },
                },
            ]);

            console.log('Geofence entry logged');
        } catch (error) {
            console.error('Error handling geofence entry:', error);
        }
    }

    /**
     * Start geofence monitoring
     */
    async startMonitoring() {
        try {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
            if (isRegistered && this.monitoringEnabled) {
                console.log('Geofence monitoring already running');
                return;
            }

            // Start location updates
            await Location.startLocationUpdatesAsync(GEOFENCE_TASK_NAME, {
                accuracy: Location.Accuracy.High,
                distanceInterval: 10, // Update every 10 meters
                timeInterval: 30000, // Or every 30 seconds
                foregroundService: {
                    notificationTitle: 'Patient Monitoring Active',
                    notificationBody: 'Tracking patient location for safety',
                },
            });

            this.monitoringEnabled = true;
            console.log('Geofence monitoring started');
        } catch (error) {
            console.error('Error starting geofence monitoring:', error);
        }
    }

    /**
     * Stop geofence monitoring
     */
    async stopMonitoring() {
        try {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
            if (!isRegistered) {
                this.monitoringEnabled = false;
                return;
            }

            await Location.stopLocationUpdatesAsync(GEOFENCE_TASK_NAME);
            this.monitoringEnabled = false;
            console.log('Geofence monitoring stopped');
        } catch (error) {
            console.error('Error stopping geofence monitoring:', error);
        }
    }

    /**
     * Load active geofences from database
     * @param {string} patientId - Patient ID (optional, loads all if not provided)
     */
    async loadGeofencesFromDatabase(patientId = null) {
        try {
            let query = supabase
                .from('geofences')
                .select('*')
                .eq('is_active', true);

            if (patientId) {
                query = query.eq('patient_id', patientId);
            }

            const { data: geofences, error } = await query;

            if (error) throw error;

            // Load into active geofences
            geofences.forEach((gf) => {
                const geofenceId = `db_${gf.id}`;
                this.activeGeofences.set(geofenceId, {
                    id: gf.id,
                    patientId: gf.patient_id,
                    latitude: gf.center_latitude,
                    longitude: gf.center_longitude,
                    radius: gf.radius_meters,
                    createdAt: new Date(gf.created_at),
                });
            });

            console.log(`Loaded ${geofences.length} active geofences from database`);
            return geofences.length;
        } catch (error) {
            console.error('Error loading geofences:', error);
            return 0;
        }
    }

    /**
     * Remove geofence
     * @param {string} geofenceId - Geofence identifier
     */
    async removeGeofence(geofenceId) {
        try {
            const geofence = this.activeGeofences.get(geofenceId);
            if (!geofence) {
                console.warn('Geofence not found:', geofenceId);
                return false;
            }

            // Deactivate in database
            await supabase
                .from('geofences')
                .update({ is_active: false })
                .eq('id', geofence.id);

            // Remove from active geofences
            this.activeGeofences.delete(geofenceId);

            console.log('Geofence removed:', geofenceId);
            return true;
        } catch (error) {
            console.error('Error removing geofence:', error);
            return false;
        }
    }

    /**
     * Get all active geofences
     * @returns {Array} - Array of active geofences
     */
    getActiveGeofences() {
        return Array.from(this.activeGeofences.values());
    }

    /**
     * Set default geofence radius
     * @param {number} radius - Radius in meters
     */
    setDefaultRadius(radius) {
        this.defaultRadius = radius;
        console.log('Default geofence radius set to:', radius);
    }
}

// Define background task for geofence monitoring
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('Geofence task error:', error);
        return;
    }

    if (data) {
        const { locations } = data;
        if (locations && locations.length > 0) {
            const location = locations[0];
            // Check geofences (this will be handled by the service instance)
            console.log('Background location update:', location.coords);
        }
    }
});

export default new GeofencingService();
export { GEOFENCE_TASK_NAME };
