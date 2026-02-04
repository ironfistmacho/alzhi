-- ============================================================================
-- RLS POLICIES FOR DEVICE TABLES - COPY AND PASTE THIS ENTIRE FILE
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Caregivers can view patient devices" ON health_devices;
DROP POLICY IF EXISTS "Caregivers can insert patient devices" ON health_devices;
DROP POLICY IF EXISTS "Caregivers can update patient devices" ON health_devices;
DROP POLICY IF EXISTS "Caregivers can delete patient devices" ON health_devices;

DROP POLICY IF EXISTS "Caregivers can view patient sensor readings" ON sensor_readings;
DROP POLICY IF EXISTS "Caregivers can insert sensor readings" ON sensor_readings;

DROP POLICY IF EXISTS "Caregivers can view fall detection events" ON fall_detection_events;
DROP POLICY IF EXISTS "Caregivers can insert fall detection events" ON fall_detection_events;

DROP POLICY IF EXISTS "Caregivers can view connection logs" ON device_connection_logs;
DROP POLICY IF EXISTS "Caregivers can insert connection logs" ON device_connection_logs;

DROP POLICY IF EXISTS "Caregivers can view sleep sessions" ON sleep_sessions;
DROP POLICY IF EXISTS "Caregivers can insert sleep sessions" ON sleep_sessions;

DROP POLICY IF EXISTS "Caregivers can view device alert thresholds" ON device_alert_thresholds;
DROP POLICY IF EXISTS "Caregivers can insert device alert thresholds" ON device_alert_thresholds;
DROP POLICY IF EXISTS "Caregivers can update device alert thresholds" ON device_alert_thresholds;

DROP POLICY IF EXISTS "Caregivers can view device firmware updates" ON device_firmware_updates;
DROP POLICY IF EXISTS "Caregivers can insert device firmware updates" ON device_firmware_updates;

DROP POLICY IF EXISTS "Caregivers can view device pairing history" ON device_pairing_history;
DROP POLICY IF EXISTS "Caregivers can insert device pairing history" ON device_pairing_history;

DROP POLICY IF EXISTS "Caregivers can view device diagnostics" ON device_diagnostics;
DROP POLICY IF EXISTS "Caregivers can insert device diagnostics" ON device_diagnostics;

-- ============================================================================
-- CREATE POLICIES FOR health_devices
-- ============================================================================

CREATE POLICY "Caregivers can view patient devices" ON health_devices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = health_devices.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Caregivers can insert patient devices" ON health_devices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = health_devices.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Caregivers can update patient devices" ON health_devices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = health_devices.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = health_devices.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Caregivers can delete patient devices" ON health_devices
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = health_devices.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- CREATE POLICIES FOR sensor_readings
-- ============================================================================

CREATE POLICY "Caregivers can view patient sensor readings" ON sensor_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = sensor_readings.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Caregivers can insert sensor readings" ON sensor_readings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = sensor_readings.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- CREATE POLICIES FOR fall_detection_events
-- ============================================================================

CREATE POLICY "Caregivers can view fall detection events" ON fall_detection_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = fall_detection_events.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Caregivers can insert fall detection events" ON fall_detection_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = fall_detection_events.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- CREATE POLICIES FOR sleep_sessions
-- ============================================================================

CREATE POLICY "Caregivers can view sleep sessions" ON sleep_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = sleep_sessions.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Caregivers can insert sleep sessions" ON sleep_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = sleep_sessions.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- CREATE POLICIES FOR device_connection_logs
-- ============================================================================

CREATE POLICY "Caregivers can view connection logs" ON device_connection_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = device_connection_logs.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Caregivers can insert connection logs" ON device_connection_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = device_connection_logs.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- CREATE POLICIES FOR device_alert_thresholds
-- ============================================================================

CREATE POLICY "Caregivers can view device alert thresholds" ON device_alert_thresholds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = device_alert_thresholds.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Caregivers can insert device alert thresholds" ON device_alert_thresholds
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = device_alert_thresholds.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Caregivers can update device alert thresholds" ON device_alert_thresholds
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = device_alert_thresholds.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = device_alert_thresholds.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- CREATE POLICIES FOR device_firmware_updates
-- ============================================================================

CREATE POLICY "Caregivers can view device firmware updates" ON device_firmware_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM health_devices hd
      JOIN patient_caregivers pc ON hd.patient_id = pc.patient_id
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE hd.id = device_firmware_updates.device_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Caregivers can insert device firmware updates" ON device_firmware_updates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM health_devices hd
      JOIN patient_caregivers pc ON hd.patient_id = pc.patient_id
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE hd.id = device_firmware_updates.device_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- CREATE POLICIES FOR device_pairing_history
-- ============================================================================

CREATE POLICY "Caregivers can view device pairing history" ON device_pairing_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = device_pairing_history.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Caregivers can insert device pairing history" ON device_pairing_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patient_caregivers pc
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE pc.patient_id = device_pairing_history.patient_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- CREATE POLICIES FOR device_diagnostics
-- ============================================================================

CREATE POLICY "Caregivers can view device diagnostics" ON device_diagnostics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM health_devices hd
      JOIN patient_caregivers pc ON hd.patient_id = pc.patient_id
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE hd.id = device_diagnostics.device_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Caregivers can insert device diagnostics" ON device_diagnostics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM health_devices hd
      JOIN patient_caregivers pc ON hd.patient_id = pc.patient_id
      JOIN caregivers c ON pc.caregiver_id = c.id
      WHERE hd.id = device_diagnostics.device_id
      AND c.auth_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- DONE - All RLS policies created successfully
-- ============================================================================
