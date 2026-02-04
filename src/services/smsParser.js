/**
 * SMS Parser Service
 * Parses structured SMS messages from Raspberry Pi fall detection system
 * Format: FALL_ALERT|PATIENT_ID|LAT,LON|TIMESTAMP|Battery:XX%|Device:Pi
 */

import { supabase } from './supabase';
import * as Notifications from 'expo-notifications';

class SMSParser {
    constructor() {
        this.lastProcessedSMS = {};
    }

    /**
     * Parse structured fall alert SMS
     * @param {string} messageBody - SMS message body
     * @param {string} sender - Phone number of sender
     * @returns {object|null} - Parsed data or null if invalid
     */
    parseFallAlertSMS(messageBody, sender) {
        try {
            // Expected format: FALL_ALERT|PATIENT_001|12.345678,98.765432|2024-01-15 14:30:45|Battery:85%|Device:Pi
            const parts = messageBody.trim().split('|');

            if (parts.length < 6) {
                console.log('Invalid SMS format: insufficient fields');
                return null;
            }

            // Validate alert type
            if (parts[0] !== 'FALL_ALERT') {
                console.log('Not a fall alert SMS');
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

                    // Validate coordinates
                    if (isNaN(latitude) || isNaN(longitude)) {
                        console.warn('Invalid GPS coordinates in SMS');
                        latitude = null;
                        longitude = null;
                    }
                }
            }

            // Parse timestamp
            const timestamp = parts[3].trim();

            // Parse additional metrics (flexible order)
            let batteryLevel = null;
            let impactForce = 0;

            for (let i = 4; i < parts.length; i++) {
                const part = parts[i].trim();
                const batteryMatch = part.match(/Battery:(\d+)%/);
                if (batteryMatch) batteryLevel = parseInt(batteryMatch[1]);

                const impactMatch = part.match(/Impact:([\d.]+)g/);
                if (impactMatch) impactForce = parseFloat(impactMatch[1]);
            }

            // Parse device type
            const devicePart = parts.find(p => p.includes('Device:')) || 'Device:Pi';
            const deviceType = devicePart.replace('Device:', '').trim();

            return {
                alertType: 'FALL_ALERT',
                patientId,
                location: latitude && longitude ? { latitude, longitude } : null,
                timestamp: new Date(), // Use current time for reliability
                battery: batteryLevel,
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
            // Try to find patient by notes field (where device ID might be stored)
            const { data: patients, error } = await supabase
                .from('patients')
                .select('*')
                .ilike('notes', `%${patientId}%`)
                .limit(1);

            if (error) throw error;

            if (patients && patients.length > 0) {
                return patients[0];
            }

            // If not found, return first patient (for demo/testing)
            const { data: firstPatient } = await supabase
                .from('patients')
                .select('*')
                .limit(1)
                .single();

            return firstPatient;
        } catch (error) {
            console.error('Error fetching patient:', error);
            return null;
        }
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
                console.error('Error storing fall event:', fallError);
                return null;
            }

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
                ? `Location: ${parsedData.location.latitude.toFixed(6)}, ${parsedData.location.longitude.toFixed(6)}`
                : 'Location: GPS fix not available';

            const { data: alert, error } = await supabase
                .from('patient_alerts')
                .insert([
                    {
                        patient_id: patient.id,
                        alert_type: 'fall',
                        title: '🚨 FALL DETECTED (Raspberry Pi)',
                        message: `Fall detected via SMS alert. ${locationInfo} | Impact: ${parsedData.impactForce}g`,
                        priority: 'critical',
                        is_read: false,
                        is_acknowledged: false,
                        metadata: {
                            source: 'sms',
                            device_type: parsedData.deviceType,
                            sender: parsedData.sender,
                            impact: parsedData.impactForce,
                            location: parsedData.location,
                        },
                        created_at: parsedData.timestamp.toISOString(),
                    },
                ])
                .select()
                .single();

            if (error) {
                console.error('Error creating alert:', error);
                return null;
            }

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
                ? `at ${parsedData.location.latitude.toFixed(4)}, ${parsedData.location.longitude.toFixed(4)}`
                : 'location unknown';

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '🚨 FALL ALERT',
                    body: `${patient.first_name} ${patient.last_name} has fallen ${locationText}`,
                    data: {
                        type: 'fall_alert',
                        patientId: patient.id,
                        location: parsedData.location
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
            console.log('Processing SMS from:', sender);
            console.log('Message:', messageBody);

            // Check for duplicate (within 60 seconds)
            const smsKey = `${sender}_${messageBody}`;
            const now = Date.now();
            const lastProcessed = this.lastProcessedSMS[smsKey] || 0;

            if (now - lastProcessed < 60000) {
                console.log('Duplicate SMS detected, ignoring');
                return false;
            }

            // Parse SMS
            const parsedData = this.parseFallAlertSMS(messageBody, sender);
            if (!parsedData) {
                console.log('SMS does not match fall alert format');
                return false;
            }

            console.log('Parsed SMS data:', parsedData);

            // Get patient
            const patient = await this.getPatientByIdentifier(parsedData.patientId);
            if (!patient) {
                console.error('Could not find patient for identifier:', parsedData.patientId);
                return false;
            }

            console.log('Found patient:', patient.first_name, patient.last_name);

            // Store fall event
            const fallEvent = await this.storeFallEvent(parsedData, patient);
            console.log('Fall event stored:', fallEvent?.id);

            // Create alert
            const alert = await this.createFallAlert(parsedData, patient);
            console.log('Alert created:', alert?.id);

            // Send push notification
            await this.sendPushNotification(parsedData, patient);

            // Mark as processed
            this.lastProcessedSMS[smsKey] = now;

            // If location available, trigger geofencing (will be implemented in geofencing service)
            if (parsedData.location) {
                console.log('Location available, geofencing will be triggered');
                // GeofencingService will handle this via database trigger or direct call
            }

            return true;
        } catch (error) {
            console.error('Error processing SMS:', error);
            return false;
        }
    }

    /**
     * Test SMS parsing with sample message
     * @returns {object} - Test results
     */
    testParser() {
        const testSMS = "FALL_ALERT|PATIENT_001|12.345678,98.765432|2024-01-15 14:30:45|Battery:85%|Device:Pi";
        const result = this.parseFallAlertSMS(testSMS, "+1234567890");
        console.log('Test parse result:', result);
        return result;
    }
}

export default new SMSParser();
