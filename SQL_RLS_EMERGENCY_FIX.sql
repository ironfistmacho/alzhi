-- FIX FOR GEOFENCE RLS VIOLATION
-- Run this in your Supabase SQL Editor

-- 0. FIX MISSING COLUMNS IN patient_locations
ALTER TABLE patient_locations ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'tracking';
ALTER TABLE patient_locations ADD COLUMN IF NOT EXISTS notes TEXT;

-- 1. Ensure the relationship table allows caregivers to read their own links
-- Without this, the EXISTS check in other policies returns false!
DROP POLICY IF EXISTS "Caregivers can view their own assignments" ON patient_caregivers;
CREATE POLICY "Caregivers can view their own assignments" ON patient_caregivers FOR SELECT USING (
  EXISTS (SELECT 1 FROM caregivers c WHERE c.id = patient_caregivers.caregiver_id AND c.auth_id = auth.uid())
);

-- 2. Update geofences policies with explicit INSERT/WITH CHECK support
DROP POLICY IF EXISTS "Caregivers can view/manage geofences" ON geofences;
DROP POLICY IF EXISTS "Caregivers can view geofences" ON geofences;
DROP POLICY IF EXISTS "Caregivers can create geofences" ON geofences;
DROP POLICY IF EXISTS "Caregivers can update geofences" ON geofences;
DROP POLICY IF EXISTS "Caregivers can delete geofences" ON geofences;

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

-- 3. Verify RLS is enabled on critical tables
ALTER TABLE patient_caregivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
