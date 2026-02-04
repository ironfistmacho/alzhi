-- Add Blood Glucose columns to patient_vitals
ALTER TABLE patient_vitals 
ADD COLUMN IF NOT EXISTS blood_glucose DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS glucose_context VARCHAR(50); -- e.g., 'before_food', 'after_food', 'fasting'

-- Update comments
COMMENT ON COLUMN patient_vitals.blood_glucose IS 'Blood glucose level in mg/dL or mmol/L';
COMMENT ON COLUMN patient_vitals.glucose_context IS 'Context of glucose measurement (e.g., before/after food)';
