-- ============================================================================
-- MASTER RLS PERFORMANCE & CONSOLIDATION FIX (V6)
-- This script resolves all Supabase Linter warnings AND fixes 403 errors:
-- 1. auth_rls_initplan: Optimizes auth.uid() by wrapping in (SELECT auth.uid())
-- 2. multiple_permissive_policies: Consolidates redundant policies
-- 3. rls_disabled_in_public: Ensures RLS is enabled on all public tables
-- 4. security_definer_view: Converts views to security invoker for better safety
-- 5. function_search_path_mutable: Sets fixed search_path for all functions
-- 6. [NEW] Double-check assignment logic: Supports BOTH patients.caregiver_id 
--    and patient_caregivers join table for authorization.
-- ============================================================================

-- Function to drop all policies for a table (helper to ensure clean state)
CREATE OR REPLACE FUNCTION drop_all_policies(target_table text, target_schema text DEFAULT 'public')
RETURNS void AS $$
DECLARE
    pol_record RECORD;
BEGIN
    FOR pol_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = target_table 
        AND schemaname = target_schema
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol_record.policyname, target_schema, target_table);
    END LOOP;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- 1. ENABLE RLS ON ALL TABLES
DO $$
DECLARE
    t text;
    all_tables text[] := ARRAY[
        'caregivers', 'patients', 'patient_caregivers', 'patient_vitals', 
        'patient_locations', 'patient_alerts', 'geofences', 'health_devices', 
        'sensor_readings', 'fall_detection_events', 'sleep_sessions', 
        'device_connection_logs', 'device_alert_thresholds', 'device_firmware_updates', 
        'device_pairing_history', 'device_diagnostics', 'sleep_data', 'fall_events',
        'medical_conditions', 'medications', 'medication_logs', 'allergies',
        'emergency_contacts', 'doctors', 'activity_data', 'safe_zones',
        'alert_rules', 'notifications', 'call_logs', 'activity_logs', 
        'daily_summaries', 'login_history', 'signup_audit', 'patient_audit'
    ];
BEGIN
    FOREACH t IN ARRAY all_tables LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', t);
        PERFORM drop_all_policies(t);
    END LOOP;
END $$;

-- 2. UPDATE VIEWS TO SECURITY INVOKER
ALTER VIEW IF EXISTS latest_sensor_readings SET (security_invoker = on);
ALTER VIEW IF EXISTS active_devices_status SET (security_invoker = on);
ALTER VIEW IF EXISTS daily_sensor_summary SET (security_invoker = on);

