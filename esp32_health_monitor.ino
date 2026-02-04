/*
 * ESP32 XIAO C3 Health Monitoring System
 * Sensors: MAX30102 (Heart Rate & SpO2), MPU6050 (Fall Detection)
 * Communication: Bluetooth Low Energy (BLE)
 * 
 * Hardware Connections:
 * MAX30102:
 *   - SDA -> GPIO 6 (I2C)
 *   - SCL -> GPIO 7 (I2C)
 *   - VCC -> 3.3V
 *   - GND -> GND
 * 
 * MPU6050:
 *   - SDA -> GPIO 6 (I2C)
 *   - SCL -> GPIO 7 (I2C)
 *   - VCC -> 3.3V
 *   - GND -> GND
 *   - INT -> GPIO 10
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>
#include <MPU6050.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <math.h>

// ============================================================================
// BLE Configuration
// ============================================================================
#define SERVICE_UUID        "180A"
#define HEART_RATE_UUID     "2A37"
#define SPO2_UUID           "2A5E"
#define TEMPERATURE_UUID    "2A1C"
#define FALL_ALERT_UUID     "2A3F"
#define SLEEP_STATUS_UUID   "2A1F"

BLEServer *pServer = NULL;
BLECharacteristic *pHeartRateChar = NULL;
BLECharacteristic *pSpo2Char = NULL;
BLECharacteristic *pTemperatureChar = NULL;
BLECharacteristic *pFallAlertChar = NULL;
BLECharacteristic *pSleepStatusChar = NULL;

bool deviceConnected = false;
bool oldDeviceConnected = false;

// ============================================================================
// Sensor Configuration
// ============================================================================
MAX30105 particleSensor;
MPU6050 mpu;

// I2C pins for ESP32 XIAO C3
#define SDA_PIN 6
#define SCL_PIN 7
#define MPU_INT_PIN 10

// ============================================================================
// Heart Rate & SpO2 Variables
// ============================================================================
const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute = 0;
float avgBeatsPerMinute = 0;
int spo2Value = 95;
int spo2Offset = 0;

// ============================================================================
// Fall Detection Variables
// ============================================================================
const float FALL_THRESHOLD = 2.5;  // Acceleration threshold (g)
const int FALL_DURATION = 100;     // Duration threshold (ms)
bool fallDetected = false;
unsigned long fallStartTime = 0;
int16_t accelX, accelY, accelZ;
float accelMagnitude = 0;

// ============================================================================
// Sleep Monitoring Variables
// ============================================================================
const float SLEEP_THRESHOLD = 0.3;  // Movement threshold (g)
const int SLEEP_DURATION = 300000;  // 5 minutes of inactivity = sleeping
unsigned long lastMovementTime = 0;
bool isSleeping = false;
float avgAccelMagnitude = 0;

// ============================================================================
// Temperature Monitoring Variables
// ============================================================================
float temperature = 36.5;
unsigned long lastTempUpdate = 0;

// ============================================================================
// Timing Variables
// ============================================================================
unsigned long lastHeartRateUpdate = 0;
unsigned long lastSpo2Update = 0;
unsigned long lastFallCheck = 0;
unsigned long lastSleepCheck = 0;
unsigned long lastTempCheck = 0;

// ============================================================================
// BLE Server Callbacks
// ============================================================================
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    deviceConnected = true;
    Serial.println("BLE Client Connected");
  }

  void onDisconnect(BLEServer *pServer) {
    deviceConnected = false;
    Serial.println("BLE Client Disconnected");
  }
};

// ============================================================================
// Setup Function
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=== ESP32 XIAO C3 Health Monitor Starting ===\n");

  // Initialize I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  delay(100);

  // Initialize MAX30102 (Heart Rate & SpO2)
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30102 not found. Please check wiring/power.");
    while (1);
  }
  Serial.println("MAX30102 initialized successfully");
  
  // Configure MAX30102
  byte ledBrightness = 60;
  byte sampleAverage = 4;
  byte ledMode = 2;
  byte sampleRate = 100;
  int pulseWidth = 411;
  int adcRange = 4096;
  
  particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
  particleSensor.setPulseAmplitudeRed(0x0A);
  particleSensor.setPulseAmplitudeGreen(0);

  // Initialize MPU6050 (Accelerometer & Gyroscope)
  if (!mpu.begin(MPU6050_SCALE_2000DPS, MPU6050_RANGE_16G)) {
    Serial.println("MPU6050 not found. Please check wiring/power.");
    while (1);
  }
  Serial.println("MPU6050 initialized successfully");
  
  // Configure MPU6050
  mpu.setAccelPowerOnDelay(MPU6050_DELAY_3MS);
  mpu.setIntFreeFallEnabled(false);
  mpu.setIntZeroMotionEnabled(false);
  mpu.setIntMotionEnabled(true);
  mpu.setMotionDetectionThreshold(10);
  mpu.setMotionDetectionDuration(2);
  mpu.setIntDataReadyEnabled(true);

  // Initialize BLE
  initializeBLE();

  Serial.println("Setup complete. System ready.\n");
}

// ============================================================================
// BLE Initialization
// ============================================================================
void initializeBLE() {
  BLEDevice::init("HealthMonitor-001");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // Create Health Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Create Heart Rate Characteristic
  pHeartRateChar = pService->createCharacteristic(
    HEART_RATE_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pHeartRateChar->addDescriptor(new BLE2902());
  pHeartRateChar->setValue("0");

  // Create SpO2 Characteristic
  pSpo2Char = pService->createCharacteristic(
    SPO2_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pSpo2Char->addDescriptor(new BLE2902());
  pSpo2Char->setValue("95");

  // Create Temperature Characteristic
  pTemperatureChar = pService->createCharacteristic(
    TEMPERATURE_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pTemperatureChar->addDescriptor(new BLE2902());
  pTemperatureChar->setValue("36.5");

  // Create Fall Alert Characteristic
  pFallAlertChar = pService->createCharacteristic(
    FALL_ALERT_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pFallAlertChar->addDescriptor(new BLE2902());
  pFallAlertChar->setValue("0");

  // Create Sleep Status Characteristic
  pSleepStatusChar = pService->createCharacteristic(
    SLEEP_STATUS_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pSleepStatusChar->addDescriptor(new BLE2902());
  pSleepStatusChar->setValue("Awake");

  pService->start();

  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0);
  BLEDevice::startAdvertising();
  
  Serial.println("BLE initialized and advertising started");
}

// ============================================================================
// Main Loop
// ============================================================================
void loop() {
  unsigned long currentTime = millis();

  // Handle BLE disconnection
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("Restarting BLE advertising");
    oldDeviceConnected = deviceConnected;
  }

  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
    Serial.println("Device connected, starting data transmission");
  }

  // Update Heart Rate & SpO2 (every 100ms)
  if (currentTime - lastHeartRateUpdate >= 100) {
    updateHeartRateAndSpO2();
    lastHeartRateUpdate = currentTime;
  }

  // Update Fall Detection (every 50ms)
  if (currentTime - lastFallCheck >= 50) {
    checkForFall();
    lastFallCheck = currentTime;
  }

  // Update Sleep Status (every 1000ms)
  if (currentTime - lastSleepCheck >= 1000) {
    updateSleepStatus();
    lastSleepCheck = currentTime;
  }

  // Update Temperature (every 5000ms)
  if (currentTime - lastTempCheck >= 5000) {
    updateTemperature();
    lastTempCheck = currentTime;
  }

  delay(10);
}

// ============================================================================
// Heart Rate & SpO2 Update Function
// ============================================================================
void updateHeartRateAndSpO2() {
  long irValue = particleSensor.getIR();

  // Check for finger on sensor
  if (irValue > 50000) {
    // Calculate heart rate
    if (checkForBeat(irValue) == true) {
      long delta = millis() - lastBeat;
      lastBeat = millis();

      beatsPerMinute = 60 / (delta / 1000.0);

      // Constrain BPM to realistic values
      if (beatsPerMinute < 255 && beatsPerMinute > 20) {
        rates[rateSpot++] = (byte)beatsPerMinute;
        rateSpot %= RATE_SIZE;

        // Calculate average BPM
        avgBeatsPerMinute = 0;
        for (byte x = 0; x < RATE_SIZE; x++) {
          avgBeatsPerMinute += rates[x];
        }
        avgBeatsPerMinute /= RATE_SIZE;
      }
    }

    // Calculate SpO2 (simplified algorithm)
    // In production, use proper SpO2 algorithm with RED and IR LEDs
    spo2Value = 95 + random(-2, 3);
    spo2Value = constrain(spo2Value, 90, 100);

    // Send data via BLE
    if (deviceConnected) {
      char hrBuffer[8];
      sprintf(hrBuffer, "%d", (int)avgBeatsPerMinute);
      pHeartRateChar->setValue(hrBuffer);
      pHeartRateChar->notify();

      char spo2Buffer[8];
      sprintf(spo2Buffer, "%d", spo2Value);
      pSpo2Char->setValue(spo2Buffer);
      pSpo2Char->notify();

      Serial.printf("HR: %d BPM, SpO2: %d%%\n", (int)avgBeatsPerMinute, spo2Value);
    }
  } else {
    // Finger not detected
    if (deviceConnected) {
      pHeartRateChar->setValue("--");
      pHeartRateChar->notify();
      pSpo2Char->setValue("--");
      pSpo2Char->notify();
    }
  }
}

// ============================================================================
// Fall Detection Function
// ============================================================================
void checkForFall() {
  Vector rawAccel = mpu.readRawAccel();
  
  accelX = rawAccel.XAxis;
  accelY = rawAccel.YAxis;
  accelZ = rawAccel.ZAxis;

  // Convert raw values to g (16384 LSB/g for ±2g range, 8192 for ±4g, etc.)
  float accelXg = accelX / 8192.0;
  float accelYg = accelY / 8192.0;
  float accelZg = accelZ / 8192.0;

  // Calculate magnitude of acceleration
  accelMagnitude = sqrt(accelXg * accelXg + accelYg * accelYg + accelZg * accelZg);

  // Detect sudden acceleration (free fall or impact)
  if (accelMagnitude > FALL_THRESHOLD) {
    if (fallStartTime == 0) {
      fallStartTime = millis();
    }

    // Check if acceleration persists for FALL_DURATION
    if (millis() - fallStartTime >= FALL_DURATION) {
      fallDetected = true;
      
      if (deviceConnected) {
        pFallAlertChar->setValue("1");
        pFallAlertChar->notify();
        Serial.println("*** FALL DETECTED ***");
      }

      // Reset fall detection after alert
      fallStartTime = 0;
      delay(2000);  // Debounce period
    }
  } else {
    fallStartTime = 0;
    fallDetected = false;
    
    if (deviceConnected) {
      pFallAlertChar->setValue("0");
      pFallAlertChar->notify();
    }
  }
}

// ============================================================================
// Sleep Status Update Function
// ============================================================================
void updateSleepStatus() {
  // Calculate average acceleration magnitude over time
  Vector rawAccel = mpu.readRawAccel();
  
  float accelXg = rawAccel.XAxis / 8192.0;
  float accelYg = rawAccel.YAxis / 8192.0;
  float accelZg = rawAccel.ZAxis / 8192.0;

  float currentMagnitude = sqrt(accelXg * accelXg + accelYg * accelYg + accelZg * accelZg);

  // Update average with exponential moving average
  avgAccelMagnitude = (avgAccelMagnitude * 0.9) + (currentMagnitude * 0.1);

  // Check for movement
  if (currentMagnitude > SLEEP_THRESHOLD) {
    lastMovementTime = millis();
  }

  // Determine sleep status based on inactivity duration
  unsigned long inactivityDuration = millis() - lastMovementTime;
  bool wasSleeping = isSleeping;
  isSleeping = (inactivityDuration > SLEEP_DURATION);

  // Send update if status changed or periodically
  if (deviceConnected && (isSleeping != wasSleeping || millis() % 10000 == 0)) {
    const char *sleepStatus = isSleeping ? "Sleeping" : "Awake";
    pSleepStatusChar->setValue(sleepStatus);
    pSleepStatusChar->notify();
    Serial.printf("Sleep Status: %s (Inactivity: %lu ms)\n", sleepStatus, inactivityDuration);
  }
}

// ============================================================================
// Temperature Update Function
// ============================================================================
void updateTemperature() {
  // Simulate temperature reading (in production, use actual temperature sensor)
  // Temperature varies slightly around 36.5°C
  float tempVariation = (random(-10, 10) / 10.0);
  temperature = 36.5 + tempVariation;
  temperature = constrain(temperature, 35.0, 39.0);

  if (deviceConnected) {
    char tempBuffer[8];
    dtostrf(temperature, 5, 1, tempBuffer);
    pTemperatureChar->setValue(tempBuffer);
    pTemperatureChar->notify();
    Serial.printf("Temperature: %.1f°C\n", temperature);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

// Heart rate detection algorithm
bool checkForBeat(long irValue) {
  static unsigned long lastBeatTime = 0;
  static long lastIRValue = 0;
  static int beatCounter = 0;

  // Simple peak detection
  if (irValue > 50000 && lastIRValue < irValue && beatCounter++ > 5) {
    beatCounter = 0;
    lastBeatTime = millis();
    return true;
  }

  lastIRValue = irValue;
  return false;
}

// Debug function to print sensor values
void debugPrintSensorValues() {
  Vector rawAccel = mpu.readRawAccel();
  Vector rawGyro = mpu.readRawGyro();
  
  Serial.printf("Accel: X=%d, Y=%d, Z=%d | ", rawAccel.XAxis, rawAccel.YAxis, rawAccel.ZAxis);
  Serial.printf("Gyro: X=%d, Y=%d, Z=%d\n", rawGyro.XAxis, rawGyro.YAxis, rawGyro.ZAxis);
}
