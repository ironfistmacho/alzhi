import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
  TouchableOpacity,
  Switch,
  Modal,
  Platform,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import { Card, Button, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import bleService from '../services/bleService';
import { atob } from '../utils/base64';

// Hardcoded Supabase client - REMOVED (Using imported service)
// Hardcoded BLE Service - REMOVED (Using imported service)

// Mock BleManager class (fallback)
class MockBleManager {
  constructor() {
    console.log('⚠️ MockBleManager initialized - native BLE module not available');
    console.log('⚠️ To enable real BLE scanning, run: expo prebuild --clean && npm run android');
  }

  async state() {
    console.log('📡 MockBleManager.state() - returning PoweredOn');
    return 'PoweredOn';
  }

  onStateChange(callback, emitCurrentState = false) {
    console.log('📡 MockBleManager.onStateChange() - setting up mock state listener');
    if (emitCurrentState && callback) {
      callback('PoweredOn');
    }
    return {
      remove: () => {
        console.log('📡 Mock state subscription removed');
      }
    };
  }

  startDeviceScan(serviceUUIDs, scanOptions, callback) {
    console.log('📡 MockBleManager.startDeviceScan() - starting mock scan');

    // Simulate some mock devices after a short delay
    if (callback && typeof callback === 'function') {
      setTimeout(() => {
        console.log('📱 MockBleManager: Simulating device discovery');
        // Simulate finding a mock ESP32 device
        callback(null, {
          id: 'mock-esp32-001',
          name: 'ESP32-Mock',
          rssi: -50,
          isConnectable: true,
        });
      }, 500);
    }

    // Return a subscription object with remove method
    return {
      remove: () => {
        console.log('📡 Mock scan subscription removed');
      }
    };
  }

  async stopDeviceScan() {
    console.log('📡 MockBleManager.stopDeviceScan() - stopping mock scan');
    return true;
  }

  async connectToDevice(deviceId) {
    console.log('🔗 MockBleManager.connectToDevice():', deviceId);
    return {
      id: deviceId,
      discoverAllServicesAndCharacteristics: async () => {
        console.log('🔍 MockBleManager: Discovering services and characteristics');
        return true;
      },
      readCharacteristicForService: async (serviceUUID, characteristicUUID) => {
        console.log('📖 MockBleManager: Reading characteristic');
        return { value: btoa(JSON.stringify({ heart_rate: 72, spo2: 98, temperature: 36.5 })) };
      },
      writeCharacteristicWithResponseForService: async (serviceUUID, characteristicUUID, data) => {
        console.log('✍️ MockBleManager: Writing characteristic');
        return true;
      },
      monitorCharacteristicForService: (serviceUUID, characteristicUUID, callback) => {
        console.log('📡 MockBleManager: Monitoring characteristic');
        if (callback) {
          setTimeout(() => {
            callback(null, { value: btoa(JSON.stringify({ heart_rate: 72, spo2: 98, temperature: 36.5 })) });
          }, 1000);
        }
        return { remove: () => { } };
      },
      cancelConnection: async () => {
        console.log('❌ MockBleManager: Canceling connection');
        return true;
      }
    };
  }

  async disconnectDevice(deviceId) {
    console.log('❌ MockBleManager.disconnectDevice():', deviceId);
    return true;
  }

  async discoverAllServicesAndCharacteristics() {
    console.log('🔍 MockBleManager.discoverAllServicesAndCharacteristics()');
    return true;
  }

  monitorCharacteristicForService(serviceUUID, characteristicUUID, callback) {
    console.log('📡 MockBleManager.monitorCharacteristicForService()');
    return {
      remove: () => {
        console.log('📡 Mock characteristic subscription removed');
      }
    };
  }
}

// Real BLE Manager initialization
let BleManagerInstance = null;
let useRealBLE = false;

console.log('🚀 Initializing Real BLE Manager (react-native-ble-plx)...');

try {
  // Import the real BLE library
  const { BleManager } = require('react-native-ble-plx');

  if (BleManager && typeof BleManager === 'function') {
    BleManagerInstance = new BleManager();
    useRealBLE = true;
    console.log('✅ Real BLE Manager initialized');
  }
} catch (error) {
  console.log('⚠️ Native BLE module not available (Mock active)');
}

if (!useRealBLE) {
  console.log('✅ Mock BLE Manager active for testing');
}

// Real BLE Manager wrapper
class BluetoothManager {
  constructor() {
    try {
      if (useRealBLE && BleManagerInstance) {
        // Use the real BLE manager instance
        this.manager = BleManagerInstance;
        console.log('✅ Using real BLE Manager instance');
      } else {
        console.warn('⚠️ Real BLE Manager not available, using MockBleManager');
        this.manager = new MockBleManager();
      }
    } catch (error) {
      console.error('❌ Error initializing BLE Manager:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.warn('⚠️ Falling back to MockBleManager');
      this.manager = new MockBleManager();
    }

    this.isScanning = false;
    this.bluetoothEnabled = false;
    this.listeners = [];
    this.discoveredDevices = new Map();
    this.connectedDevices = new Map();
    this.scanSubscription = null;
    this.stateSubscription = null;

    // ESP32 BLE Configuration
    this.SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
    this.CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

    // Initialize BLE state
    this.initializeBLE();
  }

  async initializeBLE() {
    try {
      // Request permissions on Android
      // Request permissions on Android with Version Check
      if (Platform.OS === 'android') {
        let permissions = [];

        // Android 12+ (SDK 31+) requires specific BLE permissions
        if (Platform.Version >= 31) {
          permissions = [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, // Often still needed for legacy support
          ];
        } else {
          // Android 11 and below require Location permissions for BLE
          permissions = [
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          ];
        }

        console.log('📱 Requesting Permissions for Android', Platform.Version, permissions);
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        console.log('📱 Android Permissions Result:', granted);

        const allGranted = Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          console.warn('⚠️ Some permissions not granted! BLE Check might fail.');
          Alert.alert('Permission Error', 'Bluetooth Scan/Connect or Location permissions are required.');
        }
      }

      // Check BLE state
      const state = await this.manager.state();
      console.log('📡 BLE State:', state);

      if (state === 'PoweredOn') {
        this.bluetoothEnabled = true;
        console.log('✅ Bluetooth is powered on');
      } else {
        console.warn('⚠️ Bluetooth is not powered on. State:', state);
      }
    } catch (error) {
      console.error('❌ Error initializing BLE:', error);
    }
  }

  async state() {
    try {
      const state = await this.manager.state();
      return state;
    } catch (error) {
      console.error('Error getting BLE state:', error);
      return 'Unknown';
    }
  }

  onStateChange(callback, emitCurrentState = false) {
    try {
      this.stateSubscription = this.manager.onStateChange((state) => {
        if (callback && typeof callback === 'function') {
          callback(state);
        }
      }, true);

      if (emitCurrentState) {
        this.state().then(state => {
          if (callback && typeof callback === 'function') {
            callback(state);
          }
        });
      }
    } catch (error) {
      console.error('Error setting up state change listener:', error);
    }

    return {
      remove: () => {
        if (this.stateSubscription) {
          this.stateSubscription.remove();
        }
      }
    };
  }

  async startDeviceScan(serviceUUIDs, scanOptions, callback) {
    try {
      this.isScanning = true;
      this.discoveredDevices.clear();

      console.log('🔍 Starting BLE scan...');
      console.log('📡 Scanning for all BLE devices...');

      // Check if manager is available
      if (!this.manager) {
        console.error('❌ BLE Manager not available');
        this.isScanning = false;
        return;
      }

      // CRITICAL: Check Location Permission before scanning (common cause of 'Cannot start scanning')
      if (Platform.OS === 'android') {
        const hasLocation = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (!hasLocation) {
          console.warn('⚠️ Location permission missing. Requesting now...');
          const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.error('❌ Location permission denied. Cannot scan.');
            if (callback) callback(new Error('Location permission denied'), null);
            this.isScanning = false;
            return;
          }
        }
      }

      // Check if manager has startDeviceScan method
      if (typeof this.manager.startDeviceScan !== 'function') {
        console.error('❌ BLE Manager does not have startDeviceScan method');
        this.isScanning = false;
        return;
      }

      // Ensure BLE is powered on
      try {
        const state = await this.manager.state();
        console.log('📡 Current BLE state:', state);

        if (state !== 'PoweredOn') {
          console.error('❌ Bluetooth is not powered on! State:', state);
          if (state === 'Unauthorized') {
            console.error('❌ BLE Unauthorized. Configuring permissions...');
            // Sometimes strictly requesting CONNECT usually fixes this on A12
            if (Platform.Version >= 31) {
              await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
            }
          }

          this.isScanning = false;
          return;
        }
        this.bluetoothEnabled = true;
      } catch (stateError) {
        console.warn('⚠️ Could not check BLE state:', stateError.message);
      }

      // Stop any existing scan
      // Stop any existing scan - FORCE STOP to fix "Cannot start scanning operation"
      try {
        console.log('🛑 Stopping any previous scans...');
        this.manager.stopDeviceScan();
        if (this.scanSubscription) {
          if (typeof this.scanSubscription.remove === 'function') {
            this.scanSubscription.remove();
          }
          this.scanSubscription = null;
        }
        // Increased delay to 1000ms to allow Bluetooth/Location stack to reset completely
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn('⚠️ Could not stop previous scan:', e);
      }

      // Check for already connected devices (they won't show up in scan)
      try {
        const connectedDevices = await this.manager.connectedDevices([this.SERVICE_UUID]);
        if (connectedDevices && connectedDevices.length > 0) {
          console.log('🔗 Found already connected devices:', connectedDevices.length);
          connectedDevices.forEach(device => {
            // mimic a successful scan result
            const deviceName = device.name || device.localName || 'Unknown Device (Paired)';
            const deviceObj = {
              id: device.id,
              name: deviceName,
              rssi: 0,
              type: 'BLE Device (Paired)',
              isConnectable: true,
              rawDevice: device
            };
            if (callback) callback(null, deviceObj);
          });
        }
      } catch (connError) {
        console.warn('⚠️ Error checking connected devices:', connError);
      }

      // Real BLE scan callback
      const scanCallback = (error, device) => {
        try {
          if (error) {
            console.error('❌ BLE Scan error:', error.message || error);

            // Critical fix: Stop scan if it fails to start to prevent error spam
            if (error.message && error.message.includes('Cannot start scanning operation')) {
              console.warn('⚠️ HINT: Enable GPS/Location Services (Required for BLE on Android)');
              this.stopDeviceScan();
            }

            if (callback) callback(error, null);
            return;
          }

          if (!device) {
            console.log('📱 Device is null, skipping');
            return;
          }

          if (!device.id) {
            console.log('📱 Device has no ID, skipping');
            return;
          }

          const deviceName = device.name || device.localName || `Unknown (${device.id.substring(0, 5)})`;
          const rssi = device.rssi || -100;

          // Log all found devices for debugging
          console.log('📱 Found device:', deviceName, '| ID:', device.id, '| RSSI:', rssi, '| Connectable:', device.isConnectable);

          // Accept all devices - don't filter by name
          // This ensures we see all devices
          if (!this.discoveredDevices.has(device.id)) {
            const deviceObj = {
              id: device.id,
              name: deviceName,
              rssi: rssi,
              type: 'BLE Device',
              isConnectable: device.isConnectable !== false,
              rawDevice: device, // Store raw device for connection
            };
            this.discoveredDevices.set(device.id, deviceObj);
            console.log('✅ Added device to list:', deviceObj.name);

            // Call callback immediately
            if (callback && typeof callback === 'function') {
              try {
                callback(null, deviceObj);
              } catch (callbackError) {
                console.error('❌ Error in callback:', callbackError);
              }
            }
          }
        } catch (callbackError) {
          console.error('❌ Error in scan callback:', callbackError);
        }
      };

      // Check for already connected devices (they won't show up in scan)
      try {
        const connectedDevices = await this.manager.connectedDevices([this.SERVICE_UUID]);
        if (connectedDevices && connectedDevices.length > 0) {
          console.log('🔗 Found already connected devices:', connectedDevices.length);
          connectedDevices.forEach(device => {
            scanCallback(null, device);
          });
        }
      } catch (connError) {
        console.warn('⚠️ Error checking connected devices:', connError);
      }

      // Start the actual BLE scan
      console.log('📡 Calling manager.startDeviceScan()...');
      console.log('📡 Scan options:', { allowDuplicates: false });

      this.scanSubscription = this.manager.startDeviceScan(
        null, // Scan all devices - no service UUID filter
        { allowDuplicates: false },
        scanCallback
      );

      if (!this.scanSubscription) {
        console.error('❌ startDeviceScan returned null/undefined');
        this.isScanning = false;
        return;
      }

      console.log('✅ Real BLE scan started successfully');
      console.log('⏱️ Scanning for devices...');

    } catch (error) {
      console.error('❌ Error starting BLE scan:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      this.isScanning = false;
    }
  }

  async stopDeviceScan() {
    try {
      this.isScanning = false;
      if (this.scanSubscription) {
        // Check if remove method exists
        if (typeof this.scanSubscription.remove === 'function') {
          this.scanSubscription.remove();
        } else if (typeof this.scanSubscription === 'function') {
          // If scanSubscription is a function, call it to unsubscribe
          this.scanSubscription();
        }
        this.scanSubscription = null;
      }
      console.log('✅ BLE scan stopped');
    } catch (error) {
      console.warn('⚠️ Error stopping BLE scan:', error);
      this.scanSubscription = null;
    }
  }

  async connectToDevice(deviceId) {
    try {
      const device = this.discoveredDevices.get(deviceId);
      if (!device) {
        throw new Error('Device not found in discovered devices');
      }

      console.log('🔗 Connecting to device:', device.name);

      // Get the actual device object from manager
      const realDevice = await this.manager.connectToDevice(deviceId);

      // Request high connection priority on Android for faster updates (lower latency)
      if (Platform.OS === 'android') {
        try {
          await realDevice.requestConnectionPriority(2); // 2 = High Priority (ConnectionPriority.High)
          console.log('⚡ Requested high urgency connection priority');
        } catch (priorityError) {
          console.warn('⚠️ Could not set connection priority:', priorityError);
        }
      }

      // Discover all services and characteristics
      await realDevice.discoverAllServicesAndCharacteristics();

      console.log('✅ Connected to device:', device.name);

      this.connectedDevices.set(deviceId, {
        ...device,
        device: realDevice,
      });

      return device;
    } catch (error) {
      console.error('❌ Error connecting to device:', error);
      throw error;
    }
  }

  async disconnectDevice(deviceId) {
    try {
      const connectedDevice = this.connectedDevices.get(deviceId);
      if (connectedDevice && connectedDevice.device) {
        await connectedDevice.device.cancelConnection();
        console.log('✅ Disconnected from device:', connectedDevice.name);
      }
      this.connectedDevices.delete(deviceId);
      return true;
    } catch (error) {
      console.error('❌ Error disconnecting device:', error);
      throw error;
    }
  }

  async readData(deviceId) {
    try {
      const connectedDevice = this.connectedDevices.get(deviceId);
      if (!connectedDevice || !connectedDevice.device) {
        throw new Error('Device not connected');
      }

      const characteristic = await connectedDevice.device.readCharacteristicForService(
        this.SERVICE_UUID,
        this.CHARACTERISTIC_UUID
      );

      return characteristic.value;
    } catch (error) {
      console.error('❌ Error reading data:', error);
      throw error;
    }
  }

  async writeData(deviceId, data) {
    try {
      const connectedDevice = this.connectedDevices.get(deviceId);
      if (!connectedDevice || !connectedDevice.device) {
        throw new Error('Device not connected');
      }

      await connectedDevice.device.writeCharacteristicWithResponseForService(
        this.SERVICE_UUID,
        this.CHARACTERISTIC_UUID,
        data
      );

      return true;
    } catch (error) {
      console.error('❌ Error writing data:', error);
      throw error;
    }
  }

  async requestMTU(deviceId, mtu) {
    try {
      const connectedDevice = this.connectedDevices.get(deviceId);
      if (!connectedDevice || !connectedDevice.device) {
        throw new Error('Device not connected');
      }

      // MTU request is only needed/available on Android
      if (Platform.OS === 'android') {
        const device = await connectedDevice.device.requestMTU(mtu);
        console.log(`✅ MTU set to ${mtu}`);
      }
      return true;
    } catch (error) {
      console.warn('⚠️ Error requesting MTU:', error);
      return false;
    }
  }

  async subscribeToNotifications(deviceId, callback) {
    try {
      const connectedDevice = this.connectedDevices.get(deviceId);
      if (!connectedDevice || !connectedDevice.device) {
        throw new Error('Device not connected');
      }

      // Initialize buffer for this device
      connectedDevice.buffer = '';

      const subscription = connectedDevice.device.monitorCharacteristicForService(
        this.SERVICE_UUID,
        this.CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('❌ Notification error:', error);
            if (callback) callback(error, null);
            return;
          }

          if (characteristic && characteristic.value) {
            try {
              // DEBUG: Log raw Base64 value
              console.log('📡 BLE Raw Base64:', characteristic.value.substring(0, 50) + (characteristic.value.length > 50 ? '...' : ''));

              // Decode base64 value using custom atob
              const chunk = atob(characteristic.value);

              // DEBUG: Log received data
              if (chunk.length < 50) {
                console.log('📡 BLE Chunk:', chunk);
              } else {
                console.log('📡 BLE Data (Long):', chunk.substring(0, 30) + '...');
              }

              // Append to buffer
              connectedDevice.buffer += chunk;

              // Robust JSON Extraction
              // We look for a valid JSON object starting from the first '{'
              let startIndex = connectedDevice.buffer.indexOf('{');
              while (startIndex !== -1) {
                // Discard any garbage before the first '{'
                if (startIndex > 0) {
                  connectedDevice.buffer = connectedDevice.buffer.substring(startIndex);
                  startIndex = 0;
                }

                // Try to find a potential end of the JSON object
                // Instead of just lastIndexOf, we find the first '}' and check if it parses
                // This handles cases where multiple JSON objects are in the buffer
                let endIndex = connectedDevice.buffer.indexOf('}', startIndex);

                while (endIndex !== -1) {
                  const jsonString = connectedDevice.buffer.substring(startIndex, endIndex + 1);

                  try {
                    const jsonData = JSON.parse(jsonString);

                    // SUCCESS! We have a full JSON object.
                    if (callback) callback(null, jsonData);

                    // Remove the processed JSON from the buffer
                    connectedDevice.buffer = connectedDevice.buffer.substring(endIndex + 1);

                    // Look for the next JSON object in the remaining buffer
                    startIndex = connectedDevice.buffer.indexOf('{');
                    break; // Exit inner loop, continue with next object if any
                  } catch (parseError) {
                    // Not a full JSON yet (e.g., nested braces or just not the end)
                    // If the string starts with { and ends with } but fails, log it
                    if (jsonString.startsWith('{') && jsonString.endsWith('}') && jsonString.length > 50) {
                      console.warn('⚠️ Malformed JSON or Fragment:', jsonString.substring(0, 40) + '...');
                    }
                    // Look for the next '}'
                    endIndex = connectedDevice.buffer.indexOf('}', endIndex + 1);
                  }
                }

                if (endIndex === -1) {
                  // No complete JSON found in the current buffer, wait for more data
                  break;
                }
              }

              // Prevent runaway buffer growth
              if (connectedDevice.buffer.length > 2000) {
                console.warn('⚠️ Buffer runaway, clearing.');
                connectedDevice.buffer = '';
              }
            } catch (err) {
              console.error('❌ Error processing BLE data:', err);
              connectedDevice.buffer = ''; // Reset on critical error
              if (callback) callback(err, null);
            }
          }
        }
      );

      // Store subscription in the manager's device record
      connectedDevice.subscription = subscription;

      return subscription;
    } catch (error) {
      console.error('❌ Error subscribing to notifications:', error);
      throw error;
    }
  }

  getConnectedDevices() {
    return Array.from(this.connectedDevices.values()).map(({ device, ...rest }) => rest);
  }

  async retrieveConnected() {
    try {
      if (!this.manager || !this.manager.connectedDevices) return [];
      console.log('🔗 retrieving connected devices for services...');

      // Check multiple services to catch devices that might simply be bonded
      // 1. Our Custom Service
      // 2. Generic Access (0x1800)
      // 3. Generic Attribute (0x1801)
      const serviceUUIDs = [
        this.SERVICE_UUID,
        '00001800-0000-1000-8000-00805f9b34fb',
        '00001801-0000-1000-8000-00805f9b34fb'
      ];

      const devices = await this.manager.connectedDevices(serviceUUIDs);
      if (!devices) return [];

      // Deduplicate devices by ID
      const uniqueDevices = new Map();
      devices.forEach(d => {
        if (!uniqueDevices.has(d.id)) {
          uniqueDevices.set(d.id, d);
        }
      });

      return Array.from(uniqueDevices.values()).map(d => ({
        id: d.id,
        name: d.name || d.localName || 'Paired Device',
        rssi: 0, // Connected devices don't usually report RSSI easily
        type: 'BLE Device (Paired)',
        isConnectable: true
      }));
    } catch (error) {
      console.warn('Error retrieving connected:', error);
      return [];
    }
  }

  async cleanup() {
    try {
      await this.stopDeviceScan();

      // Disconnect all devices
      for (const [deviceId] of this.connectedDevices) {
        try {
          await this.disconnectDevice(deviceId);
        } catch (e) {
          console.error('Error disconnecting device during cleanup:', e);
        }
      }

      if (this.stateSubscription) {
        this.stateSubscription.remove();
      }

      this.connectedDevices.clear();
      this.discoveredDevices.clear();
      console.log('✅ BLE Manager cleaned up');
    } catch (error) {
      console.error('❌ Error in cleanup:', error);
    }
  }
}

