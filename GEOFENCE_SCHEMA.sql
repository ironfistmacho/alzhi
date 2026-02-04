-- Geofences table for location-based safety zones
CREATE TABLE IF NOT EXISTS geofences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  center_latitude DOUBLE PRECISION NOT NULL,
  center_longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 250,
  is_active BOOLEAN DEFAULT true,
  geofence_type TEXT DEFAULT 'manual', -- 'manual', 'fall_incident', 'home', 'care_facility'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_geofences_patient_id ON geofences(patient_id);
CREATE INDEX IF NOT EXISTS idx_geofences_is_active ON geofences(is_active);

-- RLS Policies for geofences
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;

-- Caregivers can view geofences for their patients
CREATE POLICY "Caregivers can view patient geofences"
ON geofences FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM patient_caregivers cp
    INNER JOIN caregivers c ON c.id = cp.caregiver_id
    WHERE cp.patient_id = geofences.patient_id
    AND c.auth_id = (SELECT auth.uid())
  )
);

-- Caregivers can insert geofences for their patients
CREATE POLICY "Caregivers can create patient geofences"
ON geofences FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM patient_caregivers cp
    INNER JOIN caregivers c ON c.id = cp.caregiver_id
    WHERE cp.patient_id = geofences.patient_id
    AND c.auth_id = (SELECT auth.uid())
  )
);

-- Caregivers can update geofences for their patients
CREATE POLICY "Caregivers can update patient geofences"
ON geofences FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM patient_caregivers cp
    INNER JOIN caregivers c ON c.id = cp.caregiver_id
    WHERE cp.patient_id = geofences.patient_id
    AND c.auth_id = (SELECT auth.uid())
  )
);

-- Caregivers can delete geofences for their patients
CREATE POLICY "Caregivers can delete patient geofences"
ON geofences FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM patient_caregivers cp
    INNER JOIN caregivers c ON c.id = cp.caregiver_id
    WHERE cp.patient_id = geofences.patient_id
    AND c.auth_id = (SELECT auth.uid())
  )
);

-- Function to automatically deactivate old geofences (optional cleanup)
CREATE OR REPLACE FUNCTION deactivate_old_geofences()
RETURNS TRIGGER AS $$
BEGIN
  -- Deactivate fall incident geofences older than 7 days
  UPDATE geofences
  SET is_active = false
  WHERE geofence_type = 'fall_incident'
  AND created_at < NOW() - INTERVAL '7 days'
  AND is_active = true;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger to run cleanup daily (fires on any geofence insert)
CREATE TRIGGER trigger_cleanup_old_geofences
AFTER INSERT ON geofences
FOR EACH STATEMENT
EXECUTE FUNCTION deactivate_old_geofences();

-- Comments for documentation
COMMENT ON TABLE geofences IS 'Geofencing zones for patient safety monitoring';
COMMENT ON COLUMN geofences.radius_meters IS 'Radius of geofence in meters (100-5000)';
COMMENT ON COLUMN geofences.geofence_type IS 'Type: manual, fall_incident, home, care_facility';
