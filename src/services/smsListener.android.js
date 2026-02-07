/**
 * SMS Listener Service for Android
 * Bridges native Android SMS receiver to React Native
 */

import { NativeModules, DeviceEventEmitter, Platform, ToastAndroid } from 'react-native';
import smsParser from './smsParser';

const SmsListener = Platform.OS === 'android' ? NativeModules.SmsListener : null;

class SMSListenerService {
    constructor() {
        this.subscription = null;
        this.isListening = false;
    }

    /**
     * Initialize SMS listener
     */
    async initialize() {
        if (Platform.OS !== 'android') {
            console.log('SMS listener only supported on Android');
            return false;
        }

        try {
            // Subscribe to SMS received events using DeviceEventEmitter
            this.subscription = DeviceEventEmitter.addListener(
                'onSMSReceived',
                this.handleIncomingSMS.bind(this)
            );

            console.log('SMS listener initialized (DeviceEventEmitter)');
            return true;
        } catch (error) {
            console.error('Error initializing SMS listener:', error);
            return false;
        }
    }

    /**
     * Start listening for SMS messages
     */
    async startListening() {
        if (Platform.OS !== 'android' || !SmsListener) {
            return false;
        }

        try {
            SmsListener.startListening();
            this.isListening = true;
            console.log('Started listening for SMS');
            return true;
        } catch (error) {
            console.error('Error starting SMS listener:', error);
            return false;
        }
    }

    /**
     * Stop listening for SMS messages
     */
    stopListening() {
        if (Platform.OS !== 'android' || !SmsListener) {
            return;
        }

        try {
            SmsListener.stopListening();
            this.isListening = false;
            console.log('Stopped listening for SMS');
        } catch (error) {
            console.error('Error stopping SMS listener:', error);
        }
    }

    /**
     * Handle incoming SMS from native module
     * @param {object} sms - SMS data from native module
     */
    async handleIncomingSMS(sms) {
        console.log('Received SMS:', sms);

        try {
            const { sender, message, timestamp, isFallAlert } = sms;

            // Visual feedback for debugging
            if (Platform.OS === 'android') {
                ToastAndroid.show(`JS: Received from ${sender}`, ToastAndroid.SHORT);
            }

            // Process tracking and alerts immediately
            const isAlert = message && (message.includes('FALL_ALERT') || message.includes('LOCATION_UPDATE'));

            if (isFallAlert || isAlert) {
                console.log('Processing incoming monitor SMS');
                if (Platform.OS === 'android') {
                    ToastAndroid.show(`🚨 Parsing ${message.includes('FALL_ALERT') ? 'Fall Alert' : 'Location Update'}...`, ToastAndroid.SHORT);
                }
                const processed = await smsParser.processIncomingSMS(message, sender);

                if (processed && Platform.OS === 'android') {
                    ToastAndroid.show('✅ Processed Successfully', ToastAndroid.SHORT);
                } else if (Platform.OS === 'android') {
                    ToastAndroid.show('❌ Parsing Failed', ToastAndroid.SHORT);
                }
            } else {
                // Log other SMS (optional: implement filtering)
                console.log('Non-monitor SMS received from:', sender);
            }
        } catch (error) {
            console.error('Error handling incoming SMS:', error);
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        if (this.subscription) {
            this.subscription.remove();
            this.subscription = null;
        }

        this.stopListening();
    }

    /**
     * Get listening status
     */
    isActivelyListening() {
        return this.isListening;
    }
}

export default new SMSListenerService();
