-- Alzheimer's Caregiver App - Supabase Database Schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS & AUTHENTICATION TABLES
-- ============================================================================

-- Caregivers table (for LoginScreen & SignUpScreen)
CREATE TABLE IF NOT EXISTS caregivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  profile_picture_url TEXT,
  relationship_to_patient VARCHAR(100),
  is_primary_caregiver BOOLEAN DEFAULT FALSE,
  account_status VARCHAR(50) DEFAULT 'active', -- active, inactive, suspended
  last_login TIMESTAMP WITH TIME ZONE,
  login_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Patients table (for AddPatientScreen)
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20),
  blood_type VARCHAR(10),
  height_cm DECIMAL(5, 2),
  weight_kg DECIMAL(5, 2),
  profile_picture_url TEXT,
  alzheimers_stage VARCHAR(50), -- early, middle, late
  diagnosis_date DATE,
  medical_conditions TEXT,
  current_medications TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  doctor_name VARCHAR(255),
  doctor_phone VARCHAR(20),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Patient-Caregiver relationship (many-to-many)
CREATE TABLE IF NOT EXISTS patient_caregivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  role VARCHAR(100) DEFAULT 'caregiver',
  permissions JSONB DEFAULT '{"view_vitals": true, "view_location": true, "manage_alerts": true}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(patient_id, caregiver_id)
);

-- ============================================================================
-- MEDICAL INFORMATION TABLES
-- ============================================================================

-- Medical conditions
CREATE TABLE IF NOT EXISTS medical_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition_name VARCHAR(255) NOT NULL,
  diagnosis_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Medications
CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medication_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100) NOT NULL,
  frequency VARCHAR(100) NOT NULL,
  scheduled_time TIME,
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Medication adherence tracking
CREATE TABLE IF NOT EXISTS medication_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  taken_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, taken, missed, skipped
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Allergies
CREATE TABLE IF NOT EXISTS allergies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  allergen VARCHAR(255) NOT NULL,
  severity VARCHAR(50), -- mild, moderate, severe
  reaction_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- EMERGENCY CONTACTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  contact_name VARCHAR(255) NOT NULL,
  relationship VARCHAR(100),
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  priority INTEGER DEFAULT 1,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DOCTOR INFORMATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_name VARCHAR(255) NOT NULL,
  specialty VARCHAR(100),
  clinic_name VARCHAR(255),
  phone_number VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- VITALS MONITORING TABLES
-- ============================================================================

-- Patient vitals (heart rate, SpO2, blood pressure, temperature)
CREATE TABLE IF NOT EXISTS patient_vitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  heart_rate INTEGER,
  spo2 DECIMAL(5, 2),
  systolic_bp INTEGER,
  diastolic_bp INTEGER,
  temperature DECIMAL(5, 2),
  respiratory_rate INTEGER,
  notes TEXT,
  data_source VARCHAR(100), -- manual, device, wearable
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sleep data
CREATE TABLE IF NOT EXISTS sleep_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  sleep_date DATE NOT NULL,
  total_sleep_hours DECIMAL(5, 2),
  deep_sleep_hours DECIMAL(5, 2),
  light_sleep_hours DECIMAL(5, 2),
  rem_sleep_hours DECIMAL(5, 2),
  awake_hours DECIMAL(5, 2),
  sleep_quality VARCHAR(50), -- poor, fair, good, excellent
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(patient_id, sleep_date)
);

-- Activity data
CREATE TABLE IF NOT EXISTS activity_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  steps INTEGER,
  distance_km DECIMAL(8, 2),
  calories_burned DECIMAL(8, 2),
  active_minutes INTEGER,
  sedentary_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(patient_id, activity_date)
);

-- ============================================================================
-- LOCATION TRACKING TABLES
-- ============================================================================

-- Patient location history
CREATE TABLE IF NOT EXISTS patient_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(8, 2),
  altitude DECIMAL(8, 2),
  speed DECIMAL(8, 2),
  heading DECIMAL(6, 2),
  location_name VARCHAR(255),
  is_safe_zone BOOLEAN DEFAULT FALSE,
  battery_level INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Safe zones
CREATE TABLE IF NOT EXISTS safe_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  zone_name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  radius_meters INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ALERTS & NOTIFICATIONS TABLES
-- ============================================================================

