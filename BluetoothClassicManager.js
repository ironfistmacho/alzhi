import { NativeModules, NativeEventEmitter } from 'react-native';

// Bluetooth Classic Manager - Alternative to ble-plx
// Works better with classic Bluetooth devices like ESP32
class BluetoothClassicManager {
  constructor() {
    try {
      // Import the native Bluetooth Classic module
      this.RNBluetoothClassic = NativeModules.RNBluetoothClassic;
      this.eventEmitter = new NativeEventEmitter(this.RNBluetoothClassic);
    } catch (error) {
      console.warn('Bluetooth Classic module not available:', error.message);
      this.RNBluetoothClassic = null;
    }

    this.isScanning = false;
    this.bluetoothEnabled = false;
    this.listeners = [];
    this.discoveredDevices = new Map();
    this.connectedDevices = new Map();
    this.currentDevice = null;
    this.readListener = null;

    console.log('BluetoothClassicManager initialized');
    this.initializeBluetoothState();
  }

  async initializeBluetoothState() {
    try {
      if (!this.RNBluetoothClassic) {
        console.warn('Bluetooth Classic not available');
        return;
      }

      const isEnabled = await this.RNBluetoothClassic.isBluetoothEnabled();
      this.bluetoothEnabled = isEnabled;
      console.log('Bluetooth enabled:', isEnabled);
    } catch (error) {
      console.error('Error initializing Bluetooth state:', error);
    }
  }

  async state() {
    try {
      if (!this.RNBluetoothClassic) {
        return 'PoweredOff';
      }

      const isEnabled = await this.RNBluetoothClassic.isBluetoothEnabled();
      this.bluetoothEnabled = isEnabled;
      const state = isEnabled ? 'PoweredOn' : 'PoweredOff';
      console.log('Current Bluetooth state:', state);
      return state;
    } catch (error) {
      console.error('Error getting Bluetooth state:', error);
      return 'PoweredOff';
    }
  }

  onStateChange(callback, emitCurrentState = false) {
    this.listeners.push(callback);

    try {
      if (this.RNBluetoothClassic && this.eventEmitter) {
        // Listen for Bluetooth state changes
        this.eventEmitter.addListener('BluetoothStateChanged', (state) => {
          console.log('Bluetooth state changed:', state);
          this.bluetoothEnabled = state === 'ON';
          this.listeners.forEach(cb => cb(state === 'ON' ? 'PoweredOn' : 'PoweredOff'));
        });
      }
    } catch (error) {
      console.error('Error setting up state listener:', error);
    }

    if (emitCurrentState) {
      callback(this.bluetoothEnabled ? 'PoweredOn' : 'PoweredOff');
    }

    return {
      remove: () => {
        this.listeners = this.listeners.filter(l => l !== callback);
      },
    };
  }

  async startDeviceScan(serviceUUIDs, scanOptions, callback) {
    try {
      if (!this.RNBluetoothClassic) {
        console.warn('Bluetooth Classic not available');
        callback(new Error('Bluetooth Classic not available'), null);
        return;
      }

      this.isScanning = true;
      this.discoveredDevices.clear();

      console.log('Starting Bluetooth device discovery...');

      // Check if Bluetooth is enabled
      const isEnabled = await this.RNBluetoothClassic.isBluetoothEnabled();
      if (!isEnabled) {
        console.warn('Bluetooth is not enabled');
        callback(new Error('Bluetooth is not enabled'), null);
        return;
      }

      // Get paired devices first
      const pairedDevices = await this.RNBluetoothClassic.getPairedDevices();
      console.log('Paired devices:', pairedDevices.length);

      pairedDevices.forEach(device => {
        if (!this.discoveredDevices.has(device.id)) {
          const deviceObj = {
            id: device.id,
            name: device.name || `Unknown (${device.id.substring(0, 8)})`,
            address: device.address,
            rssi: -50, // Default RSSI for paired devices
            type: 'Paired Bluetooth Device',
            raw: device,
          };
          this.discoveredDevices.set(device.id, deviceObj);
          console.log('Paired device found:', deviceObj.name);
          callback(null, deviceObj);
        }
      });

      // Start discovery for new devices
      const discoveryDevices = await this.RNBluetoothClassic.startDiscovery();
      console.log('Discovery devices:', discoveryDevices.length);

      discoveryDevices.forEach(device => {
        if (!this.discoveredDevices.has(device.id)) {
          const deviceObj = {
            id: device.id,
            name: device.name || `Unknown (${device.id.substring(0, 8)})`,
            address: device.address,
            rssi: device.rssi || -70,
            type: 'Bluetooth Device',
            raw: device,
          };
          this.discoveredDevices.set(device.id, deviceObj);
          console.log('New device found:', deviceObj.name);
          callback(null, deviceObj);
        }
      });

      // Listen for new devices during discovery
      if (this.eventEmitter) {
        this.eventEmitter.addListener('DeviceFound', (device) => {
          if (!this.discoveredDevices.has(device.id)) {
            const deviceObj = {
              id: device.id,
              name: device.name || `Unknown (${device.id.substring(0, 8)})`,
              address: device.address,
              rssi: device.rssi || -70,
              type: 'Bluetooth Device',
              raw: device,
            };
            this.discoveredDevices.set(device.id, deviceObj);
            console.log('Device discovered:', deviceObj.name);
            callback(null, deviceObj);
          }
        });
      }
    } catch (error) {
      console.error('Error starting device scan:', error);
      callback(error, null);
    }
  }

