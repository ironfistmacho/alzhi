-- ============================================================================
-- DEVICE CONNECTION & HEALTH MONITORING SCHEMA
-- For ESP32 Health Monitor with MAX30102 & MPU6050 Sensors
-- ============================================================================

-- ============================================================================
-- HEALTH MONITORING DEVICES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS health_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  device_name VARCHAR(255) NOT NULL, -- e.g., "HealthMonitor-001"
  device_type VARCHAR(100) NOT NULL, -- "ESP32_XIAO_C3", "wearable", "smartwatch"
  device_model VARCHAR(100), -- e.g., "ESP32 XIAO C3"
  mac_address VARCHAR(17) UNIQUE, -- Bluetooth MAC address (AA:BB:CC:DD:EE:FF)
  ble_uuid VARCHAR(36), -- BLE Service UUID
  firmware_version VARCHAR(50),
  hardware_version VARCHAR(50),
  serial_number VARCHAR(100) UNIQUE,
  
  -- Sensor Information
  sensors JSONB DEFAULT '{"max30102": true, "mpu6050": true}', -- Installed sensors
  
  -- Connection Status
  is_active BOOLEAN DEFAULT TRUE,
  is_paired BOOLEAN DEFAULT FALSE,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  last_disconnected_at TIMESTAMP WITH TIME ZONE,
  connection_status VARCHAR(50) DEFAULT 'disconnected', -- connected, disconnected, pairing, error
  
  -- Battery & Power
  battery_level INTEGER, -- 0-100%
  battery_last_updated TIMESTAMP WITH TIME ZONE,
  charging_status VARCHAR(50), -- charging, discharging, full
  
  -- Location & Signal
  signal_strength INTEGER, -- RSSI value (dBm)
  last_signal_update TIMESTAMP WITH TIME ZONE,
  
  -- Configuration
  fall_detection_enabled BOOLEAN DEFAULT TRUE,
  fall_threshold DECIMAL(5, 2) DEFAULT 2.5, -- g (acceleration)
  fall_duration_ms INTEGER DEFAULT 100, -- milliseconds
  
  sleep_detection_enabled BOOLEAN DEFAULT TRUE,
  sleep_threshold DECIMAL(5, 2) DEFAULT 0.3, -- g (acceleration)
  sleep_duration_ms INTEGER DEFAULT 300000, -- 5 minutes
  
  heart_rate_enabled BOOLEAN DEFAULT TRUE,
  spo2_enabled BOOLEAN DEFAULT TRUE,
  temperature_enabled BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  notes TEXT,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- REAL-TIME SENSOR DATA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES health_devices(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  
  -- Heart Rate Data (MAX30102)
  heart_rate INTEGER, -- BPM (beats per minute)
  heart_rate_confidence DECIMAL(5, 2), -- 0-100%
  
  -- SpO2 Data (MAX30102)
  spo2 DECIMAL(5, 2), -- Percentage (%)
  spo2_confidence DECIMAL(5, 2), -- 0-100%
  
  -- Temperature Data
  temperature DECIMAL(5, 2), -- Celsius
  
  -- Acceleration Data (MPU6050)
  accel_x DECIMAL(8, 4), -- g (acceleration due to gravity)
  accel_y DECIMAL(8, 4),
  accel_z DECIMAL(8, 4),
  accel_magnitude DECIMAL(8, 4), -- sqrt(x² + y² + z²)
  
  -- Gyroscope Data (MPU6050)
  gyro_x DECIMAL(8, 4), -- degrees per second
  gyro_y DECIMAL(8, 4),
  gyro_z DECIMAL(8, 4),
  
  -- Signal Quality
  signal_quality VARCHAR(50), -- excellent, good, fair, poor
  data_valid BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamp (from device)
  device_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- FALL DETECTION EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fall_detection_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES health_devices(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  
  -- Fall Detection Details
  fall_detected BOOLEAN DEFAULT TRUE,
  confidence_score DECIMAL(5, 2), -- 0-100%
  acceleration_magnitude DECIMAL(8, 4), -- g
  impact_force DECIMAL(8, 4), -- g
  duration_ms INTEGER, -- milliseconds of sustained acceleration
  
  -- Location (if available)
  location_id UUID REFERENCES patient_locations(id) ON DELETE SET NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Response
  alert_sent BOOLEAN DEFAULT FALSE,
  alert_sent_at TIMESTAMP WITH TIME ZONE,
  caregiver_notified BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMP WITH TIME ZONE,
  emergency_services_called BOOLEAN DEFAULT FALSE,
  
  -- Resolution
  is_false_alarm BOOLEAN DEFAULT FALSE,
  false_alarm_confirmed_at TIMESTAMP WITH TIME ZONE,
  false_alarm_confirmed_by UUID REFERENCES caregivers(id) ON DELETE SET NULL,
  
  -- Notes
  notes TEXT,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SLEEP MONITORING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sleep_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES health_devices(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  
  -- Sleep Session Details
  sleep_start TIMESTAMP WITH TIME ZONE NOT NULL,
  sleep_end TIMESTAMP WITH TIME ZONE,
  total_sleep_duration_minutes INTEGER,
  
  -- Sleep Quality Metrics
  sleep_quality VARCHAR(50), -- poor, fair, good, excellent
  movement_score DECIMAL(5, 2), -- 0-100 (lower = more restful)
  restlessness_count INTEGER, -- Number of movements
  
  -- Sleep Stages (if available)
  light_sleep_minutes INTEGER,
  deep_sleep_minutes INTEGER,
  rem_sleep_minutes INTEGER,
  awake_minutes INTEGER,
  
  -- Environmental Data
  avg_temperature DECIMAL(5, 2),
  avg_heart_rate INTEGER,
  avg_spo2 DECIMAL(5, 2),
  
  -- Notes
  notes TEXT,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DEVICE CONNECTION LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_connection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES health_devices(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  caregiver_id UUID REFERENCES caregivers(id) ON DELETE SET NULL,
  
  -- Connection Event
  event_type VARCHAR(100) NOT NULL, -- connected, disconnected, paired, unpaired, error, battery_low
  event_status VARCHAR(50), -- success, failure, warning
  
  -- Connection Details
  connection_duration_seconds INTEGER,
  signal_strength_start INTEGER, -- RSSI
  signal_strength_end INTEGER, -- RSSI
  
  -- Error Information
  error_code VARCHAR(50),
  error_message TEXT,
  
  -- Device State
  battery_level INTEGER,
  firmware_version VARCHAR(50),
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DEVICE ALERT THRESHOLDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_alert_thresholds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES health_devices(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  
  -- Heart Rate Thresholds
  hr_min_normal INTEGER DEFAULT 60, -- BPM
  hr_max_normal INTEGER DEFAULT 100, -- BPM
  hr_critical_low INTEGER DEFAULT 40, -- BPM
  hr_critical_high INTEGER DEFAULT 120, -- BPM
  
  -- SpO2 Thresholds
  spo2_min_normal DECIMAL(5, 2) DEFAULT 95, -- %
  spo2_critical_low DECIMAL(5, 2) DEFAULT 90, -- %
  
  -- Temperature Thresholds
  temp_min_normal DECIMAL(5, 2) DEFAULT 36.1, -- °C
  temp_max_normal DECIMAL(5, 2) DEFAULT 37.2, -- °C
  temp_fever DECIMAL(5, 2) DEFAULT 38.0, -- °C
  temp_critical DECIMAL(5, 2) DEFAULT 39.0, -- °C
  
  -- Fall Detection Thresholds
  fall_acceleration_threshold DECIMAL(5, 2) DEFAULT 2.5, -- g
  fall_duration_threshold INTEGER DEFAULT 100, -- ms
  
  -- Sleep Thresholds
  sleep_inactivity_duration INTEGER DEFAULT 300000, -- 5 minutes in ms
  sleep_movement_threshold DECIMAL(5, 2) DEFAULT 0.3, -- g
  
  -- Alert Preferences
  enable_hr_alerts BOOLEAN DEFAULT TRUE,
  enable_spo2_alerts BOOLEAN DEFAULT TRUE,
  enable_temp_alerts BOOLEAN DEFAULT TRUE,
  enable_fall_alerts BOOLEAN DEFAULT TRUE,
  enable_sleep_alerts BOOLEAN DEFAULT FALSE,
  
  -- Notification Settings
  alert_notification_type VARCHAR(100), -- push, email, sms, all
  alert_sound_enabled BOOLEAN DEFAULT TRUE,
  alert_vibration_enabled BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DEVICE FIRMWARE & UPDATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_firmware_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES health_devices(id) ON DELETE CASCADE,
  
  -- Firmware Details
  firmware_version VARCHAR(50) NOT NULL,
  release_date DATE,
  description TEXT,
  
  -- Update Status
  update_status VARCHAR(50) DEFAULT 'available', -- available, downloading, installing, completed, failed
  update_progress INTEGER DEFAULT 0, -- 0-100%
  
  -- Update Timing
  update_started_at TIMESTAMP WITH TIME ZONE,
  update_completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Error Information
  error_code VARCHAR(50),
  error_message TEXT,
  
  -- Metadata
  changelog TEXT,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DEVICE PAIRING HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_pairing_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES health_devices(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  caregiver_id UUID REFERENCES caregivers(id) ON DELETE SET NULL,
  
  -- Pairing Details
  pairing_status VARCHAR(50), -- success, failed, cancelled
  pairing_method VARCHAR(100), -- bluetooth, qr_code, manual
  
  -- Pairing Timing
  pairing_started_at TIMESTAMP WITH TIME ZONE,
  pairing_completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Error Information
  error_code VARCHAR(50),
  error_message TEXT,
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DEVICE HEALTH & DIAGNOSTICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_diagnostics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES health_devices(id) ON DELETE CASCADE,
  
  -- Hardware Health
  cpu_usage_percent DECIMAL(5, 2),
  memory_usage_percent DECIMAL(5, 2),
  storage_usage_percent DECIMAL(5, 2),
  
  -- Sensor Health
  max30102_status VARCHAR(50), -- ok, error, disconnected
  mpu6050_status VARCHAR(50), -- ok, error, disconnected
  
  -- Communication Health
  ble_signal_strength INTEGER, -- RSSI (dBm)
  ble_packet_loss_percent DECIMAL(5, 2),
  i2c_error_count INTEGER,
  
  -- Temperature & Power
  device_temperature DECIMAL(5, 2), -- °C
  battery_health VARCHAR(50), -- excellent, good, fair, poor
  charging_cycles INTEGER,
  
  -- Uptime
  uptime_seconds INTEGER,
  last_restart TIMESTAMP WITH TIME ZONE,
  
  -- Error Log
  error_count INTEGER DEFAULT 0,
  last_error_message TEXT,
  last_error_time TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_health_devices_patient ON health_devices(patient_id);
CREATE INDEX IF NOT EXISTS idx_health_devices_mac_address ON health_devices(mac_address);
CREATE INDEX IF NOT EXISTS idx_health_devices_active ON health_devices(is_active);
CREATE INDEX IF NOT EXISTS idx_health_devices_connection_status ON health_devices(connection_status);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_device ON sensor_readings(device_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_patient ON sensor_readings(patient_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_timestamp ON sensor_readings(created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_heart_rate ON sensor_readings(heart_rate);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_spo2 ON sensor_readings(spo2);

CREATE INDEX IF NOT EXISTS idx_fall_detection_device ON fall_detection_events(device_id);
CREATE INDEX IF NOT EXISTS idx_fall_detection_patient ON fall_detection_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_fall_detection_timestamp ON fall_detection_events(created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_fall_detection_alert_sent ON fall_detection_events(alert_sent);

CREATE INDEX IF NOT EXISTS idx_sleep_sessions_device ON sleep_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_patient ON sleep_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_date ON sleep_sessions(sleep_start DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_device_connection_logs_device ON device_connection_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_device_connection_logs_patient ON device_connection_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_device_connection_logs_event ON device_connection_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_device_connection_logs_timestamp ON device_connection_logs(created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_device_alert_thresholds_device ON device_alert_thresholds(device_id);
CREATE INDEX IF NOT EXISTS idx_device_alert_thresholds_patient ON device_alert_thresholds(patient_id);

CREATE INDEX IF NOT EXISTS idx_device_firmware_updates_device ON device_firmware_updates(device_id);
CREATE INDEX IF NOT EXISTS idx_device_firmware_updates_status ON device_firmware_updates(update_status);

CREATE INDEX IF NOT EXISTS idx_device_pairing_history_device ON device_pairing_history(device_id);
CREATE INDEX IF NOT EXISTS idx_device_pairing_history_patient ON device_pairing_history(patient_id);

CREATE INDEX IF NOT EXISTS idx_device_diagnostics_device ON device_diagnostics(device_id);
CREATE INDEX IF NOT EXISTS idx_device_diagnostics_timestamp ON device_diagnostics(created_at DESC NULLS LAST);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all device tables
ALTER TABLE health_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fall_detection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_connection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_alert_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_firmware_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_pairing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_diagnostics ENABLE ROW LEVEL SECURITY;

-- Caregivers can view devices for their patients
CREATE POLICY "Caregivers can view patient devices" ON health_devices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = health_devices.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- Caregivers can view sensor readings for their patients
CREATE POLICY "Caregivers can view patient sensor readings" ON sensor_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = sensor_readings.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- Caregivers can view fall detection events for their patients
CREATE POLICY "Caregivers can view fall detection events" ON fall_detection_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = fall_detection_events.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- Caregivers can view sleep sessions for their patients
CREATE POLICY "Caregivers can view sleep sessions" ON sleep_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = sleep_sessions.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

CREATE TRIGGER update_health_devices_updated_at BEFORE UPDATE ON health_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fall_detection_events_updated_at BEFORE UPDATE ON fall_detection_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sleep_sessions_updated_at BEFORE UPDATE ON sleep_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_alert_thresholds_updated_at BEFORE UPDATE ON device_alert_thresholds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_firmware_updates_updated_at BEFORE UPDATE ON device_firmware_updates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_diagnostics_updated_at BEFORE UPDATE ON device_diagnostics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Latest sensor reading for each device
CREATE OR REPLACE VIEW latest_sensor_readings AS
SELECT DISTINCT ON (device_id)
  device_id,
  patient_id,
  heart_rate,
  spo2,
  temperature,
  accel_magnitude,
  created_at
FROM sensor_readings
ORDER BY device_id, created_at DESC;

-- Active devices with connection status
CREATE OR REPLACE VIEW active_devices_status AS
SELECT
  hd.id,
  hd.device_name,
  hd.patient_id,
  hd.connection_status,
  hd.battery_level,
  hd.signal_strength,
  hd.last_connected_at,
  lsr.heart_rate,
  lsr.spo2,
  lsr.temperature,
  lsr.created_at as last_reading_time
FROM health_devices hd
LEFT JOIN latest_sensor_readings lsr ON hd.id = lsr.device_id
WHERE hd.is_active = TRUE;

-- Daily sensor summary
CREATE OR REPLACE VIEW daily_sensor_summary AS
SELECT
  DATE(created_at) as reading_date,
  device_id,
  patient_id,
  ROUND(AVG(heart_rate)::numeric, 2) as avg_heart_rate,
  MAX(heart_rate) as max_heart_rate,
  MIN(heart_rate) as min_heart_rate,
  ROUND(AVG(spo2)::numeric, 2) as avg_spo2,
  ROUND(AVG(temperature)::numeric, 2) as avg_temperature,
  COUNT(*) as reading_count
FROM sensor_readings
WHERE heart_rate IS NOT NULL
GROUP BY DATE(created_at), device_id, patient_id
ORDER BY reading_date DESC;

-- ============================================================================
-- END OF DEVICE CONNECTION SCHEMA
-- ============================================================================
