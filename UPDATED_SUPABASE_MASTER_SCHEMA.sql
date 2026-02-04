-- Alzheimer's Caregiver App - Master Database Schema (Updated)
-- Consolidation of Core, Vitals, Geofencing, and Alerting Modules

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS & AUTHENTICATION
-- ============================================================================

-- Caregivers table
CREATE TABLE IF NOT EXISTS caregivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID NOT NULL UNIQUE, -- Links to Supabase Auth
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20),
  blood_type VARCHAR(10),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  doctor_name VARCHAR(255),
  doctor_phone VARCHAR(20),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Patient-Caregiver relationship intersection
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
-- 2. HEALTH & MONITORING (ESP32 / Wearable)
-- ============================================================================

-- Patient vitals (Heart Rate, SpO2, etc.)
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
  data_source VARCHAR(100), -- 'ESP32', 'Manual', 'Pi'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sleep data tracking
CREATE TABLE IF NOT EXISTS sleep_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  sleep_date DATE NOT NULL,
  total_sleep_hours DECIMAL(5, 2),
  sleep_quality VARCHAR(50), -- poor, fair, good, excellent
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(patient_id, sleep_date)
);

-- ============================================================================
-- 3. LOCATION & GEOFENCING (Raspberry Pi / GPS)
-- ============================================================================

-- Real-time location history
CREATE TABLE IF NOT EXISTS patient_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(8, 2),
  battery_level INTEGER,
  location_type TEXT DEFAULT 'tracking',
  notes TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Safe Zones / Geofences
CREATE TABLE IF NOT EXISTS geofences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  center_latitude DOUBLE PRECISION NOT NULL,
  center_longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 250,
  is_active BOOLEAN DEFAULT true,
  geofence_type TEXT DEFAULT 'manual', -- 'manual', 'fall_incident', 'home'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. ALERTS & FALL EVENTS
-- ============================================================================

-- System-wide alerts
CREATE TABLE IF NOT EXISTS patient_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  alert_type VARCHAR(100) NOT NULL, -- 'fall_detected', 'heart_rate_alert', 'geofence_exit'
  priority VARCHAR(50) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB, -- For extra info (e.g., GPS coords at time of alert)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Specific fall incident tracking
CREATE TABLE IF NOT EXISTS fall_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  location_id UUID REFERENCES patient_locations(id) ON DELETE SET NULL,
  confidence_score DECIMAL(5, 2),
  impact_force DECIMAL(8, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE caregivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_caregivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fall_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_data ENABLE ROW LEVEL SECURITY;

-- REUSABLE HELPER: Check if user is a caregiver for a specific patient
-- Use: EXISTS (SELECT 1 FROM patient_caregivers pc JOIN caregivers c ON pc.caregiver_id = c.id WHERE pc.patient_id = [TABLE].patient_id AND c.auth_id = auth.uid())

-- Caregivers can view/edit their own profile
CREATE POLICY "Caregivers can view own profile" ON caregivers FOR SELECT USING (auth_id = (SELECT auth.uid()));
CREATE POLICY "Caregivers can update own profile" ON caregivers FOR UPDATE USING (auth_id = (SELECT auth.uid()));

-- Caregivers can view patients they are assigned to
CREATE POLICY "Caregivers can view assigned patients" ON patients FOR SELECT USING (
  EXISTS (SELECT 1 FROM patient_caregivers pc JOIN caregivers c ON pc.caregiver_id = c.id WHERE pc.patient_id = patients.id AND c.auth_id = auth.uid())
);

-- Relationship Table Policies (CRITICAL for EXISTS subqueries to work)
CREATE POLICY "Caregivers can view their own assignments" ON patient_caregivers FOR SELECT USING (
  EXISTS (SELECT 1 FROM caregivers c WHERE c.id = patient_caregivers.caregiver_id AND c.auth_id = auth.uid())
);

-- Core Patient Data Policies
CREATE POLICY "Caregivers can view vitals" ON patient_vitals FOR SELECT USING (
  EXISTS (SELECT 1 FROM patient_caregivers pc JOIN caregivers c ON pc.caregiver_id = c.id WHERE pc.patient_id = patient_vitals.patient_id AND c.auth_id = auth.uid())
);

CREATE POLICY "Caregivers can view locations" ON patient_locations FOR SELECT USING (
  EXISTS (SELECT 1 FROM patient_caregivers pc JOIN caregivers c ON pc.caregiver_id = c.id WHERE pc.patient_id = patient_locations.patient_id AND c.auth_id = auth.uid())
);

CREATE POLICY "Caregivers can view geofences" ON geofences FOR SELECT USING (
  EXISTS (SELECT 1 FROM patient_caregivers pc JOIN caregivers c ON pc.caregiver_id = c.id WHERE pc.patient_id = geofences.patient_id AND c.auth_id = auth.uid())
);

CREATE POLICY "Caregivers can create geofences" ON geofences FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM patient_caregivers pc JOIN caregivers c ON pc.caregiver_id = c.id WHERE pc.patient_id = geofences.patient_id AND c.auth_id = auth.uid())
);

CREATE POLICY "Caregivers can update geofences" ON geofences FOR UPDATE USING (
  EXISTS (SELECT 1 FROM patient_caregivers pc JOIN caregivers c ON pc.caregiver_id = c.id WHERE pc.patient_id = geofences.patient_id AND c.auth_id = auth.uid())
);

CREATE POLICY "Caregivers can delete geofences" ON geofences FOR DELETE USING (
  EXISTS (SELECT 1 FROM patient_caregivers pc JOIN caregivers c ON pc.caregiver_id = c.id WHERE pc.patient_id = geofences.patient_id AND c.auth_id = auth.uid())
);

CREATE POLICY "Caregivers can view/manage alerts" ON patient_alerts FOR ALL USING (
  EXISTS (SELECT 1 FROM patient_caregivers pc JOIN caregivers c ON pc.caregiver_id = c.id WHERE pc.patient_id = patient_alerts.patient_id AND c.auth_id = auth.uid())
);

CREATE POLICY "Caregivers can view fall events" ON fall_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM patient_caregivers pc JOIN caregivers c ON pc.caregiver_id = c.id WHERE pc.patient_id = fall_events.patient_id AND c.auth_id = auth.uid())
);

CREATE POLICY "Caregivers can view sleep data" ON sleep_data FOR SELECT USING (
  EXISTS (SELECT 1 FROM patient_caregivers pc JOIN caregivers c ON pc.caregiver_id = c.id WHERE pc.patient_id = sleep_data.patient_id AND c.auth_id = auth.uid())
);

-- ============================================================================
-- 6. INDEXES & TRIMMING
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vitals_patient_time ON patient_vitals(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_locations_patient_time ON patient_locations(patient_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_patient_read ON patient_alerts(patient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_geofences_active ON geofences(patient_id, is_active);

-- Cleanup function for old fall incident geofences (Runs every 7 days)
CREATE OR REPLACE FUNCTION deactivate_old_fall_zones()
RETURNS VOID AS $$
BEGIN
  UPDATE geofences
  SET is_active = false
  WHERE geofence_type = 'fall_incident'
  AND created_at < NOW() - INTERVAL '7 days'
  AND is_active = true;
END;
$$ LANGUAGE plpgsql
SET search_path = public;
