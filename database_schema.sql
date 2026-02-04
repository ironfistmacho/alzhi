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
$$ LANGUAGE plpgsql
SET search_path = public;

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
$$ LANGUAGE plpgsql
SET search_path = public;

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
