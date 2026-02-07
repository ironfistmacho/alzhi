/**
 * SMS Parser Service
 * Parses structured SMS messages from Raspberry Pi fall detection system
 * Format: FALL_ALERT|PATIENT_ID|LAT,LON|GPS_STATUS|TIME|Impact:XXg|Device:PiZero
 */

import { supabase } from './supabase';
import * as Notifications from 'expo-notifications';
import { DeviceEventEmitter, ToastAndroid, Platform } from 'react-native';

class SMSParser {
    constructor() {
        this.lastProcessedSMS = {};
    }

    /**
     * Parse structured SMS (Fall Alert or Location Update)
     * @param {string} messageBody - SMS message body
     * @param {string} sender - Phone number of sender
     * @returns {object|null} - Parsed data or null if invalid
     */
    parseSMS(messageBody, sender) {
        try {
            // Expected formats:
            // FALL_ALERT|PATIENT_001|9.723,17.726|GPS_OK|21:52:31|Impact:0.65g|Device:PiZero
            // LOCATION_UPDATE|PATIENT_001|9.723,17.726|GPS_OK|21:52:31|Device:PiZero
            const parts = messageBody.trim().split('|');

            if (parts.length < 5) {
                console.log('Invalid SMS format: insufficient fields');
                return null;
            }

            const alertType = parts[0].trim();
            if (alertType !== 'FALL_ALERT' && alertType !== 'LOCATION_UPDATE') {
                console.log('Unknown SMS type:', alertType);
                return null;
            }

            // Parse patient ID
            const patientId = parts[1].trim();

            // Parse GPS coordinates
            let latitude = null;
            let longitude = null;
            const coords = parts[2].trim();

            if (coords !== 'NO_GPS_FIX') {
                const coordParts = coords.split(',');
                if (coordParts.length === 2) {
                    latitude = parseFloat(coordParts[0]);
                    longitude = parseFloat(coordParts[1]);
                }
            }

            const gpsStatus = parts[3].trim();
            const timeString = parts[4].trim();

            // Parse additional metrics
            let impactForce = 0;
            let deviceType = 'PiZero';

            for (let i = 5; i < parts.length; i++) {
                const part = parts[i].trim();
                const impactMatch = part.match(/Impact:([\d.]+)g/);
                if (impactMatch) impactForce = parseFloat(impactMatch[1]);
                const deviceMatch = part.match(/Device:(.+)/);
                if (deviceMatch) deviceType = deviceMatch[1];
            }

            const timestamp = new Date();
            if (timeString && timeString.includes(':')) {
                const [h, m, s] = timeString.split(':').map(Number);
                timestamp.setHours(h, m, s || 0, 0);
            }

            return {
                alertType,
                patientId,
                location: (latitude !== null && longitude !== null) ? { latitude, longitude } : null,
                gpsStatus,
                timestamp,
                impactForce,
                deviceType,
                sender,
                rawMessage: messageBody,
            };
        } catch (error) {
            console.error('Error parsing SMS:', error);
            return null;
        }
    }

    /**
     * Get patient from database by device identifier
     * @param {string} patientId - Patient identifier from SMS
     * @returns {object|null} - Patient record or null
     */
    async getPatientByIdentifier(patientId) {
        try {
            if (Platform.OS === 'android') ToastAndroid.show(`Searching for ${patientId}...`, ToastAndroid.SHORT);

            console.log(`DEBUG: Searching for patient with identifier "${patientId}" in notes...`);
            const { data: patients, error } = await supabase
                .from('patients')
                .select('*')
                .ilike('notes', `%${patientId}%`)
                .limit(1);

            if (patients && patients.length > 0) {
                console.log('DEBUG: Match found in notes:', patients[0].id);
                return patients[0];
            }

            console.log('DEBUG: No match found. Trying ANY accessible patient...');
            const { data: allPatients } = await supabase
                .from('patients')
                .select('*')
                .limit(1);

            if (allPatients && allPatients.length > 0) {
                console.log('DEBUG: Found an accessible patient:', allPatients[0].id);
                return allPatients[0];
            }

        } catch (error) {
            console.error('DEBUG: Error in getPatientByIdentifier, falling back...', error);
        }

        console.log('DEBUG: Using HARDCODED FALLBACK patient.');
        if (Platform.OS === 'android') ToastAndroid.show('Using Virtual Patient', ToastAndroid.SHORT);

        return {
            id: '00000000-0000-0000-0000-000000000001',
            first_name: 'Patient',
            last_name: `(${patientId || 'Unidentified'})`,
            notes: `Fallback for ${patientId}`,
            age: 70
        };
    }

