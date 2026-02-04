-- ============================================================================
-- GET YOUR REAL IDs - COPY THE RESULTS
-- ============================================================================

-- Get your caregiver ID (copy this UUID)
SELECT id as caregiver_id, email, first_name, last_name
FROM caregivers 
WHERE auth_id = auth.uid();

-- Get patient IDs (copy one of these UUIDs)
SELECT id as patient_id, first_name, last_name, caregiver_id
FROM patients 
LIMIT 10;

-- ============================================================================
-- THEN USE THESE REAL UUIDs IN YOUR INSERT STATEMENT
-- ============================================================================

-- Example: If caregiver_id = 550e8400-e29b-41d4-a716-446655440001
--          And patient_id = 550e8400-e29b-41d4-a716-446655440000
-- Then run:

INSERT INTO patient_caregivers (patient_id, caregiver_id, role, permissions)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001',
  'caregiver',
  '{"view_vitals": true, "view_location": true, "manage_alerts": true}'
);

-- ============================================================================
-- VERIFY IT WORKED
-- ============================================================================

SELECT pc.id, pc.patient_id, pc.caregiver_id, p.first_name, p.last_name
FROM patient_caregivers pc
JOIN patients p ON pc.patient_id = p.id
LIMIT 5;
