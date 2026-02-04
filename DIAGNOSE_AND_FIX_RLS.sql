-- ============================================================================
-- DIAGNOSE AND FIX RLS ISSUE
-- Run this step by step to identify and fix the problem
-- ============================================================================

-- ============================================================================
-- STEP 1: CHECK YOUR CURRENT USER ID
-- ============================================================================

-- Run this first to see your auth user ID
SELECT auth.uid() as your_user_id;

-- ============================================================================
-- STEP 2: CHECK IF YOU HAVE A CAREGIVER RECORD
-- ============================================================================

-- Run this to see if you're registered as a caregiver
SELECT id, auth_id, first_name, last_name, email 
FROM caregivers 
WHERE auth_id = auth.uid();

-- If NO rows returned: You need to create a caregiver account first
-- If rows returned: Copy the caregiver ID (first column) for next steps

-- ============================================================================
-- STEP 3: CHECK YOUR PATIENTS
-- ============================================================================

-- Run this to see all your patients
SELECT id, first_name, last_name, caregiver_id 
FROM patients 
LIMIT 10;

-- Copy a patient ID for next steps

-- ============================================================================
-- STEP 4: CHECK IF CAREGIVER IS ASSIGNED TO PATIENT
-- ============================================================================

-- Replace PATIENT_ID_HERE with actual patient ID from Step 3
SELECT pc.id, pc.patient_id, pc.caregiver_id, p.first_name, p.last_name
FROM patient_caregivers pc
JOIN patients p ON pc.patient_id = p.id
WHERE pc.patient_id = 'PATIENT_ID_HERE';

-- If NO rows returned: Caregiver is NOT assigned to patient (THIS IS THE PROBLEM)
-- If rows returned: Assignment exists, problem is elsewhere

-- ============================================================================
-- STEP 5: FIX - ASSIGN CAREGIVER TO PATIENT
-- ============================================================================

-- If Step 4 returned NO rows, run this to assign caregiver to patient
-- Replace the values with your actual IDs from Steps 2 and 3

INSERT INTO patient_caregivers (patient_id, caregiver_id, role, permissions)
VALUES (
  'PATIENT_ID_FROM_STEP_3',
  'CAREGIVER_ID_FROM_STEP_2',
  'caregiver',
  '{"view_vitals": true, "view_location": true, "manage_alerts": true}'
);

-- ============================================================================
-- EXAMPLE WITH REAL UUIDs (replace with your actual IDs)
-- ============================================================================

-- Example:
-- INSERT INTO patient_caregivers (patient_id, caregiver_id, role, permissions)
-- VALUES (
--   '550e8400-e29b-41d4-a716-446655440000',
--   '550e8400-e29b-41d4-a716-446655440001',
--   'caregiver',
--   '{"view_vitals": true, "view_location": true, "manage_alerts": true}'
-- );

-- ============================================================================
-- STEP 6: VERIFY THE FIX
-- ============================================================================

-- Run this to verify caregiver is now assigned to patient
SELECT pc.id, pc.patient_id, pc.caregiver_id, p.first_name, p.last_name
FROM patient_caregivers pc
JOIN patients p ON pc.patient_id = p.id
WHERE pc.patient_id = 'PATIENT_ID_FROM_STEP_3';

-- Should return 1 row now

-- ============================================================================
-- STEP 7: TEST RLS POLICY
-- ============================================================================

-- Run this to test if the RLS policy allows insert
SELECT CASE 
  WHEN EXISTS (
    SELECT 1 FROM patient_caregivers pc
    JOIN caregivers c ON pc.caregiver_id = c.id
    WHERE pc.patient_id = 'PATIENT_ID_FROM_STEP_3'
    AND c.auth_id = auth.uid()
  ) THEN 'RLS POLICY ALLOWS INSERT ✅'
  ELSE 'RLS POLICY BLOCKS INSERT ❌'
END as rls_status;

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If you have multiple patients, check all assignments:
SELECT pc.id, pc.patient_id, pc.caregiver_id, p.first_name, p.last_name, c.email
FROM patient_caregivers pc
JOIN patients p ON pc.patient_id = p.id
JOIN caregivers c ON pc.caregiver_id = c.id
ORDER BY p.first_name;

-- If caregiver doesn't exist, create one:
-- Note: This requires auth setup, usually done through signup
-- Contact support if you can't create caregiver account

-- ============================================================================
-- COMMON ISSUES AND SOLUTIONS
-- ============================================================================

-- Issue 1: "No caregiver found for my auth_id"
-- Solution: You need to sign up / create account first in the app

-- Issue 2: "Caregiver exists but no patient_caregivers record"
-- Solution: Run the INSERT statement in STEP 5 above

-- Issue 3: "Still getting RLS error after assignment"
-- Solution: 
--   a) Refresh your app (logout and login)
--   b) Check if you're using the same email for auth
--   c) Verify patient_caregivers record was created

-- ============================================================================
-- END OF DIAGNOSTIC SCRIPT
-- ============================================================================