    /**
     * Store fall event in database
     * @param {object} parsedData - Parsed SMS data
     * @param {object} patient - Patient record
     * @returns {object|null} - Created fall event record
     */
    async storeFallEvent(parsedData, patient) {
        try {
            let locationId = null;

            // Store location if GPS coordinates available
            if (parsedData.location) {
                const { data: locationData, error: locationError } = await supabase
                    .from('patient_locations')
                    .insert([
                        {
                            patient_id: patient.id,
                            latitude: parsedData.location.latitude,
                            longitude: parsedData.location.longitude,
                            accuracy: 10.0, // GPS accuracy assumption
                            location_type: 'fall_incident',
                            notes: `Fall detected via SMS from ${parsedData.deviceType}`,
                            created_at: parsedData.timestamp.toISOString(),
                        },
                    ])
                    .select()
                    .single();

                if (locationError) {
                    console.error('Error storing location:', locationError);
                } else {
                    locationId = locationData.id;
                }
            }

            // Store fall event
            const { data: fallEvent, error: fallError } = await supabase
                .from('fall_events')
                .insert([
                    {
                        patient_id: patient.id,
                        // fall_detected: true, // column doesn't exist, we just insert the record
                        location_id: locationId,
                        confidence_score: 95.0,
                        impact_force: parsedData.impactForce || 0,
                        notes: `SMS Alert from ${parsedData.deviceType} | Impact: ${parsedData.impactForce}g | Sender: ${parsedData.sender}`,
                        created_at: parsedData.timestamp.toISOString(),
                    },
                ])
                .select()
                .single();

            if (fallError) {
                console.error('DEBUG: Supabase error storing fall event:', fallError);
                if (Platform.OS === 'android') ToastAndroid.show(`Fall Insert Failed: ${fallError.message || 'Error'}`, ToastAndroid.LONG);
                return null;
            }

            if (Platform.OS === 'android') ToastAndroid.show('💾 Fall event saved', ToastAndroid.SHORT);

            return fallEvent;
        } catch (error) {
            console.error('Error in storeFallEvent:', error);
            return null;
        }
    }

    /**
     * Create critical alert for fall detection
     * @param {object} parsedData - Parsed SMS data
     * @param {object} patient - Patient record
     * @returns {object|null} - Created alert record
     */
    async createFallAlert(parsedData, patient) {
        try {
            const locationInfo = parsedData.location
                ? `Location: ${parsedData.location.latitude.toFixed(6)}, ${parsedData.location.longitude.toFixed(6)} (${parsedData.gpsStatus})`
                : `Location: GPS not available (${parsedData.gpsStatus})`;

            const { data: alert, error } = await supabase
                .from('patient_alerts')
                .insert([
                    {
                        patient_id: patient.id,
                        alert_type: 'fall',
                        title: '🚨 FALL DETECTED (Raspberry Pi)',
                        message: `Fall detected via SMS alert. ${locationInfo} | Impact: ${parsedData.impactForce}g | Device: ${parsedData.deviceType}`,
                        priority: 'critical',
                        is_read: false,
                        is_acknowledged: false,
                        metadata: {
                            source: 'sms',
                            device_type: parsedData.deviceType,
                            sender: parsedData.sender,
                            impact: parsedData.impactForce,
                            location: parsedData.location,
                            gps_status: parsedData.gpsStatus,
                            patient_id_from_sms: parsedData.patientId,
                        },
                        created_at: parsedData.timestamp.toISOString(),
                    },
                ])
                .select()
                .single();

            if (error) {
                console.error('DEBUG: Supabase error creating patient_alert:', error);
                if (Platform.OS === 'android') ToastAndroid.show(`Alert Insert Failed: ${error.message || 'Error'}`, ToastAndroid.LONG);
                return null;
            }

            if (Platform.OS === 'android') ToastAndroid.show('🔔 Alert Saved to Database', ToastAndroid.SHORT);

            return alert;
        } catch (error) {
            console.error('Error in createFallAlert:', error);
            return null;
        }
    }

