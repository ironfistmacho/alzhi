import { supabase } from './supabase';

/**
 * BLE Service - Handles real Bluetooth Low Energy communication with ESP32
 * Parses JSON data from ESP32 health monitor and stores in Supabase
 */
class BLEService {
  constructor() {
    this.connectedDevice = null;
    this.dataSubscription = null;
    this.vitalsBuffer = [];
    this.alertsBuffer = [];
    this.isProcessing = false;
    this.lastVitalStoreTime = {}; // Map of deviceId -> timestamp
    this.lastAlertTime = {}; // Map of deviceId_alertType -> timestamp
    this.lastSleepStoreTime = {}; // Map of deviceId -> timestamp
  }

  /**
   * Parse JSON data from ESP32
   * Expected format from ESP32:
   * {
   *   "device_id": "ALZ_MONITOR_01",
   *   "heart_rate": 72,
   *   "spo2": 98,
   *   "temperature": 36.5,
   *   "finger_present": true,
   *   "ir_value": 50000,
   *   "acceleration": {"x": 0.1, "y": 0.2, "z": 9.8, "magnitude": 9.8},
   *   "gyroscope": {"x": 0.01, "y": 0.02, "z": 0.03, "magnitude": 0.04},
   *   "fall_detected": false,
   *   "is_sleeping": false,
   *   "sleep_quality": 0,
   *   "movement_count": 2,
   *   "battery": 3.7,
   *   "timestamp": 123456789
   * }
   */
  parseESP32Data(input) {
    try {
      let rawInput = input;
      // Sanitize input: replace 'nan' (case insensitive) with '0' to prevent JSON.parse errors
      if (typeof rawInput === 'string') {
        rawInput = rawInput.replace(/:\s*nan/gi, ':0');
      }

      const data = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;

      // Helper to parse float safely
      const pFloat = (val) => parseFloat(val) || 0;
      const pInt = (val) => parseInt(val, 10) || 0;
      const pBool = (val) => {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val === 1;
        return String(val).toLowerCase() === 'true' || val === '1';
      };

      // Support both old long keys and new compact keys
      return {
        heartRate: pInt(data.hr !== undefined ? data.hr : data.heartRate),
        spo2: pInt(data.ox !== undefined ? data.ox : data.spo2),
        temperature: pFloat(data.tp !== undefined ? data.tp : data.temperature),
        fingerPresent: pBool(data.fd !== undefined ? data.fd : data.fingerDetected),
        signalQuality: pFloat(data.sq !== undefined ? data.sq : data.signalQuality),

        acceleration: {
          x: pFloat(data.ax !== undefined ? data.ax : data.accelX),
          y: pFloat(data.ay !== undefined ? data.ay : data.accelY),
          z: pFloat(data.az !== undefined ? data.az : data.accelZ),
          magnitude: Math.sqrt(
            Math.pow(pFloat(data.ax !== undefined ? data.ax : data.accelX), 2) +
            Math.pow(pFloat(data.ay !== undefined ? data.ay : data.accelY), 2) +
            Math.pow(pFloat(data.az !== undefined ? data.az : data.accelZ), 2)
          )
        },

        fallDetected: data.em === 1 || data.emergency === 'ACTIVE',
        isSleeping: data.sl === 'S' || data.sleepStatus === 'Sleeping',
        sleepQuality: pInt(data.ss !== undefined ? data.ss : data.sleepScore),
        stepCount: pInt(data.sc !== undefined ? data.sc : data.stepCount),
        timestamp: Date.now(),
        rawData: data,
      };
    } catch (error) {
      console.error('Error parsing ESP32 data:', error);
      return null;
    }
  }

