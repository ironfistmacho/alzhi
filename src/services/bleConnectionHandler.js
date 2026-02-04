/**
 * BLE Connection Handler
 * 
 * This file should be integrated with your actual BLE library
 * (react-native-ble-plx or Expo BLE)
 * 
 * It handles the connection to ESP32 and listening for data
 */

import bleService from './bleService';

// BLE Configuration
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

/**
 * OPTION 1: Using react-native-ble-plx
 * 
 * Install: npm install react-native-ble-plx
 */
export class BLEConnectionHandler_PlxVersion {
  constructor(bleManager) {
    this.bleManager = bleManager;
    this.connectedDevice = null;
    this.subscription = null;
  }

  /**
   * Connect to ESP32 device and start listening for data
   */
  async connectToDevice(deviceId, patientId, deviceDatabaseId) {
    try {
      console.log('🔗 Connecting to device:', deviceId);

      // Connect to device
      const device = await this.bleManager.connectToDevice(deviceId);
      console.log('✅ Connected to device');

      // Discover services and characteristics
      await device.discoverAllServicesAndCharacteristics();
      console.log('✅ Discovered services and characteristics');

      // Start monitoring characteristic for notifications
      this.subscription = device.monitorCharacteristicForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('❌ BLE characteristic error:', error);
            return;
          }

          if (characteristic?.value) {
            // Decode base64 to string
            const jsonString = atob(characteristic.value);
            console.log('📥 Received BLE data:', jsonString);

            // Process the data
            this.handleIncomingData(jsonString, patientId, deviceDatabaseId);
          }
        }
      );

      this.connectedDevice = device;
      console.log('✅ Listening for BLE notifications');

      return device;
    } catch (error) {
      console.error('❌ Error connecting to device:', error);
      throw error;
    }
  }

  /**
   * Handle incoming BLE data
   */
  async handleIncomingData(jsonData, patientId, deviceDatabaseId) {
    try {
      // Process the incoming data through bleService
      await bleService.processIncomingData(patientId, deviceDatabaseId, jsonData);
      console.log('✅ Data processed successfully');
    } catch (error) {
      console.error('❌ Error handling BLE data:', error);
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect() {
    try {
      if (this.subscription) {
        this.subscription.remove();
        this.subscription = null;
      }

      if (this.connectedDevice) {
        await this.bleManager.cancelDeviceConnection(this.connectedDevice.id);
        this.connectedDevice = null;
        console.log('✅ Device disconnected');
      }
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
    }
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.connectedDevice !== null;
  }
}

/**
 * OPTION 2: Using Expo BLE
 * 
 * Install: expo install expo-ble
 */
export class BLEConnectionHandler_ExpoVersion {
  constructor() {
    this.connectedDeviceId = null;
    this.subscription = null;
  }

  /**
   * Connect to ESP32 device and start listening for data
   */
  async connectToDevice(deviceId, patientId, deviceDatabaseId) {
    try {
      console.log('🔗 Connecting to device:', deviceId);

      // Import Expo BLE
      const BLE = require('expo-ble');

      // Connect to device
      const device = await BLE.connectAsync(deviceId);
      console.log('✅ Connected to device');

      // Start notifications
      await BLE.startNotificationsAsync(
        deviceId,
        SERVICE_UUID,
        CHARACTERISTIC_UUID
      );
      console.log('✅ Started notifications');

      // Listen for characteristic notifications
      this.subscription = BLE.onCharacteristicNotificationReceived(
        ({ value }) => {
          try {
            // Decode the value
            let jsonString;
            if (typeof value === 'string') {
              // Already a string
              jsonString = value;
            } else if (value instanceof Uint8Array) {
              // Convert bytes to string
              jsonString = new TextDecoder().decode(value);
            } else if (Array.isArray(value)) {
              // Convert array to string
              jsonString = String.fromCharCode.apply(null, value);
            } else {
              // Try base64 decoding
              jsonString = atob(value);
            }

            console.log('📥 Received BLE data:', jsonString);

            // Process the data
            this.handleIncomingData(jsonString, patientId, deviceDatabaseId);
          } catch (error) {
            console.error('❌ Error decoding BLE data:', error);
          }
        }
      );

      this.connectedDeviceId = deviceId;
      console.log('✅ Listening for BLE notifications');

      return device;
    } catch (error) {
      console.error('❌ Error connecting to device:', error);
      throw error;
    }
  }

  /**
   * Handle incoming BLE data
   */
  async handleIncomingData(jsonData, patientId, deviceDatabaseId) {
    try {
      // Process the incoming data through bleService
      await bleService.processIncomingData(patientId, deviceDatabaseId, jsonData);
      console.log('✅ Data processed successfully');
    } catch (error) {
      console.error('❌ Error handling BLE data:', error);
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect() {
    try {
      const BLE = require('expo-ble');

      if (this.subscription) {
        this.subscription.remove();
        this.subscription = null;
      }

      if (this.connectedDeviceId) {
        await BLE.stopNotificationsAsync(
          this.connectedDeviceId,
          SERVICE_UUID,
          CHARACTERISTIC_UUID
        );

        await BLE.disconnectAsync(this.connectedDeviceId);
        this.connectedDeviceId = null;
        console.log('✅ Device disconnected');
      }
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
    }
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.connectedDeviceId !== null;
  }
}

/**
 * OPTION 3: Generic Handler (Framework Agnostic)
 * 
 * Use this if you have a custom BLE implementation
 */
export class BLEConnectionHandler_Generic {
  constructor(bleManager) {
    this.bleManager = bleManager;
    this.connectedDevice = null;
  }

  /**
   * Connect to device
   * 
   * @param {string} deviceId - Device ID/MAC address
   * @param {string} patientId - Patient UUID
   * @param {string} deviceDatabaseId - Device record ID in database
   * @returns {Promise<void>}
   */
  async connectToDevice(deviceId, patientId, deviceDatabaseId) {
    try {
      console.log('🔗 Connecting to device:', deviceId);

      // Connect using your BLE manager
      this.connectedDevice = await this.bleManager.connect(deviceId);
      console.log('✅ Connected to device');

      // Start listening for notifications
      this.startListening(patientId, deviceDatabaseId);

      return this.connectedDevice;
    } catch (error) {
      console.error('❌ Error connecting:', error);
      throw error;
    }
  }

  /**
   * Start listening for BLE data
   */
  startListening(patientId, deviceDatabaseId) {
    // Set up a listener for the characteristic
    this.bleManager.onCharacteristicNotification(
      this.connectedDevice,
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      (data) => {
        try {
          // Decode data to JSON string
          const jsonString = this.decodeData(data);
          console.log('📥 Received BLE data:', jsonString);

          // Process the data
          this.handleIncomingData(jsonString, patientId, deviceDatabaseId);
        } catch (error) {
          console.error('❌ Error processing notification:', error);
        }
      }
    );

    console.log('✅ Listening for BLE notifications');
  }

  /**
   * Decode data from various formats
   */
  decodeData(data) {
    if (typeof data === 'string') {
      return data;
    }
    if (data instanceof Uint8Array) {
      return new TextDecoder().decode(data);
    }
    if (Array.isArray(data)) {
      return String.fromCharCode.apply(null, data);
    }
    if (typeof data === 'object' && data.value) {
      return atob(data.value);
    }
    return JSON.stringify(data);
  }

  /**
   * Handle incoming BLE data
   */
  async handleIncomingData(jsonData, patientId, deviceDatabaseId) {
    try {
      // Process the incoming data through bleService
      await bleService.processIncomingData(patientId, deviceDatabaseId, jsonData);
      console.log('✅ Data processed successfully');
    } catch (error) {
      console.error('❌ Error handling BLE data:', error);
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect() {
    try {
      if (this.connectedDevice) {
        await this.bleManager.disconnect(this.connectedDevice);
        this.connectedDevice = null;
        console.log('✅ Device disconnected');
      }
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
    }
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.connectedDevice !== null;
  }
}

/**
 * Export the appropriate handler based on your BLE library
 * 
 * Usage:
 * 
 * // For react-native-ble-plx:
 * import { BleManager } from 'react-native-ble-plx';
 * const bleManager = new BleManager();
 * const handler = new BLEConnectionHandler_PlxVersion(bleManager);
 * 
 * // For Expo BLE:
 * const handler = new BLEConnectionHandler_ExpoVersion();
 * 
 * // For custom implementation:
 * const handler = new BLEConnectionHandler_Generic(yourBleManager);
 * 
 * // Connect to device
 * await handler.connectToDevice(deviceId, patientId, deviceDatabaseId);
 * 
 * // Disconnect
 * await handler.disconnect();
 */

export default {
  BLEConnectionHandler_PlxVersion,
  BLEConnectionHandler_ExpoVersion,
  BLEConnectionHandler_Generic,
};
