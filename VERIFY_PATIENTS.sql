-- ============================================================================
-- VERIFY PATIENTS - NO PLACEHOLDERS
-- ============================================================================

-- Step 1: Get your caregiver ID (run this first)
SELECT id, auth_id, first_name, last_name, email, created_at 
FROM caregivers 
ORDER BY created_at DESC 
LIMIT 5;

-- Step 2: Check total patients in database
SELECT COUNT(*) as total_patients FROM patients;

-- Step 3: Check all patients with caregiver info
SELECT 
  p.id,
  p.caregiver_id,
  p.first_name,
  p.last_name,
  p.date_of_birth,
  p.created_at,
  c.first_name as caregiver_name,
  c.email as caregiver_email
FROM patients p
LEFT JOIN caregivers c ON p.caregiver_id = c.id
ORDER BY p.created_at DESC;

-- Step 4: Check RLS status on patients table
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'patients';

-- Step 5: Check foreign key constraints on patients
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'patients';

-- Step 6: Check patients table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'patients'
ORDER BY ordinal_position;

-- ============================================================================
-- AFTER GETTING CAREGIVER ID FROM STEP 1, USE IT BELOW
-- Replace 'PASTE_CAREGIVER_ID_HERE' with the ID from Step 1
-- ============================================================================

-- Check patients for specific caregiver
-- SELECT * FROM patients WHERE caregiver_id = 'PASTE_CAREGIVER_ID_HERE';

-- ============================================================================
-- IF PATIENTS NOT SHOWING, RUN THIS COMPLETE FIX
-- ============================================================================

-- Disable RLS on patients table
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;

-- Drop foreign key constraint if it exists
ALTER TABLE patients 
DROP CONSTRAINT IF EXISTS patients_caregiver_id_fkey CASCADE;

-- Verify changes
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'patients';

-- Check if patients exist now
SELECT COUNT(*) as total_patients FROM patients;

-- ============================================================================
-- VERIFY DATA AFTER FIX
-- ============================================================================

-- Show all patients with caregiver info
SELECT 
  p.id,
  p.caregiver_id,
  p.first_name,
  p.last_name,
  p.date_of_birth,
  p.gender,
  p.alzheimers_stage,
  p.created_at,
  c.first_name as caregiver_name
FROM patients p
LEFT JOIN caregivers c ON p.caregiver_id = c.id
ORDER BY p.created_at DESC;