  /**
   * Store vitals in Supabase
   */
  async storeVitals(patientId, deviceId, parsedData) {
    try {
      if (!patientId || !deviceId) {
        console.error('Missing patientId or deviceId');
        return null;
      }

      // Skip if deviceId is not a real UUID (e.g. local mock)
      if (String(deviceId).startsWith('local-')) {
        return null;
      }

      // Throttle storage to every 10 seconds per device to prevent DB spam
      const now = Date.now();
      const lastTime = this.lastVitalStoreTime[deviceId] || 0;
      if (now - lastTime < 10000) {
        return null;
      }

      // Only store if we have valid vital signs
      if (!parsedData.fingerPresent) {
        return null;
      }

      const { data, error } = await supabase
        .from('patient_vitals')
        .insert([
          {
            patient_id: patientId,
            // device_id: deviceId, // Schema mismatch: column missing
            heart_rate: parsedData.heartRate,
            spo2: parsedData.spo2,
            temperature: parsedData.temperature,
            systolic_bp: null,
            diastolic_bp: null,
            respiratory_rate: null,
            // blood_glucose: null, // Schema mismatch: column missing
            notes: `Device: ${deviceId} | Signal Quality: ${parsedData.signalQuality}%`,
            data_source: 'device',
            created_at: new Date(parsedData.timestamp).toISOString(),
          },
        ])
        .select();

      if (error) {
        console.error('Error storing vitals:', error);
        return null;
      }

      this.lastVitalStoreTime[deviceId] = now;
      return data?.[0] || null;
    } catch (error) {
      console.error('Error in storeVitals:', error);
      return null;
    }
  }