const DeviceConnectionScreen = ({ navigation }) => {
  const [devices, setDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [caregiverId, setCaregiverId] = useState(null);

  // Initialize BLE Manager with lazy initialization
  const bleManagerRef = useRef(null);
  if (!bleManagerRef.current) {
    bleManagerRef.current = new BluetoothManager();
  }

  const [vitals, setVitals] = useState({
    heartRate: '--',
    spo2: '--',
    temperature: '--',
    stepCount: 0,
    fallDetected: false,
    sleepStatus: 'Awake',
  });

  useFocusEffect(
    useCallback(() => {
      checkBluetoothStatus();
      fetchCaregiverAndPatients();
    }, [])
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bleManagerRef.current) {
        try {
          bleManagerRef.current.cleanup();
        } catch (e) {
          console.error('Error during cleanup:', e);
        }
      }
    };
  }, []);

  const checkBluetoothStatus = async () => {
    try {
      setLoading(true);
      // Check actual Bluetooth state
      const state = await bleManagerRef.current.state();
      console.log('Bluetooth state:', state);
      setBluetoothEnabled(state === 'PoweredOn');
    } catch (error) {
      console.error('Error checking Bluetooth:', error);
      setBluetoothEnabled(false);
    } finally {
      setLoading(false);
    }
  };

  // Monitor Bluetooth state changes in real-time
  useEffect(() => {
    let subscription = null;

    const setupStateMonitoring = async () => {
      try {
        // Initial state check
        const initialState = await bleManagerRef.current.state();
        console.log('📡 Initial Bluetooth state:', initialState);
        setBluetoothEnabled(initialState === 'PoweredOn');

        // Set up state change listener
        subscription = bleManagerRef.current.onStateChange((state) => {
          console.log('📡 Bluetooth state changed:', state);
          setBluetoothEnabled(state === 'PoweredOn');
        }, true);
      } catch (error) {
        console.error('Error setting up BLE state monitoring:', error);
      }
    };

    setupStateMonitoring();

    return () => {
      // Cleanup
      if (subscription && typeof subscription.remove === 'function') {
        try {
          subscription.remove();
        } catch (e) {
          console.warn('⚠️ Error removing subscription:', e);
        }
      }
    };
  }, []);

  const fetchCaregiverAndPatients = async (force = false) => {
    // If we already have data and not forcing refresh, skip
    if (caregiverId && patients.length > 0 && !force) {
      return;
    }

    try {
      // Get current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error('Error getting session:', sessionError);
        return;
      }

      const user = session.user;

      // Get caregiver ID
      const { data: caregiverData, error: caregiverError } = await supabase
        .from('caregivers')
        .select('id')
        .eq('auth_id', user.id)
        .single();

      if (caregiverError) {
        console.error('Error fetching caregiver:', caregiverError);
        return;
      }

      if (caregiverData) {
        setCaregiverId(caregiverData.id);

        // Fetch patients for this caregiver
        const { data: patientsData, error: patientsError } = await supabase
          .from('patients')
          .select('id, first_name, last_name')
          .eq('caregiver_id', caregiverData.id)
          .order('created_at', { ascending: false });

        if (patientsError) {
          console.error('Error fetching patients:', patientsError);
          return;
        }

        setPatients(patientsData || []);
      }
    } catch (error) {
      console.error('Error fetching caregiver and patients:', error);
    }
  };

  const startScanning = async () => {
    try {
      console.log('🔍 Starting BLE scan...');
      setScanning(true);
      setDevices([]);

      // Verify BLE Manager is initialized
      if (!bleManagerRef.current) {
        throw new Error('BLE Manager not initialized');
      }

      console.log('✅ BLE Manager initialized:', typeof bleManagerRef.current);

      // Check Bluetooth state first
      const state = await bleManagerRef.current.state();
      console.log('✅ Current Bluetooth state:', state);

      if (state !== 'PoweredOn') {
        Alert.alert('Bluetooth Off', 'Please enable Bluetooth to scan for devices');
        setScanning(false);
        return;
      }

      // First check for already connected devices
      await checkConnectedDevices();

      // Start scanning immediately
      console.log('🔍 Calling scanForDevices...');
      await scanForDevices();
    } catch (error) {
      console.error('❌ Error starting scan:', error);
      console.error('❌ Error stack:', error.stack);
      Alert.alert('Error', 'Failed to start Bluetooth scan: ' + error.message);
      setScanning(false);
    }
  };

  const checkConnectedDevices = async () => {
    try {
      console.log('🔗 Checking for paired/connected devices...');
      const connected = await bleManagerRef.current.retrieveConnected();

      if (connected && connected.length > 0) {
        console.log(`🔗 Found ${connected.length} connected devices`);
        setDevices(prev => {
          // Merge with existing avoiding duplicates
          const newDevices = [...prev];
          connected.forEach(d => {
            if (!newDevices.some(existing => existing.id === d.id)) {
              newDevices.push(d);
            }
          });
          return newDevices;
        });
        Alert.alert('Found Connected Device', `Found ${connected.length} device(s) already connected to phone. Check list.`);
      } else {
        console.log('🔗 No connected devices found via specific service UUID');
      }
    } catch (error) {
      console.error('❌ Error checking connected devices:', error);
    }
  };

  const scanForDevices = async () => {
    try {
      const deviceMap = new Map();
      let scanTimeout;

      console.log('✅ Starting device scan');

      // Start scanning for devices
      if (!bleManagerRef.current) {
        throw new Error('BLE Manager not initialized');
      }

      if (typeof bleManagerRef.current.startDeviceScan !== 'function') {
        throw new Error('startDeviceScan is not a function');
      }

      // Define the callback function
      const scanCallback = (error, device) => {
        try {
          console.log('📡 Scan callback triggered:', { error: !!error, device: !!device });

          if (error) {
            console.error('❌ Scan error:', error);
            return;
          }

          if (device && device.id) {
            // console.log('✅ Found device:', device.name, device.id, device.rssi);

            // Add all devices (including unnamed ones)
            if (!deviceMap.has(device.id)) {
              const deviceObj = {
                id: device.id,
                name: device.name || `Unknown (${device.id.substring(0, 5)})`,
                rssi: device.rssi || -100,
                type: device.type || 'MAX30102 + MPU6050',
              };
              deviceMap.set(device.id, deviceObj);
              // console.log('✅ Added device:', deviceObj.name);
            }
          }
        } catch (callbackError) {
          console.error('❌ Error in scan callback:', callbackError);
          console.error('❌ Callback error stack:', callbackError.stack);
        }
      };

      // Call startDeviceScan with proper error handling
      console.log('📡 Calling startDeviceScan with callback');
      await bleManagerRef.current.startDeviceScan(null, null, scanCallback);
      console.log('✅ startDeviceScan initiated');

      // Stop scanning after 10 seconds and update UI
      scanTimeout = setTimeout(() => {
        console.log('✅ Stopping scan. Found devices:', deviceMap.size);

        try {
          if (bleManagerRef.current && typeof bleManagerRef.current.stopDeviceScan === 'function') {
            bleManagerRef.current.stopDeviceScan();
          }
        } catch (stopError) {
          console.error('❌ Error stopping scan:', stopError);
        }

        const foundDevices = Array.from(deviceMap.values());
        console.log('✅ Devices to display:', foundDevices);

        setDevices(foundDevices);
        setScanning(false);

        if (foundDevices.length === 0) {
          Alert.alert(
            'No Devices Found',
            'Make sure your ESP32 device is powered on and broadcasting'
          );
        }
      }, 10000);

      return () => {
        clearTimeout(scanTimeout);
        try {
          if (bleManagerRef.current && typeof bleManagerRef.current.stopDeviceScan === 'function') {
            bleManagerRef.current.stopDeviceScan();
          }
        } catch (e) {
          console.error('❌ Error in cleanup:', e);
        }
      };
    } catch (error) {
      console.error('❌ Error scanning for devices:', error);
      console.error('❌ Error stack:', error.stack);
      Alert.alert('Error', 'Failed to scan for devices: ' + error.message);
      setScanning(false);
    }
  };

  const connectToDevice = async (device) => {
    // Check if patient is selected
    if (!selectedPatient) {
      Alert.alert('Patient Required', 'Please select a patient before connecting a device');
      return;
    }

    try {
      setLoading(true);
      console.log('🔗 Connecting to device:', device.name);

      // Connect to device via BLE
      await bleManagerRef.current.connectToDevice(device.id);
      console.log('✅ BLE connection established');

      // Request higher MTU for sending large JSON payloads
      await bleManagerRef.current.requestMTU(device.id, 512);

      // Save device to database
      let savedDevice = null;
      let databaseId = null;

      try {
        if (!supabase || !supabase.from) {
          throw new Error('Supabase not initialized');
        }

        const result = await supabase
          .from('health_devices')
          .upsert([
            {
              patient_id: selectedPatient.id,
              device_name: device.name,
              device_type: 'ESP32_XIAO_C3',
              mac_address: device.id,
              ble_uuid: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
              firmware_version: '1.0.0',
              hardware_version: '1.0',
              serial_number: `SN-${device.id}`,
              sensors: { max30102: true, mpu6050: true },
              is_active: true,
              is_paired: true,
              connection_status: 'connected',
              battery_level: 85,
              signal_strength: device.rssi,
              updated_at: new Date().toISOString(),
            },
          ], { onConflict: 'mac_address' })
          .select();

        const { data, error: deviceError } = result;

        if (deviceError) {
          console.error('❌ Error saving device:', deviceError);
          console.warn('⚠️ Continuing without database save...');
          // Continue without database save
          databaseId = `local-${device.id}`;
        } else {
          savedDevice = data;
          databaseId = data?.[0]?.id || `local-${device.id}`;
          console.log('✅ Device saved to database:', databaseId);
        }
      } catch (dbError) {
        console.error('❌ Database error:', dbError);
        console.warn('⚠️ Continuing without database save...');
        databaseId = `local-${device.id}`;
      }

      // Log connection event (non-critical)
      if (databaseId) {
        try {
          await supabase
            .from('device_connection_logs')
            .insert([
              {
                device_id: databaseId,
                patient_id: selectedPatient.id,
                caregiver_id: caregiverId,
                event_type: 'connected',
                event_status: 'success',
                connection_duration_seconds: 0,
                battery_level: 85,
                firmware_version: '1.0.0',
              },
            ]);
          console.log('✅ Connection logged');
        } catch (logError) {
          console.warn('⚠️ Could not log connection event:', logError);
        }
      }

      // Update UI with connected device
      setConnectedDevice({
        ...device,
        patientName: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        databaseId: databaseId,
      });

      console.log('✅ Device connected and saved to database');
      Alert.alert(
        'Success',
        `Connected to ${device.name}\nAssigned to: ${selectedPatient.first_name} ${selectedPatient.last_name}`
      );

      // Subscribe to real BLE notifications
      console.log('📡 Subscribing to BLE notifications...');
      const subscription = await bleManagerRef.current.subscribeToNotifications(
        device.id,
        (error, jsonData) => {
          if (error) {
            console.error('❌ Notification error:', error);
            // Handle disconnection
            if (error.message && (error.message.includes('disconnected') || error.errorCode === 201)) {
              console.warn('⚠️ Device disconnected! Resetting state...');
              setConnectedDevice(null);
              setVitals({
                heartRate: '--',
                spo2: '--',
                temperature: '--',
                fallDetected: false,
                sleepStatus: 'Disconnected',
              });
              Alert.alert('Device Disconnected', 'The connection to the device was lost.');
            }
            return;
          }

          if (jsonData) {
            // DEBUG: Uncomment to see raw data flow
            // console.log('📡 Received BLE data:', jsonData);

            // Handle the incoming BLE data
            // Pass current context explicitly to avoid stale closure issues in React
            handleBLEDataReceived(jsonData, selectedPatient, databaseId);
          }
        }
      );

      console.log('✅ Subscribed to notifications');



      setLoading(false);
    } catch (error) {
      console.error('❌ Error connecting to device:', error);
      Alert.alert('Error', `Failed to connect to ${device.name}: ${error.message}`);
      setLoading(false);
    }
  };

  const disconnectDevice = async () => {
    try {
      console.log('🔌 Disconnecting from device...');

      // Disconnect from BLE
      if (connectedDevice?.id) {
        try {
          await bleManagerRef.current.disconnectDevice(connectedDevice.id);
          console.log('✅ BLE disconnected');
        } catch (bleError) {
          console.error('Error disconnecting BLE:', bleError);
        }
      }

      // Log disconnection event
      if (connectedDevice?.databaseId) {
        await bleService.logConnectionEvent(
          connectedDevice.databaseId,
          selectedPatient?.id,
          caregiverId,
          'disconnected',
          'success'
        );

        // Update device status
        await bleService.updateDeviceStatus(connectedDevice.databaseId, 'disconnected');
      }

      setConnectedDevice(null);
      setVitals({
        heartRate: '--',
        spo2: '--',
        temperature: '--',
        fallDetected: false,
        sleepStatus: 'Awake',
      });

      console.log('✅ Device disconnected successfully');
      Alert.alert('Disconnected', 'Device disconnected successfully');
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
      Alert.alert('Error', 'Failed to disconnect device');
    }
  };

  /**
   * Handle incoming BLE data from ESP32
   * This is called when the ESP32 sends JSON data via BLE notification
   */
  const handleBLEDataReceived = async (jsonData, contextPatient = null, contextDeviceId = null) => {
    try {
      // Use context if provided (fixes stale closure), otherwise fallback to state
      const currentPatient = contextPatient || selectedPatient;
      const currentDeviceId = contextDeviceId || connectedDevice?.databaseId;

      // Parse the data first
      let parsedData = jsonData;

      // If it's a string, try to parse it as JSON
      if (typeof jsonData === 'string') {
        try {
          parsedData = JSON.parse(jsonData);
        } catch (parseError) {
          console.warn('Could not parse JSON:', parseError);
          parsedData = jsonData;
        }
      }

      // 1. UPDATE UI (Always do this so user sees data)
      try {
        if (bleService && bleService.parseESP32Data) {
          const uiData = bleService.parseESP32Data(parsedData);
          if (uiData) {
            setVitals({
              heartRate: uiData.heartRate || parsedData.heartRate || '--',
              spo2: uiData.spo2 || parsedData.spo2 || '--',
              temperature: uiData.temperature ? uiData.temperature.toFixed(1) : (parsedData.temperature ? parsedData.temperature.toFixed(1) : '--'),
              stepCount: uiData.stepCount || parsedData.stepCount || 0,
              fallDetected: uiData.fallDetected || parsedData.fall_detected || (parsedData.emergency === 'ACTIVE'),
              sleepStatus: (uiData.isSleeping || parsedData.is_sleeping || parsedData.sleepStatus === 'Sleeping') ? 'Sleeping' : 'Awake',
            });
          }
        } else {
          // Fallback: parse directly from JSON
          setVitals({
            heartRate: parsedData.hr !== undefined ? parsedData.hr : (parsedData.heart_rate || '--'),
            spo2: parsedData.ox !== undefined ? parsedData.ox : (parsedData.spo2 || '--'),
            temperature: (parsedData.tp !== undefined ? parsedData.tp : (parsedData.temperature || 0)).toFixed(1),
            stepCount: parsedData.sc !== undefined ? parsedData.sc : (parsedData.step_count || 0),
            fallDetected: parsedData.em === 1 || parsedData.fall_detected || false,
            sleepStatus: (parsedData.sl === 'S' || parsedData.is_sleeping) ? 'Sleeping' : 'Awake',
          });
        }
      } catch (uiError) {
        console.warn('⚠️ Could not update UI:', uiError);
      }

      // 2. STORE DATA (Only if patient is selected)
      if (!currentPatient || !currentDeviceId) {
        // console.log('Info: Data received but not stored (No patient/device selected)');
        return;
      }

      try {
        if (bleService && bleService.processIncomingData) {
          await bleService.processIncomingData(
            currentPatient.id,
            currentDeviceId,
            parsedData
          );
        }
      } catch (processError) {
        console.warn('⚠️ Could not process data:', processError);
      }

    } catch (error) {
      console.error('❌ Error handling BLE data:', error);
    }
  };

  const startDataSimulation = () => {
    // Subscribe to real vitals updates from Supabase
    if (selectedPatient && connectedDevice?.databaseId) {
      const vitalsSubscription = bleService.subscribeToVitals(
        selectedPatient.id,
        (payload) => {
          if (payload.new) {
            const vital = payload.new;
            setVitals({
              heartRate: vital.heart_rate || '--',
              spo2: vital.spo2 || '--',
              temperature: vital.temperature ? vital.temperature.toFixed(1) : '--',
              fallDetected: false,
              sleepStatus: 'Awake',
            });
          }
        }
      );

      // Also subscribe to alerts to detect falls
      const alertsSubscription = bleService.subscribeToAlerts(
        selectedPatient.id,
        (payload) => {
          if (payload.new) {
            const alert = payload.new;
            if (alert.alert_type === 'fall') {
              setVitals((prev) => ({
                ...prev,
                fallDetected: true,
              }));
              // Auto-reset fall detection after 10 seconds
              setTimeout(() => {
                setVitals((prev) => ({
                  ...prev,
                  fallDetected: false,
                }));
              }, 10000);
            }
          }
        }
      );

      return () => {
        if (vitalsSubscription) vitalsSubscription.unsubscribe();
        if (alertsSubscription) alertsSubscription.unsubscribe();
      };
    }
  };

  const renderDeviceItem = ({ item }) => (
    <Card style={styles.deviceCard}>
      <Card.Content>
        <View style={styles.deviceHeader}>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>{item.name}</Text>
            <Text style={{ fontSize: 12, color: '#666' }}>ID: {item.id}</Text>
            <Text style={styles.deviceType}>{item.type}</Text>
            <Text style={styles.deviceSignal}>Signal: {item.rssi} dBm</Text>
          </View>
          <Ionicons name="bluetooth" size={32} color="#00bcd4" />
        </View>
        <Button
          mode="contained"
          onPress={() => connectToDevice(item)}
          style={styles.connectButton}
          disabled={loading}
        >
          Connect
        </Button>
      </Card.Content>
    </Card>
  );

  const renderVitalCard = (icon, label, value, unit, color) => (
    <View style={[styles.vitalCard, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={28} color={color} />
      <View style={styles.vitalContent}>
        <Text style={styles.vitalLabel}>{label}</Text>
        <Text style={styles.vitalValue}>
          {value} <Text style={styles.vitalUnit}>{unit}</Text>
        </Text>
      </View>
    </View>
  );

  if (loading && !connectedDevice) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00bcd4" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Device Connection</Text>
        <Text style={styles.headerSubtitle}>
          Connect your health monitoring device
        </Text>
      </View>

      {/* Bluetooth Status */}
      <Card style={styles.statusCard}>
        <Card.Content>
          <View style={styles.statusRow}>
            <View style={styles.statusInfo}>
              <Ionicons name="bluetooth" size={24} color="#00bcd4" />
              <Text style={styles.statusText}>Bluetooth Status</Text>
            </View>
            <View style={styles.statusBadge}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: bluetoothEnabled ? '#4caf50' : '#f44336' },
                ]}
              />
              <Text style={styles.statusLabel}>
                {bluetoothEnabled ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>
          <Button
            mode="text"
            onPress={() => {
              if (Platform.OS === 'android') {
                Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
              } else {
                Linking.openSettings();
              }
            }}
            compact
            style={{ marginTop: 5 }}
          >
            Open Phone Bluetooth Settings
          </Button>
        </Card.Content>
      </Card>

      {/* Patient Selection */}
      <Card style={styles.patientCard}>
        <Card.Content>
          <View style={styles.patientHeader}>
            <Ionicons name="person" size={24} color="#9c27b0" />
            <Text style={styles.patientLabel}>Select Patient</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.patientSelector,
              { borderColor: selectedPatient ? '#4caf50' : '#ccc' },
            ]}
            onPress={() => setShowPatientModal(true)}
          >
            <Text style={styles.patientSelectorText}>
              {selectedPatient
                ? `${selectedPatient.first_name} ${selectedPatient.last_name}`
                : 'Tap to select a patient'}
            </Text>
            <Ionicons
              name={selectedPatient ? 'checkmark-circle' : 'chevron-down'}
              size={20}
              color={selectedPatient ? '#4caf50' : '#999'}
            />
          </TouchableOpacity>
        </Card.Content>
      </Card>

      {/* Patient Selection Modal */}
      <Modal
        visible={showPatientModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPatientModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Patient</Text>
              <TouchableOpacity onPress={() => setShowPatientModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={patients}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.patientItem,
                    selectedPatient?.id === item.id && styles.patientItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedPatient(item);
                    setShowPatientModal(false);
                  }}
                >
                  <View style={styles.patientItemContent}>
                    <Text style={styles.patientItemName}>
                      {item.first_name} {item.last_name}
                    </Text>
                  </View>
                  {selectedPatient?.id === item.id && (
                    <Ionicons name="checkmark" size={24} color="#4caf50" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Connected Device Info */}
      {connectedDevice ? (
        <>
          <Card style={styles.connectedCard}>
            <Card.Content>
              <View style={styles.connectedHeader}>
                <View>
                  <Text style={styles.connectedTitle}>Connected Device</Text>
                  <Text style={styles.connectedName}>{connectedDevice.name}</Text>
                  {connectedDevice.patientName && (
                    <Text style={styles.connectedPatient}>
                      Patient: {connectedDevice.patientName}
                    </Text>
                  )}
                </View>
                <View style={styles.connectedBadge}>
                  <Ionicons name="checkmark-circle" size={32} color="#4caf50" />
                </View>
              </View>
              <Divider style={styles.divider} />
              <Button
                mode="outlined"
                onPress={disconnectDevice}
                style={styles.disconnectButton}
                textColor="#f44336"
              >
                Disconnect
              </Button>
            </Card.Content>
          </Card>

          {/* Real-time Vitals */}
          <View style={styles.vitalsSection}>
            <Text style={styles.sectionTitle}>Real-time Vitals</Text>

            {renderVitalCard(
              'heart',
              'Heart Rate',
              vitals.heartRate,
              'BPM',
              '#f44336'
            )}

            {renderVitalCard(
              'water',
              'SpO2 Level',
              vitals.spo2,
              '%',
              '#2196f3'
            )}

            {renderVitalCard(
              'thermometer',
              'Temperature',
              vitals.temperature,
              '°C',
              '#ff9800'
            )}

            {renderVitalCard(
              'walk',
              'Steps',
              vitals.stepCount,
              'steps',
              '#4caf50'
            )}

            {/* Fall Detection Alert */}
            {vitals.fallDetected && (
              <View style={styles.alertCard}>
                <Ionicons name="alert-circle" size={28} color="#f44336" />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Fall Detected!</Text>
                  <Text style={styles.alertMessage}>
                    Immediate assistance may be needed
                  </Text>
                </View>
              </View>
            )}

            {/* Sleep Status */}
            <View style={styles.sleepCard}>
              <Ionicons
                name={vitals.sleepStatus === 'Sleeping' ? 'moon' : 'sunny'}
                size={28}
                color={vitals.sleepStatus === 'Sleeping' ? '#9c27b0' : '#ffc107'}
              />
              <View style={styles.sleepContent}>
                <Text style={styles.sleepLabel}>Sleep Status</Text>
                <Text style={styles.sleepValue}>{vitals.sleepStatus}</Text>
              </View>
            </View>
          </View>
        </>
      ) : (
        <>
          {/* Scan Button */}
          <Button
            mode="contained"
            onPress={startScanning}
            loading={scanning}
            disabled={scanning}
            style={styles.scanButton}
          >
            {scanning ? 'Scanning...' : 'Scan for Devices'}
          </Button>

          <Button
            mode="text"
            onPress={checkConnectedDevices}
            style={{ marginTop: 10 }}
          >
            Check Paired/Connected Devices
          </Button>

          <Button
            mode="text"
            onPress={() => {
              if (Platform.OS === 'android') {
                const intent = 'android.settings.BLUETOOTH_SETTINGS';
                Linking.sendIntent(intent).catch(() => {
                  Linking.openSettings();
                });
              } else {
                Linking.openSettings();
              }
            }}
            style={{ marginTop: 5 }}
            textColor="#666"
          >
            Open Phone Bluetooth Settings
          </Button>

          {/* Available Devices */}
          {devices.length > 0 && (
            <View style={styles.devicesSection}>
              <Text style={styles.sectionTitle}>Available Devices</Text>
              <FlatList
                data={devices}
                renderItem={renderDeviceItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Empty State */}
          {!scanning && devices.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="bluetooth" size={64} color="#ccc" />
              <Text style={styles.emptyStateText}>
                No devices found
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Tap "Scan for Devices" to search for nearby health monitors
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: '#00bcd4',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  statusCard: {
    margin: 15,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  patientCard: {
    margin: 15,
    elevation: 3,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  patientLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  patientSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  patientSelectorText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  patientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  patientItemSelected: {
    backgroundColor: '#f0f7ff',
  },
  patientItemContent: {
    flex: 1,
  },
  patientItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  scanButton: {
    margin: 15,
    paddingVertical: 8,
    backgroundColor: '#00bcd4',
  },
  devicesSection: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  deviceCard: {
    marginBottom: 12,
    elevation: 2,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  deviceType: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  deviceSignal: {
    fontSize: 12,
    color: '#999',
  },
  connectButton: {
    backgroundColor: '#00bcd4',
  },
  connectedCard: {
    margin: 15,
    backgroundColor: '#e0f7fa',
    elevation: 3,
  },
  connectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectedTitle: {
    fontSize: 12,
    color: '#00838f',
    fontWeight: '600',
  },
  connectedName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00bcd4',
    marginTop: 4,
  },
  connectedPatient: {
    fontSize: 12,
    color: '#00838f',
    marginTop: 6,
    fontWeight: '500',
  },
  connectedBadge: {
    padding: 8,
  },
  divider: {
    marginVertical: 12,
  },
  disconnectButton: {
    borderColor: '#f44336',
  },
  vitalsSection: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  vitalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    elevation: 2,
  },
  vitalContent: {
    marginLeft: 15,
    flex: 1,
  },
  vitalLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  vitalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  vitalUnit: {
    fontSize: 14,
    color: '#999',
    fontWeight: 'normal',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
    elevation: 3,
  },
  alertContent: {
    marginLeft: 15,
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f44336',
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 13,
    color: '#d32f2f',
  },
  sleepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3e5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#9c27b0',
    elevation: 2,
  },
  sleepContent: {
    marginLeft: 15,
    flex: 1,
  },
  sleepLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  sleepValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#9c27b0',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default DeviceConnectionScreen;