  async stopDeviceScan() {
    try {
      this.isScanning = false;

      if (this.RNBluetoothClassic) {
        await this.RNBluetoothClassic.cancelDiscovery();
        console.log('Bluetooth discovery stopped');
      }
    } catch (error) {
      console.error('Error stopping device scan:', error);
    }
  }

  async connectToDevice(deviceId) {
    try {
      if (!this.RNBluetoothClassic) {
        throw new Error('Bluetooth Classic not available');
      }

      console.log('Connecting to device:', deviceId);

      const device = this.discoveredDevices.get(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      // Connect to the device
      const connectedDevice = await this.RNBluetoothClassic.connectToDevice(device.address);
      console.log('Device connected:', connectedDevice.name);

      // Store connected device
      this.connectedDevices.set(deviceId, {
        id: deviceId,
        name: connectedDevice.name,
        address: connectedDevice.address,
        device: connectedDevice,
      });

      this.currentDevice = connectedDevice;

      // Set up read listener
      if (this.eventEmitter && !this.readListener) {
        this.readListener = this.eventEmitter.addListener('BluetoothDataReceived', (data) => {
          console.log('Data received:', data);
        });
      }

      return true;
    } catch (error) {
      console.error('Error connecting to device:', error);
      throw error;
    }
  }

  async disconnectDevice(deviceId) {
    try {
      if (!this.RNBluetoothClassic) {
        throw new Error('Bluetooth Classic not available');
      }

      console.log('Disconnecting device:', deviceId);

      const connectedDevice = this.connectedDevices.get(deviceId);
      if (connectedDevice && connectedDevice.address) {
        await this.RNBluetoothClassic.disconnectFromDevice(connectedDevice.address);
        console.log('Device disconnected:', connectedDevice.name);
      }

      this.connectedDevices.delete(deviceId);
      if (this.currentDevice?.address === connectedDevice?.address) {
        this.currentDevice = null;
      }

      return true;
    } catch (error) {
      console.error('Error disconnecting device:', error);
      throw error;
    }
  }

  async readData(deviceId) {
    try {
      if (!this.RNBluetoothClassic) {
        throw new Error('Bluetooth Classic not available');
      }

      const connectedDevice = this.connectedDevices.get(deviceId);
      if (!connectedDevice) {
        throw new Error('Device not connected');
      }

      const data = await this.RNBluetoothClassic.readFromDevice(connectedDevice.address);
      console.log('Data read:', data);
      return data;
    } catch (error) {
      console.error('Error reading data:', error);
      throw error;
    }
  }

  async writeData(deviceId, data) {
    try {
      if (!this.RNBluetoothClassic) {
        throw new Error('Bluetooth Classic not available');
      }

      const connectedDevice = this.connectedDevices.get(deviceId);
      if (!connectedDevice) {
        throw new Error('Device not connected');
      }

      await this.RNBluetoothClassic.writeToDevice(connectedDevice.address, data);
      console.log('Data written:', data);
      return true;
    } catch (error) {
      console.error('Error writing data:', error);
      throw error;
    }
  }

  async enableBluetooth() {
    try {
      if (!this.RNBluetoothClassic) {
        throw new Error('Bluetooth Classic not available');
      }

      await this.RNBluetoothClassic.enableBluetooth();
      this.bluetoothEnabled = true;
      console.log('Bluetooth enabled');
      return true;
    } catch (error) {
      console.error('Error enabling Bluetooth:', error);
      throw error;
    }
  }

  async disableBluetooth() {
    try {
      if (!this.RNBluetoothClassic) {
        throw new Error('Bluetooth Classic not available');
      }

      await this.RNBluetoothClassic.disableBluetooth();
      this.bluetoothEnabled = false;
      console.log('Bluetooth disabled');
      return true;
    } catch (error) {
      console.error('Error disabling Bluetooth:', error);
      throw error;
    }
  }

  getConnectedDevices() {
    return Array.from(this.connectedDevices.values()).map(d => ({
      id: d.id,
      name: d.name,
      address: d.address,
    }));
  }

  cleanup() {
    try {
      if (this.readListener) {
        this.readListener.remove();
        this.readListener = null;
      }
      // Disconnect all devices
      this.connectedDevices.forEach((device) => {
        if (device.address && this.RNBluetoothClassic) {
          this.RNBluetoothClassic.disconnectFromDevice(device.address).catch(err =>
            console.log('Cleanup error:', err)
          );
        }
      });
    } catch (error) {
      console.log('Cleanup error:', error);
    }
  }
}

export default BluetoothClassicManager;