-- 3. RE-DECLARE FUNCTIONS WITH FIXED SEARCH_PATH
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION deactivate_old_geofences()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE geofences SET is_active = false
  WHERE geofence_type = 'fall_incident' AND created_at < NOW() - INTERVAL '7 days' AND is_active = true;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION create_daily_summary(patient_uuid UUID, summary_date_param DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO daily_summaries (
    patient_id, summary_date, avg_heart_rate, avg_spo2, total_steps,
    total_sleep_hours, alert_count, fall_count, medication_adherence_percentage
  )
  SELECT
    patient_uuid, summary_date_param,
    ROUND(AVG(pv.heart_rate)::numeric, 2), ROUND(AVG(pv.spo2)::numeric, 2),
    COALESCE(ad.steps, 0), COALESCE(sd.total_sleep_hours, 0),
    COUNT(DISTINCT CASE WHEN pa.alert_type != 'medication_reminder' THEN pa.id END),
    COUNT(DISTINCT CASE WHEN pa.alert_type = 'fall_detected' THEN pa.id END),
    COALESCE(ROUND((
      SELECT COUNT(*) FILTER (WHERE status = 'taken')::numeric / NULLIF(COUNT(*)::numeric, 0) * 100
      FROM medication_logs WHERE patient_id = patient_uuid AND DATE(taken_at) = summary_date_param
    ), 2), 0)
  FROM patient_vitals pv
  LEFT JOIN sleep_data sd ON sd.patient_id = patient_uuid AND sd.sleep_date = summary_date_param
  LEFT JOIN activity_data ad ON ad.patient_id = patient_uuid AND ad.activity_date = summary_date_param
  LEFT JOIN patient_alerts pa ON pa.patient_id = patient_uuid AND DATE(pa.created_at) = summary_date_param
  WHERE pv.patient_id = patient_uuid AND DATE(pv.created_at) = summary_date_param
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
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION check_vital_thresholds(patient_uuid UUID)
RETURNS void AS $$
DECLARE
  latest_vitals RECORD;
BEGIN
  SELECT * INTO latest_vitals FROM patient_vitals WHERE patient_id = patient_uuid ORDER BY created_at DESC LIMIT 1;
  IF latest_vitals IS NOT NULL THEN
    IF latest_vitals.heart_rate > 100 OR latest_vitals.heart_rate < 60 THEN
      INSERT INTO patient_alerts (patient_id, alert_type, priority, title, message, vital_id)
      VALUES (patient_uuid, 'heart_rate_alert', CASE WHEN latest_vitals.heart_rate > 120 OR latest_vitals.heart_rate < 50 THEN 'high' ELSE 'medium' END, 'Heart Rate Alert', 'Heart rate is ' || latest_vitals.heart_rate || ' BPM', latest_vitals.id);
    END IF;
    IF latest_vitals.spo2 < 95 THEN
      INSERT INTO patient_alerts (patient_id, alert_type, priority, title, message, vital_id)
      VALUES (patient_uuid, 'spo2_alert', CASE WHEN latest_vitals.spo2 < 90 THEN 'high' ELSE 'medium' END, 'Blood Oxygen Alert', 'SpO2 level is ' || latest_vitals.spo2 || '%', latest_vitals.id);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 4. CREATE CONSOLIDATED & OPTIMIZED POLICIES

-- CAREGIVERS
CREATE POLICY "Caregivers can view own profile" ON caregivers FOR SELECT USING (auth_id = (SELECT auth.uid()));
CREATE POLICY "Caregivers can update own profile" ON caregivers FOR UPDATE USING (auth_id = (SELECT auth.uid()));

-- PATIENTS (The core check)
CREATE POLICY "Caregivers can manage assigned patients" ON patients FOR ALL USING (
  EXISTS (
    SELECT 1 FROM caregivers c 
    WHERE c.auth_id = (SELECT auth.uid())
    AND (
      patients.caregiver_id = c.id -- Direct assignment
      OR 
      EXISTS (SELECT 1 FROM patient_caregivers pc WHERE pc.patient_id = patients.id AND pc.caregiver_id = c.id) -- Join table
    )
  )
);

-- PATIENT_CAREGIVERS
CREATE POLICY "Caregivers can manage their own assignments" ON patient_caregivers FOR ALL USING (
  caregiver_id IN (SELECT id FROM caregivers WHERE auth_id = (SELECT auth.uid()))
);

-- PATIENT DATA TABLES (Chain security through the patients table)
DO $$
DECLARE
    t text;
    data_tables text[] := ARRAY[
        'patient_vitals', 'patient_locations', 'patient_alerts', 'geofences', 
        'health_devices', 'sensor_readings', 'fall_detection_events', 
        'sleep_sessions', 'device_connection_logs', 'device_alert_thresholds', 
        'sleep_data', 'fall_events', 'device_pairing_history', 'medical_conditions', 
        'medications', 'medication_logs', 'allergies', 'emergency_contacts', 
        'doctors', 'activity_data', 'safe_zones', 'alert_rules', 
        'call_logs', 'activity_logs', 'daily_summaries'
    ];
BEGIN
    FOR t IN SELECT unnest(data_tables) LOOP
        EXECUTE format('CREATE POLICY "Caregivers can manage %I" ON %I FOR ALL USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = %I.patient_id))', t, t, t);
    END LOOP;
END $$;

-- SPECIAL CASES (Device-linked tables)
CREATE POLICY "Caregivers can manage device firmware updates" ON device_firmware_updates FOR ALL USING (
  EXISTS (SELECT 1 FROM health_devices hd JOIN patients p ON hd.patient_id = p.id WHERE hd.id = device_firmware_updates.device_id)
);
CREATE POLICY "Caregivers can manage device diagnostics" ON device_diagnostics FOR ALL USING (
  EXISTS (SELECT 1 FROM health_devices hd JOIN patients p ON hd.patient_id = p.id WHERE hd.id = device_diagnostics.device_id)
);

-- AUDIT & LOG TABLES (linked by caregiver_id)
CREATE POLICY "Caregivers can manage own notifications" ON notifications FOR ALL USING (caregiver_id IN (SELECT id FROM caregivers WHERE auth_id = (SELECT auth.uid())));
CREATE POLICY "Caregivers can view own login history" ON login_history FOR SELECT USING (caregiver_id IN (SELECT id FROM caregivers WHERE auth_id = (SELECT auth.uid())));
CREATE POLICY "Caregivers can view own signup audit" ON signup_audit FOR SELECT USING (caregiver_id IN (SELECT id FROM caregivers WHERE auth_id = (SELECT auth.uid())));
CREATE POLICY "Caregivers can view own patient audit" ON patient_audit FOR SELECT USING (caregiver_id IN (SELECT id FROM caregivers WHERE auth_id = (SELECT auth.uid())));

-- Cleanup helper function
DROP FUNCTION drop_all_policies(text, text);

-- ============================================================================
-- DONE - RLS FIXES APPLIED SUCCESSFULLY (V6)
-- ============================================================================