-- Patient alerts
CREATE TABLE IF NOT EXISTS patient_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  alert_type VARCHAR(100) NOT NULL, -- fall_detected, heart_rate_alert, spo2_alert, location_alert, medication_reminder, etc.
  priority VARCHAR(50) DEFAULT 'medium', -- low, medium, high, critical
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  location_id UUID REFERENCES patient_locations(id) ON DELETE SET NULL,
  vital_id UUID REFERENCES patient_vitals(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES caregivers(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Alert rules
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  rule_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(100) NOT NULL, -- heart_rate, spo2, location, fall, medication, etc.
  condition JSONB NOT NULL, -- stores the condition logic
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  alert_id UUID NOT NULL REFERENCES patient_alerts(id) ON DELETE CASCADE,
  notification_type VARCHAR(100), -- push, email, sms
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- FALL DETECTION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS fall_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  location_id UUID REFERENCES patient_locations(id) ON DELETE SET NULL,
  confidence_score DECIMAL(5, 2),
  impact_force DECIMAL(8, 2),
  response_time_seconds INTEGER,
  caregiver_notified BOOLEAN DEFAULT FALSE,
  emergency_services_called BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CALL LOG TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  contact_name VARCHAR(255),
  contact_phone VARCHAR(20),
  call_type VARCHAR(50), -- incoming, outgoing, missed
  duration_seconds INTEGER,
  call_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ACTIVITY LOG / AUDIT TRAIL
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caregiver_id UUID REFERENCES caregivers(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  changes JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- REPORTS & ANALYTICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  avg_heart_rate DECIMAL(8, 2),
  avg_spo2 DECIMAL(5, 2),
  total_steps INTEGER,
  total_sleep_hours DECIMAL(5, 2),
  alert_count INTEGER,
  fall_count INTEGER,
  medication_adherence_percentage DECIMAL(5, 2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(patient_id, summary_date)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_caregivers_email ON caregivers(email);
CREATE INDEX IF NOT EXISTS idx_caregivers_auth_id ON caregivers(auth_id);
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients(is_active);
CREATE INDEX IF NOT EXISTS idx_patient_caregivers_caregiver ON patient_caregivers(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_medical_conditions_patient ON medical_conditions(patient_id);
CREATE INDEX IF NOT EXISTS idx_medications_patient ON medications(patient_id, is_active);
CREATE INDEX IF NOT EXISTS idx_medication_logs_medication ON medication_logs(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_status ON medication_logs(status);
CREATE INDEX IF NOT EXISTS idx_allergies_patient ON allergies(patient_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_patient ON emergency_contacts(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctors_patient ON doctors(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_timestamp ON patient_vitals(created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_sleep_data_patient ON sleep_data(patient_id, sleep_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_activity_data_patient ON activity_data(patient_id, activity_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_patient_locations_timestamp ON patient_locations(timestamp DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_safe_zones_patient ON safe_zones(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_alerts_read ON patient_alerts(is_read, created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_alert_rules_patient ON alert_rules(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_caregiver ON notifications(caregiver_id, created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_fall_events_patient ON fall_events(patient_id, created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_call_logs_patient ON call_logs(patient_id, call_time DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_patient ON daily_summaries(patient_id, summary_date DESC NULLS LAST);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE caregivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_caregivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE safe_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE fall_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- Caregivers can view their own profile
CREATE POLICY "Caregivers can view own profile" ON caregivers
  FOR SELECT USING (auth_id = (SELECT auth.uid()));

-- Caregivers can view patients they are assigned to
CREATE POLICY "Caregivers can view assigned patients" ON patients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = patients.id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- Caregivers can view patient data they have access to
CREATE POLICY "Caregivers can view patient vitals" ON patient_vitals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = patient_vitals.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Caregivers can view patient locations" ON patient_locations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = patient_locations.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Caregivers can view patient alerts" ON patient_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = patient_alerts.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Apply update_updated_at trigger to all tables with updated_at
CREATE TRIGGER update_caregivers_updated_at BEFORE UPDATE ON caregivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_conditions_updated_at BEFORE UPDATE ON medical_conditions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_allergies_updated_at BEFORE UPDATE ON allergies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sleep_data_updated_at BEFORE UPDATE ON sleep_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activity_data_updated_at BEFORE UPDATE ON activity_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_safe_zones_updated_at BEFORE UPDATE ON safe_zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_alerts_updated_at BEFORE UPDATE ON patient_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create daily summary
CREATE OR REPLACE FUNCTION create_daily_summary(patient_uuid UUID, summary_date_param DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO daily_summaries (
    patient_id,
    summary_date,
    avg_heart_rate,
    avg_spo2,
    total_steps,
    total_sleep_hours,
    alert_count,
    fall_count,
    medication_adherence_percentage
  )
  SELECT
    patient_uuid,
    summary_date_param,
    ROUND(AVG(pv.heart_rate)::numeric, 2),
    ROUND(AVG(pv.spo2)::numeric, 2),
    COALESCE(ad.steps, 0),
    COALESCE(sd.total_sleep_hours, 0),
    COUNT(DISTINCT CASE WHEN pa.alert_type != 'medication_reminder' THEN pa.id END),
    COUNT(DISTINCT CASE WHEN pa.alert_type = 'fall_detected' THEN pa.id END),
    COALESCE(ROUND((
      SELECT COUNT(*) FILTER (WHERE status = 'taken')::numeric / 
             NULLIF(COUNT(*)::numeric, 0) * 100
      FROM medication_logs
      WHERE patient_id = patient_uuid
      AND DATE(taken_at) = summary_date_param
    ), 2), 0)
  FROM patient_vitals pv
  LEFT JOIN sleep_data sd ON sd.patient_id = patient_uuid AND sd.sleep_date = summary_date_param
  LEFT JOIN activity_data ad ON ad.patient_id = patient_uuid AND ad.activity_date = summary_date_param
  LEFT JOIN patient_alerts pa ON pa.patient_id = patient_uuid AND DATE(pa.created_at) = summary_date_param
  WHERE pv.patient_id = patient_uuid
  AND DATE(pv.created_at) = summary_date_param
  GROUP BY ad.steps, sd.total_sleep_hours
  ON CONFLICT (patient_id, summary_date) DO UPDATE SET
    avg_heart_rate = EXCLUDED.avg_heart_rate,
    avg_spo2 = EXCLUDED.avg_spo2,
    total_steps = EXCLUDED.total_steps,
    total_sleep_hours = EXCLUDED.total_sleep_hours,
    alert_count = EXCLUDED.alert_count,
    fall_count = EXCLUDED.fall_count,
    medication_adherence_percentage = EXCLUDED.medication_adherence_percentage;
END;
$$ LANGUAGE plpgsql;

-- Function to check and create alerts based on vital thresholds
CREATE OR REPLACE FUNCTION check_vital_thresholds(patient_uuid UUID)
RETURNS void AS $$
DECLARE
  latest_vitals RECORD;
  alert_message TEXT;
BEGIN
  SELECT * INTO latest_vitals FROM patient_vitals
  WHERE patient_id = patient_uuid
  ORDER BY created_at DESC
  LIMIT 1;

  IF latest_vitals IS NOT NULL THEN
    -- Check heart rate
    IF latest_vitals.heart_rate > 100 OR latest_vitals.heart_rate < 60 THEN
      INSERT INTO patient_alerts (
        patient_id,
        alert_type,
        priority,
        title,
        message,
        vital_id
      ) VALUES (
        patient_uuid,
        'heart_rate_alert',
        CASE WHEN latest_vitals.heart_rate > 120 OR latest_vitals.heart_rate < 50 THEN 'high' ELSE 'medium' END,
        'Heart Rate Alert',
        'Heart rate is ' || latest_vitals.heart_rate || ' BPM',
        latest_vitals.id
      );
    END IF;

    -- Check SpO2
    IF latest_vitals.spo2 < 95 THEN
      INSERT INTO patient_alerts (
        patient_id,
        alert_type,
        priority,
        title,
        message,
        vital_id
      ) VALUES (
        patient_uuid,
        'spo2_alert',
        CASE WHEN latest_vitals.spo2 < 90 THEN 'high' ELSE 'medium' END,
        'Blood Oxygen Alert',
        'SpO2 level is ' || latest_vitals.spo2 || '%',
        latest_vitals.id
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUTHENTICATION & LOGIN TRACKING TABLES
-- ============================================================================

-- Login history (for LoginScreen)
CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  logout_time TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  device_info VARCHAR(255),
  login_status VARCHAR(50) DEFAULT 'success', -- success, failed, locked
  failure_reason VARCHAR(255),
  session_duration INTERVAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sign up audit trail (for SignUpScreen)
CREATE TABLE IF NOT EXISTS signup_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caregiver_id UUID REFERENCES caregivers(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  signup_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  device_info VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, verified, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Patient addition audit trail (for AddPatientScreen)
CREATE TABLE IF NOT EXISTS patient_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- created, updated, deleted
  patient_first_name VARCHAR(100),
  patient_last_name VARCHAR(100),
  date_of_birth DATE,
  gender VARCHAR(20),
  blood_type VARCHAR(10),
  alzheimers_stage VARCHAR(50),
  diagnosis_date DATE,
  medical_conditions TEXT,
  current_medications TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  doctor_name VARCHAR(255),
  doctor_phone VARCHAR(20),
  notes TEXT,
  action_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  device_info VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE caregivers IS 'Stores information about caregivers who monitor patients';
COMMENT ON TABLE login_history IS 'Tracks login/logout events for security and analytics';
COMMENT ON TABLE signup_audit IS 'Tracks new caregiver registrations and email verification';
COMMENT ON TABLE patient_audit IS 'Tracks all patient data changes for audit trail';
COMMENT ON TABLE patients IS 'Stores patient demographic and medical information';
COMMENT ON TABLE patient_vitals IS 'Stores real-time vital signs data';
COMMENT ON TABLE patient_locations IS 'Stores GPS location history for tracking';
COMMENT ON TABLE patient_alerts IS 'Stores all alerts and notifications';
COMMENT ON TABLE fall_events IS 'Stores fall detection events';
COMMENT ON TABLE daily_summaries IS 'Pre-calculated daily summaries for performance';

-- ============================================================================
-- INDEXES FOR AUTHENTICATION & AUDIT TABLES
-- ============================================================================

-- Login history indexes
CREATE INDEX IF NOT EXISTS idx_login_history_caregiver ON login_history(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_login_history_time ON login_history(login_time DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_login_history_status ON login_history(caregiver_id, login_status);

-- Sign up audit indexes
CREATE INDEX IF NOT EXISTS idx_signup_audit_email ON signup_audit(email);
CREATE INDEX IF NOT EXISTS idx_signup_audit_caregiver ON signup_audit(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_signup_audit_time ON signup_audit(signup_time DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_signup_audit_status ON signup_audit(status);

-- Patient audit indexes
CREATE INDEX IF NOT EXISTS idx_patient_audit_patient ON patient_audit(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_audit_caregiver ON patient_audit(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_patient_audit_action ON patient_audit(action, action_timestamp DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_patient_audit_time ON patient_audit(action_timestamp DESC NULLS LAST);
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
  
  -- Sleep Configuration
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
  
  -- Step Count
  step_count INTEGER DEFAULT 0,
  
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
      AND c.auth_id = auth.uid()
    )
  );

-- Caregivers can view sensor readings for their patients
CREATE POLICY "Caregivers can view patient sensor readings" ON sensor_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = sensor_readings.patient_id
      AND c.auth_id = auth.uid()
    )
  );

-- Caregivers can view fall detection events for their patients
CREATE POLICY "Caregivers can view fall detection events" ON fall_detection_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = fall_detection_events.patient_id
      AND c.auth_id = auth.uid()
    )
  );

-- Caregivers can view sleep sessions for their patients
CREATE POLICY "Caregivers can view sleep sessions" ON sleep_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = sleep_sessions.patient_id
      AND c.auth_id = auth.uid()
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
  step_count,
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
  lsr.step_count,
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
  MAX(step_count) as max_steps,
  COUNT(*) as reading_count
FROM sensor_readings
WHERE heart_rate IS NOT NULL
GROUP BY DATE(created_at), device_id, patient_id
ORDER BY reading_date DESC;

-- ============================================================================
-- END OF DEVICE CONNECTION SCHEMA
-- ============================================================================
