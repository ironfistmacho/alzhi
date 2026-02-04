-- ============================================================================
-- FIX ROW LEVEL SECURITY (RLS) POLICIES
-- Run this in your Supabase SQL Editor to allow Caregivers to insert data
-- ============================================================================

-- 1. Policies for Patient Vitals
CREATE POLICY "Caregivers can insert patient vitals" ON patient_vitals
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM patient_caregivers pc
    JOIN caregivers c ON pc.caregiver_id = c.id
    WHERE pc.patient_id = patient_vitals.patient_id
    AND c.auth_id = auth.uid()
  )
);

-- 2. Policies for Patient Alerts
CREATE POLICY "Caregivers can insert patient alerts" ON patient_alerts
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM patient_caregivers pc
    JOIN caregivers c ON pc.caregiver_id = c.id
    WHERE pc.patient_id = patient_alerts.patient_id
    AND c.auth_id = auth.uid()
  )
);

-- 3. Policies for Sleep Data
CREATE POLICY "Caregivers can insert sleep data" ON sleep_data
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM patient_caregivers pc
    JOIN caregivers c ON pc.caregiver_id = c.id
    WHERE pc.patient_id = sleep_data.patient_id
    AND c.auth_id = auth.uid()
  )
);

-- 4. Policies for Fall Events
CREATE POLICY "Caregivers can insert fall events" ON fall_events
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM patient_caregivers pc
    JOIN caregivers c ON pc.caregiver_id = c.id
    WHERE pc.patient_id = fall_events.patient_id
    AND c.auth_id = auth.uid()
  )
);

-- 5. Policies for Health Devices (Update status/battery)
CREATE POLICY "Caregivers can update assigned devices" ON health_devices
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM patient_caregivers pc
    JOIN caregivers c ON pc.caregiver_id = c.id
    WHERE pc.patient_id = health_devices.patient_id
    AND c.auth_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM patient_caregivers pc
    JOIN caregivers c ON pc.caregiver_id = c.id
    WHERE pc.patient_id = health_devices.patient_id
    AND c.auth_id = auth.uid()
  )
);

-- 6. Policies for Device Connection Logs
CREATE POLICY "Caregivers can insert connection logs" ON device_connection_logs
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM patient_caregivers pc
    JOIN caregivers c ON pc.caregiver_id = c.id
    WHERE pc.patient_id = device_connection_logs.patient_id
    AND c.auth_id = auth.uid()
  )
);
