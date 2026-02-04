-- ============================================================================
-- CHECK PATIENTS TABLE SCHEMA AND DATA
-- ============================================================================

-- Step 1: Check patients table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'patients'
ORDER BY ordinal_position;

-- Step 2: Check if there are any patients
SELECT COUNT(*) as total_patients FROM patients;

-- Step 3: Check all patients with caregiver info
SELECT 
  p.id,
  p.caregiver_id,
  p.first_name,
  p.last_name,
  p.date_of_birth,
  p.created_at,
  c.first_name as caregiver_name
FROM patients p
LEFT JOIN caregivers c ON p.caregiver_id = c.id
ORDER BY p.created_at DESC;

-- Step 4: Check specific caregiver's patients
-- Replace 'YOUR_CAREGIVER_ID' with actual caregiver ID
SELECT 
  id,
  first_name,
  last_name,
  date_of_birth,
  gender,
  blood_type,
  height_cm,
  weight_kg,
  alzheimers_stage,
  created_at
FROM patients
WHERE caregiver_id = 'YOUR_CAREGIVER_ID'
ORDER BY created_at DESC;

-- Step 5: Check for any constraints on patients table
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'patients';

-- Step 6: Check if RLS is enabled on patients table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'patients';

-- Step 7: If patients exist but not showing, check if there's a caregiver_id mismatch
SELECT 
  p.caregiver_id as patient_caregiver_id,
  c.id as caregiver_id,
  c.auth_id,
  COUNT(p.id) as patient_count
FROM patients p
RIGHT JOIN caregivers c ON p.caregiver_id = c.id
GROUP BY p.caregiver_id, c.id, c.auth_id;

-- ============================================================================
-- IF PATIENTS NOT SHOWING, RUN THIS TO VERIFY DATA INTEGRITY
-- ============================================================================

-- Check if there are orphaned patients (caregiver_id doesn't exist)
SELECT p.id, p.first_name, p.caregiver_id
FROM patients p
WHERE p.caregiver_id NOT IN (SELECT id FROM caregivers);

-- ============================================================================
-- IF NEEDED: DISABLE RLS ON PATIENTS TABLE
-- ============================================================================

-- ALTER TABLE patients DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- IF NEEDED: VERIFY FOREIGN KEY CONSTRAINT
-- ============================================================================

-- Check foreign key constraint on patients table
SELECT 
  constraint_name,
  table_name,
  column_name,
  foreign_table_name,
  foreign_column_name
FROM information_schema.key_column_usage
WHERE table_name = 'patients' AND foreign_table_name IS NOT NULL;
