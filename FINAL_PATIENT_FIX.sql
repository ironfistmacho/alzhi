-- ============================================================================
-- FINAL PATIENT FIX - RUN THIS COMPLETE SCRIPT
-- ============================================================================

-- Step 1: Disable RLS on patients table
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all foreign key constraints
ALTER TABLE patients 
DROP CONSTRAINT IF EXISTS patients_caregiver_id_fkey CASCADE;

-- Step 3: Verify RLS is disabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'patients';

-- Step 4: Check total patients
SELECT COUNT(*) as total_patients FROM patients;

-- Step 5: Show all patients
SELECT 
  p.id,
  p.caregiver_id,
  p.first_name,
  p.last_name,
  p.date_of_birth,
  p.gender,
  p.blood_type,
  p.height_cm,
  p.weight_kg,
  p.alzheimers_stage,
  p.created_at,
  c.first_name as caregiver_name,
  c.email as caregiver_email
FROM patients p
LEFT JOIN caregivers c ON p.caregiver_id = c.id
ORDER BY p.created_at DESC;

-- Step 6: Show caregivers with patient count
SELECT 
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  COUNT(p.id) as patient_count
FROM caregivers c
LEFT JOIN patients p ON c.id = p.caregiver_id
GROUP BY c.id, c.first_name, c.last_name, c.email
ORDER BY c.created_at DESC;

-- ============================================================================
-- IF STILL NO PATIENTS, CHECK THIS
-- ============================================================================

-- Check if patients table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'patients'
) as patients_table_exists;

-- Check patients table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'patients'
ORDER BY ordinal_position;

-- Check all constraints on patients table
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'patients';

-- ============================================================================
-- IF PATIENTS EXIST BUT NOT SHOWING IN APP
-- ============================================================================

-- Verify caregiver_id values match
SELECT DISTINCT caregiver_id FROM patients;
SELECT id FROM caregivers;

-- Check for NULL caregiver_id
SELECT COUNT(*) as null_caregiver_count FROM patients WHERE caregiver_id IS NULL;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

-- Run this to see complete status
SELECT 
  'Patients Table' as check_item,
  COUNT(*) as count_value
FROM patients
UNION ALL
SELECT 
  'Caregivers Table',
  COUNT(*)
FROM caregivers
UNION ALL
SELECT 
  'RLS Enabled on Patients',
  CASE WHEN rowsecurity THEN 1 ELSE 0 END
FROM pg_tables
WHERE tablename = 'patients';