  /**
   * Store fall detection event
   */
  async storeFallEvent(patientId, deviceId, parsedData) {
    try {
      if (!patientId || !deviceId || !parsedData.fallDetected) {
        return null;
      }

      const { data, error } = await supabase
        .from('fall_events')
        .insert([
          {
            patient_id: patientId,
            // device_id: deviceId, // Schema mismatch
            location_id: null, // explicit null
            // acceleration_magnitude: parsedData.acceleration?.magnitude || 0, // Schema check: only standard columns?
            // gyro_magnitude: parsedData.gyroscope?.magnitude || 0, // Schema check: only standard columns? 
            // WAIT: Schema has confidence_score, impact_force, response_time...
            // Let's stick to valid columns from SCHEMA Line 297
            confidence_score: 95.0,
            impact_force: parsedData.acceleration?.magnitude || 0,
            notes: `Device: ${deviceId} | Accel: ${parsedData.acceleration?.magnitude?.toFixed(2)}g`,
            created_at: new Date(parsedData.timestamp).toISOString(),
          },
        ])
        .select();

      if (error) {
        console.error('Error storing fall event:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('Error in storeFallEvent:', error);
      return null;
    }
  }

  /**
   * Store sleep data
   */
  async storeSleepData(patientId, deviceId, parsedData) {
    try {
      if (!patientId || !deviceId) {
        return null;
      }

      // Throttle sleep data storage to every 5 minutes
      const now = Date.now();
      const lastTime = this.lastSleepStoreTime[deviceId] || 0;
      if (now - lastTime < 300000) { // 5 minutes
        return null;
      }

      const sleepDate = new Date(parsedData.timestamp);
      sleepDate.setHours(0, 0, 0, 0);

      // Optimistically update timestamp to prevent spam loops on error
      this.lastSleepStoreTime[deviceId] = now;

      const { data, error } = await supabase
        .from('sleep_data')
        .upsert([
          {
            patient_id: patientId,
            // device_id: deviceId, // Schema mismatch
            sleep_date: sleepDate.toISOString().split('T')[0],
            // is_sleeping: parsedData.isSleeping, 
            sleep_quality: parsedData.sleepQuality > 80 ? 'good' : 'fair',
            notes: `Device: ${deviceId} | Sleep Score: ${parsedData.sleepQuality} | Status: ${parsedData.isSleeping ? 'Sleeping' : 'Awake'}`,
            created_at: new Date(parsedData.timestamp).toISOString(),
          },
        ], { onConflict: 'patient_id, sleep_date' })
        .select();

      if (error) {
        console.error('Error storing sleep data:', error);
        return null;
      }

      this.lastSleepStoreTime[deviceId] = now;

      return data?.[0] || null;
    } catch (error) {
      console.error('Error in storeSleepData:', error);
      return null;
    }
  }

  /**
   * Create alert for critical vitals or fall detection
   */
  async createAlert(patientId, deviceId, parsedData, alertType) {
    try {
      if (!patientId || !deviceId) {
        return null;
      }

      let title = '';
      let message = '';
      let priority = 'medium';

      if (alertType === 'fall') {
        title = '⚠️ Fall Detected!';
        message = `Patient may have fallen. Acceleration: ${parsedData.acceleration?.magnitude?.toFixed(2)}g`;
        priority = 'critical';
      } else if (alertType === 'low_heart_rate') {
        title = '⚠️ Low Heart Rate';
        message = `Heart rate is ${parsedData.heartRate} BPM (below 50)`;
        priority = 'high';
      } else if (alertType === 'high_heart_rate') {
        title = '⚠️ High Heart Rate';
        message = `Heart rate is ${parsedData.heartRate} BPM (above 100)`;
        priority = 'high';
      } else if (alertType === 'low_spo2') {
        title = '⚠️ Low Oxygen Level';
        message = `SpO2 is ${parsedData.spo2}% (below 90%)`;
        priority = 'critical';
      } else if (alertType === 'high_temperature') {
        title = '⚠️ High Temperature';
        message = `Temperature is ${parsedData.temperature}°C (above 38°C)`;
        priority = 'high';
      } else if (alertType === 'low_temperature') {
        title = '⚠️ Low Temperature';
        message = `Temperature is ${parsedData.temperature}°C (below 36°C)`;
        priority = 'high';
      }

      if (!title) return null;

      const { data, error } = await supabase
        .from('patient_alerts')
        .insert([
          {
            patient_id: patientId,
            // device_id: deviceId, // Schema mismatch
            alert_type: alertType,
            title,
            message,
            priority,
            is_read: false,
            is_acknowledged: false,
            metadata: { device_id: deviceId }, // Store device ID here
            created_at: new Date(parsedData.timestamp).toISOString(),
          },
        ])
        .select();

      if (error) {
        console.error('Error creating alert:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('Error in createAlert:', error);
      return null;
    }
  }

  /**
   * Check vitals and create alerts if needed
   */
  async checkVitalsAndCreateAlerts(patientId, deviceId, parsedData) {
    try {
      const alerts = [];
      const now = Date.now();

      // Helper to check throttle
      const shouldAlert = (type) => {
        const key = `${deviceId}_${type}`;
        const last = this.lastAlertTime[key] || 0;
        if (now - last > 60000) { // 1 minute throttle
          this.lastAlertTime[key] = now;
          return true;
        }
        return false;
      };

      // Check heart rate
      if (parsedData.heartRate) {
        if (parsedData.heartRate < 50 && shouldAlert('low_heart_rate')) {
          const alert = await this.createAlert(patientId, deviceId, parsedData, 'low_heart_rate');
          if (alert) alerts.push(alert);
        } else if (parsedData.heartRate > 100 && shouldAlert('high_heart_rate')) {
          const alert = await this.createAlert(patientId, deviceId, parsedData, 'high_heart_rate');
          if (alert) alerts.push(alert);
        }
      }

      // Check SpO2
      if (parsedData.spo2) {
        if (parsedData.spo2 < 90 && shouldAlert('low_spo2')) {
          const alert = await this.createAlert(patientId, deviceId, parsedData, 'low_spo2');
          if (alert) alerts.push(alert);
        }
      }

      // Check temperature
      if (parsedData.temperature) {
        if (parsedData.temperature > 38 && shouldAlert('high_temperature')) {
          const alert = await this.createAlert(patientId, deviceId, parsedData, 'high_temperature');
          if (alert) alerts.push(alert);
        } else if (parsedData.temperature < 36 && shouldAlert('low_temperature')) {
          const alert = await this.createAlert(patientId, deviceId, parsedData, 'low_temperature');
          if (alert) alerts.push(alert);
        }
      }

      // Check fall detection
      if (parsedData.fallDetected) {
        const alert = await this.createAlert(patientId, deviceId, parsedData, 'fall');
        if (alert) alerts.push(alert);
      }

      return alerts;
    } catch (error) {
      console.error('Error checking vitals:', error);
      return [];
    }
  }

  /**
   * Process incoming BLE data from ESP32
   */
  async processIncomingData(patientId, deviceId, jsonData) {
    if (this.isProcessing) {
      console.log('Already processing data, buffering...');
      this.vitalsBuffer.push({ patientId, deviceId, jsonData });
      return;
    }

    this.isProcessing = true;

    try {
      const parsedData = this.parseESP32Data(jsonData);
      if (!parsedData) {
        this.isProcessing = false;
        return;
      }

      // Store vitals
      const vitalRecord = await this.storeVitals(patientId, deviceId, parsedData);

      // Check vitals and create alerts
      const alerts = await this.checkVitalsAndCreateAlerts(patientId, deviceId, parsedData);

      // Store fall event if detected
      if (parsedData.fallDetected) {
        await this.storeFallEvent(patientId, deviceId, parsedData);
      }

      // Store sleep data periodically
      await this.storeSleepData(patientId, deviceId, parsedData);

      console.log('Data processed successfully:', {
        vitals: vitalRecord?.id,
        alerts: alerts.length,
        fall: parsedData.fallDetected,
      });

      // Process buffered data if any
      if (this.vitalsBuffer.length > 0) {
        const buffered = this.vitalsBuffer.shift();
        this.isProcessing = false;
        return this.processIncomingData(buffered.patientId, buffered.deviceId, buffered.jsonData);
      }
    } catch (error) {
      console.error('Error processing incoming data:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Update device connection status
   */
  async updateDeviceStatus(deviceId, status, batteryLevel = null) {
    try {
      const updateData = {
        connection_status: status,
        last_connected_at: new Date().toISOString(),
      };

      if (batteryLevel !== null) {
        updateData.battery_level = batteryLevel;
      }

      const { error } = await supabase
        .from('health_devices')
        .update(updateData)
        .eq('id', deviceId);

      if (error) {
        console.error('Error updating device status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateDeviceStatus:', error);
      return false;
    }
  }

  /**
   * Log device connection event
   */
  async logConnectionEvent(deviceId, patientId, caregiverId, eventType, status) {
    try {
      const { error } = await supabase
        .from('device_connection_logs')
        .insert([
          {
            device_id: deviceId,
            patient_id: patientId,
            caregiver_id: caregiverId,
            event_type: eventType,
            event_status: status,
            timestamp: new Date().toISOString(),
          },
        ]);

      if (error) {
        console.error('Error logging connection event:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in logConnectionEvent:', error);
      return false;
    }
  }

  /**
   * Get device by MAC address
   */
  async getDeviceByMacAddress(macAddress) {
    try {
      const { data, error } = await supabase
        .from('health_devices')
        .select('*')
        .eq('mac_address', macAddress)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching device:', error);
        return null;
      }

      return data || null;
    } catch (error) {
      console.error('Error in getDeviceByMacAddress:', error);
      return null;
    }
  }

  /**
   * Subscribe to real-time vitals updates
   */
  subscribeToVitals(patientId, callback) {
    try {
      const subscription = supabase
        .from(`patient_vitals:patient_id=eq.${patientId}`)
        .on('*', (payload) => {
          console.log('Vitals update:', payload);
          callback(payload);
        })
        .subscribe();

      return subscription;
    } catch (error) {
      console.error('Error subscribing to vitals:', error);
      return null;
    }
  }

  /**
   * Subscribe to real-time alerts
   */
  subscribeToAlerts(patientId, callback) {
    try {
      const subscription = supabase
        .from(`patient_alerts:patient_id=eq.${patientId}`)
        .on('*', (payload) => {
          console.log('Alert update:', payload);
          callback(payload);
        })
        .subscribe();

      return subscription;
    } catch (error) {
      console.error('Error subscribing to alerts:', error);
      return null;
    }
  }

  /**
   * Cleanup subscriptions
   */
  unsubscribeAll() {
    try {
      if (this.dataSubscription) {
        this.dataSubscription.unsubscribe();
        this.dataSubscription = null;
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
    }
  }
}

export default new BLEService();