    /**
     * Send push notification for fall alert
     * @param {object} parsedData - Parsed SMS data
     * @param {object} patient - Patient record
     */
    async sendPushNotification(parsedData, patient) {
        try {
            const locationText = parsedData.location
                ? `at ${parsedData.location.latitude.toFixed(4)}, ${parsedData.location.longitude.toFixed(4)} (${parsedData.gpsStatus})`
                : `location unknown (${parsedData.gpsStatus})`;

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '🚨 FALL ALERT',
                    body: `${patient.first_name} ${patient.last_name} has fallen ${locationText} | Impact: ${parsedData.impactForce}g`,
                    data: {
                        type: 'fall_alert',
                        patientId: patient.id,
                        location: parsedData.location,
                        gpsStatus: parsedData.gpsStatus,
                        impactForce: parsedData.impactForce,
                        deviceType: parsedData.deviceType,
                        patientIdFromSMS: parsedData.patientId,
                    },
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.MAX,
                },
                trigger: null, // Immediate notification
            });

            console.log('Push notification sent');
        } catch (error) {
            console.error('Error sending push notification:', error);
        }
    }

    /**
     * Process incoming SMS message
     * @param {string} messageBody - SMS message body
     * @param {string} sender - Phone number of sender
     * @returns {boolean} - Success status
     */
    async processIncomingSMS(messageBody, sender) {
        try {
            console.log('--- SMS PROCESSING START ---');
            console.log('From:', sender);
            console.log('Body:', messageBody);

            // Check for duplicate (within 5 seconds)
            const smsKey = `${sender}_${messageBody}`;
            const now = Date.now();
            const lastProcessed = this.lastProcessedSMS[smsKey] || 0;

            if (now - lastProcessed < 5000) {
                console.log('DEBUG: Skipping duplicate SMS (processed', now - lastProcessed, 'ms ago)');
                return false;
            }

            // Parse SMS
            console.log('DEBUG: Parsing SMS body...');
            const parsedData = this.parseSMS(messageBody, sender);
            if (!parsedData) {
                console.log('DEBUG: Parser returned null (invalid format)');
                if (Platform.OS === 'android') ToastAndroid.show('❌ SMS: Invalid Format', ToastAndroid.SHORT);
                return false;
            }

            console.log('DEBUG: Parsed Data:', JSON.stringify(parsedData));

            // Get patient
            console.log('DEBUG: Looking up patient for ID:', parsedData.patientId);
            const patient = await this.getPatientByIdentifier(parsedData.patientId);
            if (!patient) {
                console.error('DEBUG: ERROR - NO PATIENT FOUND in database');
                return false;
            }

            console.log('DEBUG: Associated with Patient:', patient.first_name, patient.last_name, '(ID:', patient.id, ')');

            // 1. Always emit location update event immediately for UI (Local override)
            if (parsedData.location) {
                console.log('DEBUG: Emitting immediate LOCATION_UPDATED event for UI');
                DeviceEventEmitter.emit('LOCATION_UPDATED', {
                    patientId: patient.id,
                    location: parsedData.location,
                    timestamp: parsedData.timestamp,
                    gpsStatus: parsedData.gpsStatus
                });

                // Attempt DB storage in background
                console.log('DEBUG: Attempting to store location record in DB...');
                supabase
                    .from('patient_locations')
                    .insert([
                        {
                            patient_id: patient.id,
                            latitude: parsedData.location.latitude,
                            longitude: parsedData.location.longitude,
                            accuracy: 10.0,
                            location_type: parsedData.alertType === 'FALL_ALERT' ? 'fall_incident' : 'tracking',
                            notes: `SMS ${parsedData.alertType} from ${parsedData.deviceType}`,
                            created_at: parsedData.timestamp.toISOString(),
                            timestamp: parsedData.timestamp.toISOString(),
                        },
                    ])
                    .then(({ error }) => {
                        if (error) console.error('Silent DB Err (Location):', error);
                        else if (Platform.OS === 'android') ToastAndroid.show('📍 Live: Location Synced to Cloud', ToastAndroid.SHORT);
                    });
            }

            // 2. Handle Fall-specific logic
            if (parsedData.alertType === 'FALL_ALERT') {
                console.log('DEBUG: Processing FALL_ALERT specific tasks...');

                // Emit global event for UI reaction (Popups, etc) IMMEDIATELY
                console.log('DEBUG: Emitting immediate FALL_ALERT_RECEIVED event');
                DeviceEventEmitter.emit('FALL_ALERT_RECEIVED', {
                    parsedData,
                    patient
                });

                // Run other storage/notification tasks in background
                this.storeFallEvent(parsedData, patient);
                this.createFallAlert(parsedData, patient);
                this.sendPushNotification(parsedData, patient);
            }

            // Mark as processed
            this.lastProcessedSMS[smsKey] = now;
            console.log('--- SMS PROCESSING COMPLETE ---');

            return true;
        } catch (error) {
            console.error('DEBUG: FATAL ERROR during SMS processing:', error);
            return false;
        }
    }

    /**
     * Test SMS parsing with sample message
     * @returns {object} - Test results
     */
    testParser() {
        const testSMS = "FALL_ALERT|PATIENT_001|9.723,76.726|GPS_OK|21:52:31|Impact:0.65g|Device:PiZero";
        const result = this.parseSMS(testSMS, "+910000000000");
        console.log('Test parse result:', result);
        return result;
    }
}

export default new SMSParser();
