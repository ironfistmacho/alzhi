#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <algorithm>

// BLE UUIDs
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// Added standard characteristics from health monitor for compatibility
#define HEART_RATE_UUID     "2A37"
#define SPO2_UUID           "2A5E"
#define TEMPERATURE_UUID    "2A1C"
#define FALL_ALERT_UUID     "2A3F"
#define SLEEP_STATUS_UUID   "2A1F"

// OLED Display Configuration
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Brain Logo Bitmap (128x64)
const unsigned char brain_logo [] PROGMEM = {
0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0x87, 0xe1, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xfe, 0x3b, 0xdc, 0x7f, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xfd, 0xb9, 0x9d, 0xbf, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xfb, 0xb1, 0x8d, 0xdf, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xf7, 0xab, 0xd5, 0xef, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xef, 0xab, 0xd5, 0xf7, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xee, 0xed, 0xb7, 0x77, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xcf, 0x1d, 0xb8, 0xf3, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xdc, 0xf9, 0x9f, 0x3b, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xb3, 0xe5, 0xa7, 0xcd, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xb7, 0xef, 0xf7, 0xed, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xaf, 0xdd, 0xbb, 0xf5, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x6f, 0x31, 0x8c, 0xf4, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x0f, 0xe9, 0x97, 0xf0, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x73, 0xdb, 0xdb, 0xce, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x7f, 0xfd, 0xbf, 0xde, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0xff, 0xfd, 0xbf, 0xff, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0xff, 0xc7, 0xe3, 0xff, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0xdc, 0x39, 0x9c, 0x3b, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0x49, 0xf9, 0x9d, 0x92, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0xe3, 0xf3, 0xcf, 0xc7, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0xf7, 0xc3, 0xc3, 0xef, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0xf7, 0xb9, 0x9d, 0xef, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0xf9, 0xbd, 0xbd, 0x9f, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x0f, 0xfd, 0xbf, 0xf0, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x6f, 0xfd, 0xbf, 0xf6, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x77, 0x3d, 0xbc, 0xee, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xb8, 0xbd, 0xbd, 0x1d, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x9d, 0xc1, 0x83, 0xb9, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xe7, 0xfd, 0xbf, 0xe7, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xef, 0xdd, 0xbb, 0xf7, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xef, 0xdd, 0xbb, 0xf7, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xf7, 0x9f, 0xf9, 0xef, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xf8, 0x1d, 0xb8, 0x1f, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xc1, 0x83, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00
};

// MPU6050
Adafruit_MPU6050 mpu;

// MAX30102
MAX30105 particleSensor;

// Emergency Button
#define EMERGENCY_BUTTON_PIN D2
bool emergencyActive = false;
unsigned long lastButtonPress = 0;
const unsigned long debounceDelay = 250;

// Heart rate variables
// Heart rate variables (IBI Filter)
const byte IBI_SIZE = 12;
long ibiHistory[IBI_SIZE];
byte ibiIndex = 0;
long lastBeat = 0;
float smoothedHR = 0;

// Heart rate calculation
#define HR_SAMPLE_RATE 10
#define HR_BUFFER_SIZE 256
uint32_t irBuffer[HR_BUFFER_SIZE];
uint32_t redBuffer[HR_BUFFER_SIZE];
int bufferIndex = 0;
bool bufferFull = false;
unsigned long lastSampleTime = 0;
float smoothedBPM = 0.0;
float alpha = 0.1;

// SpO2 variables
#define SPO2_SAMPLE_RATE 25
#define SPO2_BUFFER_SIZE 100
uint32_t irValues[SPO2_BUFFER_SIZE];
uint32_t redValues[SPO2_BUFFER_SIZE];
int spo2BufferIndex = 0;
float spo2Smoothed = 95.0;
float spo2Alpha = 0.05;
unsigned long lastSpo2Sample = 0;
int validSpo2Readings = 0;
#define MIN_SPO2 70
#define MAX_SPO2 100

// Vitals storage
float heartRate = 0.0;
int spo2 = 0;
bool fingerDetected = false;
unsigned long lastSignalTime = 0;

// Sleep monitoring
float sleepScore = 100.0;
char sleepStage = 'A'; // 'A': Awake, 'L': Light, 'M': Medium, 'D': Deep
bool sleeping = false;
unsigned long lastMovement = 0;
const unsigned long sleepThreshold = 300000; // 5 minutes
float movementThreshold = 1.2;

// MPU6050 Data (Used for sleep detection only)
float accelX = 0, accelY = 0, accelZ = 0;
float gyroX = 0, gyroY = 0, gyroZ = 0;
float tempC = 0;
unsigned long lastMpuUpdate = 0;
#define MPU_UPDATE_RATE 50 // Increased to 50ms (20Hz) for reliable fall/step detection
#define BLE_INTERVAL 1200 // Slowed down for maximum stability during sync debug

// BLE State
BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;

// Separate characteristics for individual vital monitoring
BLECharacteristic *pHeartRateChar = NULL;
BLECharacteristic *pSpo2Char = NULL;
BLECharacteristic *pTemperatureChar = NULL;
BLECharacteristic *pFallAlertChar = NULL;
BLECharacteristic *pSleepStatusChar = NULL;

bool deviceConnected = false;
bool oldDeviceConnected = false;
unsigned long lastBleUpdate = 0;
String emergencyStatus = "Normal";
long currentIRValue = 0; // GLOBAL SENSOR VALUE
byte currentBrightness = 0x60; // Start with medium brightness
unsigned long lastBrightnessAdj = 0;

// Step Counting
int stepCount = 0;
float accMagnitudePrev = 0;

// Fall Detection Variables from health_monitor
const float FALL_THRESHOLD = 2.5;  // Acceleration threshold (g)
const int FALL_DURATION = 100;     // Duration threshold (ms)
bool fallDetected = false;
unsigned long fallStartTime = 0;
float accelMagnitude = 0;

// Forward declarations
void checkForFall();
void readVitalsOptimized(long irValue, long redValue);
void readSpo2Stabilized(long irValue, long redValue);
void updateMPUData();
void checkSleepStatus();
void checkEmergencyButton();
void displayEmergencyScreen();
void displayMainScreen();
bool checkForBeat(long irValue);
float calculateSignalQuality();
void checkEmergencyButton();
void displayEmergencyScreen();
void displayMainScreen();
bool checkForBeat(long irValue);
float calculateSignalQuality();
String generateJsonVitals();
void playBootAnimation(); // Added forward declaration
void detectStep(); // Forward declaration for step detection
void checkForFall(); // Forward declaration for fall detection

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
    }
};

void playBootAnimation() {
  // 1. Fade-in / Reveal Effect
  for (int i = 0; i <= 64; i+=2) {
    display.clearDisplay();
    // Draw only top part of logo to simulate revealing
    display.drawBitmap(0, 0, brain_logo, 128, i, SSD1306_WHITE);
    display.display();
    delay(10);
  }

  // 2. Cyber Scan Effect
  for (int i = 0; i < 64; i += 4) {
    // Draw Logo
    display.clearDisplay();
    display.drawBitmap(0, 0, brain_logo, 128, 64, SSD1306_WHITE);
    
    // Draw scanning line
    display.drawLine(0, i, 128, i, SSD1306_BLACK);
    display.drawLine(0, i+1, 128, i+1, SSD1306_BLACK);
    
    // Draw subtle grid lines
    if(i % 16 == 0) {
      display.drawFastHLine(0, 32, 128, SSD1306_INVERSE);
      display.drawFastVLine(64, 0, 64, SSD1306_INVERSE);
    }
    
    display.display();
    delay(20);
  }
  
  // Restore full logo
  display.clearDisplay();
  display.drawBitmap(0, 0, brain_logo, 128, 64, SSD1306_WHITE);
  display.display();
  delay(200);

  // 3. System Loading Progress Bar
  int barWidth = 100;
  int barHeight = 8;
  int barX = (128 - barWidth) / 2;
  int barY = 50; // Overlay over the bottom of the brain

  // Clear bottom area for text
  display.fillRect(0, 48, 128, 16, SSD1306_BLACK); 
  
  display.setTextSize(1);
  display.setCursor(25, 40);
  display.println("INITIALIZING");
  
  display.drawRect(barX, barY, barWidth, barHeight, SSD1306_WHITE);
  display.display();
  
  for (int i = 0; i < barWidth - 4; i+=5) {
    display.fillRect(barX + 2, barY + 2, i, barHeight - 4, SSD1306_WHITE);
    display.display();
    delay(30);
  }
  
  delay(500);
}

void setup() {
  Serial.begin(115200);
  
  // Initialize I2C with Xiao C3 pins
  Wire.begin(6, 7);  // SDA=6, SCL=7
  
  // Initialize OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
    for (;;);
  }
  
  // ================= BOOT SCREEN =================
  playBootAnimation();
  // ===============================================
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Starting BLE Monitor...");
  display.display();
  delay(1000);
  
  // Initialize MAX30102
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("MAX30102 ERROR");
    display.display();
    while (1);
  }
  
  // MAX30102 Configuration - BOOSTED BRIGHTNESS
  byte ledBrightness = 0x60;  // Increased from 0x1F to 0x60 (approx 12mA -> 30mA)
  byte sampleAverage = 4;
  byte ledMode = 2;
  int sampleRate = 100; // Lowered to 100Hz for better stability and processing time
  int pulseWidth = 411;
  int adcRange = 4096;
  
  particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
  particleSensor.setPulseAmplitudeRed(0x60); // Match new brightness
  particleSensor.setPulseAmplitudeIR(0x60);  // Match new brightness
  particleSensor.enableDIETEMPRDY();
  
  // Initialize MPU6050
  if (!mpu.begin(0x68, &Wire)) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("MPU6050 ERROR");
    display.display();
    while (1);
  }
  
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  
  // Initialize Emergency Button
  pinMode(EMERGENCY_BUTTON_PIN, INPUT_PULLUP);
  
  // Initialize BLE
  BLEDevice::init("XIAO-C3-Health");
  BLEDevice::setMTU(512); // Accept larger packets for long JSON strings
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  
  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ   |
                      BLECharacteristic::PROPERTY_NOTIFY |
                      BLECharacteristic::PROPERTY_INDICATE
                    );
  
  pCharacteristic->addDescriptor(new BLE2902());
  
  // Create Individual Characteristics from health_monitor
  pHeartRateChar = pService->createCharacteristic(HEART_RATE_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pHeartRateChar->addDescriptor(new BLE2902());
  
  pSpo2Char = pService->createCharacteristic(SPO2_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pSpo2Char->addDescriptor(new BLE2902());
  
  pTemperatureChar = pService->createCharacteristic(TEMPERATURE_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pTemperatureChar->addDescriptor(new BLE2902());
  
  pFallAlertChar = pService->createCharacteristic(FALL_ALERT_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pFallAlertChar->addDescriptor(new BLE2902());
  
  pSleepStatusChar = pService->createCharacteristic(SLEEP_STATUS_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pSleepStatusChar->addDescriptor(new BLE2902());
  
  pService->start();
  
  // Also start a standard Device Info service (180A) for generic compatibility
  BLEService *pInfoService = pServer->createService(BLEUUID((uint16_t)0x180A));
  BLECharacteristic *pModelChar = pInfoService->createCharacteristic(BLEUUID((uint16_t)0x2A24), BLECharacteristic::PROPERTY_READ);
  pModelChar->setValue("XIAO-C3-Health");
  pInfoService->start();
  
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->addServiceUUID(BLEUUID((uint16_t)0x180A));
  
  // Explicitly set advertisement data to include the name
  // This helps Android devices identify the device before connecting
  BLEAdvertisementData advData;
  advData.setFlags(0x06); // General Discoverable & BR_EDR_Not_Supported
  advData.setName("XIAO-C3-Health");
  pAdvertising->setAdvertisementData(advData);
  
  // Scan Response can contain the Service UUID to keep main packet small
  BLEAdvertisementData resData;
  resData.setCompleteServices(BLEUUID(SERVICE_UUID));
  pAdvertising->setScanResponseData(resData);
  
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // functions that help with iPhone connections
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("BLE Active");
  display.println("Place finger on");
  display.println("sensor...");
  display.display();
  delay(1000);
  
  // Initialize arrays
  for (int i = 0; i < IBI_SIZE; i++) ibiHistory[i] = 0;
  for (int i = 0; i < HR_BUFFER_SIZE; i++) {
    irBuffer[i] = 0;
    redBuffer[i] = 0;
  }
}

void loop() {
  checkEmergencyButton();
  
  if (emergencyActive) {
    displayEmergencyScreen();
    // Still send data during emergency
    if (deviceConnected && millis() - lastBleUpdate > 200) {
        String json = generateJsonVitals();
        pCharacteristic->setValue((uint8_t*)json.c_str(), json.length());
        pCharacteristic->notify();
        lastBleUpdate = millis();
    }
  } else {
    // Process ALL available samples from the sensor to ensure we don't miss beats
    particleSensor.check(); // Check the sensor for new data
    
    while (particleSensor.available()) {
        long irValue = particleSensor.getFIFOIR();
        long redValue = particleSensor.getFIFORed();
        
        currentIRValue = irValue; // Update global for display logic
        
        // --- AUTO-BRIGHTNESS CONTROL ---
        // Range: 50,000 to 100,000 is ideal for 18-bit MAX30102
        if (millis() - lastBrightnessAdj > 500) {
            if (currentIRValue > 110000 && currentBrightness > 0x01) {
                currentBrightness -= 5;
                particleSensor.setPulseAmplitudeIR(currentBrightness);
                particleSensor.setPulseAmplitudeRed(currentBrightness);
                lastBrightnessAdj = millis();
            } else if (currentIRValue < 40000 && currentBrightness < 0xFF) {
                currentBrightness += 5;
                particleSensor.setPulseAmplitudeIR(currentBrightness);
                particleSensor.setPulseAmplitudeRed(currentBrightness);
                lastBrightnessAdj = millis();
            }
        }

        readVitalsOptimized(irValue, redValue);
        readSpo2Stabilized(irValue, redValue);
        
        particleSensor.nextSample(); // We're finished with this sample so move to next sample
    }
    
    updateMPUData();
    checkForFall(); // Added fall detection check
    checkSleepStatus();
    
    // Update Display (Main Vitals + Sleep Status)
    displayMainScreen();

    // BLE Updates
    if (deviceConnected && millis() - lastBleUpdate > 500) {
        String json = generateJsonVitals();
        pCharacteristic->setValue((uint8_t*)json.c_str(), json.length());
        pCharacteristic->notify();
        
        // Update individual characteristics for health monitor compatibility
        char buf[16];
        
        // Heart Rate
        sprintf(buf, "%d", (int)heartRate);
        pHeartRateChar->setValue(buf);
        pHeartRateChar->notify();
        
        // SpO2
        sprintf(buf, "%d", (int)spo2);
        pSpo2Char->setValue(buf);
        pSpo2Char->notify();
        
        // Temperature
        dtostrf(tempC, 4, 1, buf);
        pTemperatureChar->setValue(buf);
        pTemperatureChar->notify();
        
        // Fall Alert
        pFallAlertChar->setValue(emergencyActive ? "1" : "0");
        pFallAlertChar->notify();
        
        // Sleep Status
        String stageName = "Awake";
        if (sleepStage == 'D') stageName = "Deep Sleep";
        else if (sleepStage == 'M') stageName = "Medium Sleep";
        else if (sleepStage == 'L') stageName = "Light Sleep";
        pSleepStatusChar->setValue(stageName.c_str());
        pSleepStatusChar->notify();
        
        lastBleUpdate = millis();
    }
  }
  
  // BLE Connection management
  if (!deviceConnected && oldDeviceConnected) {
      delay(500); 
      pServer->startAdvertising(); 
      oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
      oldDeviceConnected = deviceConnected;
  }
  

}

// Generate JSON string
String generateJsonVitals() {
  String json = "{";
  json += "\"hr\":" + String(fingerDetected && heartRate > 0 ? (int)heartRate : 0) + ",";
  json += "\"ox\":" + String(fingerDetected && spo2 > 0 ? spo2 : 0) + ",";
  json += "\"fd\":" + String(fingerDetected ? 1 : 0) + ",";
  json += "\"sq\":" + String(calculateSignalQuality(), 0) + ",";
  json += "\"sl\":\"" + String(sleepStage) + "\",";
  json += "\"ss\":" + String((int)sleepScore) + ",";
  json += "\"ax\":" + String(accelX, 1) + ",";
  json += "\"ay\":" + String(accelY, 1) + ",";
  json += "\"az\":" + String(accelZ, 1) + ",";
  json += "\"tp\":" + String(tempC, 1) + ",";
  json += "\"em\":" + String(emergencyActive ? 1 : 0) + ",";
  json += "\"sc\":" + String(stepCount);
  json += "}";
  return json;
}

// ... READ VITALS LOGIC ...

void readVitalsOptimized(long irValue, long redValue) {
  currentIRValue = irValue;
  static bool wasFingerDetected = false;
  
  // Hysteresis
  // Hysteresis - Adjusted for 18-bit ADC (MAX30102 range)
  // Higher threshold ensures we have a solid signal before processing
  if (currentIRValue > 30000) { 
    fingerDetected = true;
  } else if (currentIRValue < 15000) {
    fingerDetected = false;
  }
  
  // Reset logic on new finger press
  if (fingerDetected && !wasFingerDetected) {
     for(int i=0; i<IBI_SIZE; i++) ibiHistory[i] = 0; // Reset history
     ibiIndex = 0;
     lastBeat = millis(); // Reset timing
     heartRate = 0;
     smoothedHR = 0;
  }
  wasFingerDetected = fingerDetected;
  
  if (fingerDetected) {
    // SpO2 Buffer Logic
    if (millis() - lastSampleTime >= HR_SAMPLE_RATE) {
      if (bufferIndex < HR_BUFFER_SIZE) {
        irBuffer[bufferIndex] = irValue;
        redBuffer[bufferIndex] = redValue;
        bufferIndex++;
      } else {
        bufferIndex = 0;
        bufferFull = true;
      }
      lastSampleTime = millis();
    }
    
    // --- ADVANCED IBI HEART RATE ALGORITHM ---
    if (checkForBeat(currentIRValue) == true) {
       long delta = millis() - lastBeat;
       lastBeat = millis();
       
       // 1. Initial Range Validation (30 - 220 BPM)
       if (delta > 270 && delta < 2000) {
           
           ibiHistory[ibiIndex++] = delta;
           ibiIndex %= IBI_SIZE;
           
           // 2. Median Filtering
           // Sort a copy of history to find median
           long sortedIBI[IBI_SIZE];
           int validCount = 0;
           
           // Copy only non-zero values
           for(int i=0; i<IBI_SIZE; i++) {
               if(ibiHistory[i] > 0) sortedIBI[validCount++] = ibiHistory[i];
           }
           
           if(validCount > 4) { // Only calculate if we have enough history
               std::sort(sortedIBI, sortedIBI + validCount);
               long medianIBI = sortedIBI[validCount/2];
               
               // 3. Consensus Filtering
               // Average only values close to the median (Reject missed beats/noise)
               long sumIBI = 0;
               int consensusCount = 0;
               long tolerance = medianIBI * 0.25; // 25% tolerance
               
               for(int i=0; i<validCount; i++) {
                   if (abs(sortedIBI[i] - medianIBI) < tolerance) {
                       sumIBI += sortedIBI[i];
                       consensusCount++;
                   }
               }
               
               if (consensusCount > 0) {
                   long avgIBI = sumIBI / consensusCount;
                   float instantBPM = 60000.0 / avgIBI;
                   
                   // 4. Smooth Decay
                   if (smoothedHR == 0) smoothedHR = instantBPM;
                   else smoothedHR = (smoothedHR * 0.9) + (instantBPM * 0.1);
                   
                   heartRate = smoothedHR;
               }
           }
       }
    }
    
    if (millis() - lastSignalTime > 2000) {
      lastSignalTime = millis();
    }
    
  } else {
    // No Finger
    heartRate = 0;
    smoothedHR = 0;
    bufferIndex = 0;
    bufferFull = false;
  }
}


float calculateSignalQuality() {
  if (!bufferFull && bufferIndex < 20) return 0.0;
  int samplesToCheck = bufferFull ? HR_BUFFER_SIZE : bufferIndex;
  
  // 1. Calculate DC and AC components
  double sumIR = 0;
  for (int i = 0; i < samplesToCheck; i++) sumIR += irBuffer[i];
  double meanIR = sumIR / samplesToCheck;
  
  if (meanIR < 1000) return 0.0; // No real signal

  double sumSqDiff = 0;
  for (int i = 0; i < samplesToCheck; i++) {
    double diff = (double)irBuffer[i] - meanIR;
    sumSqDiff += diff * diff;
  }
  
  float stdDev = sqrt(sumSqDiff / samplesToCheck);
  
  // A good pulse signal has an AC component between 0.5% and 3% of DC
  // stdDev (RMS AC) / Mean (DC) * 100 = % Modulation
  float modulation = (stdDev / meanIR) * 100.0;
  
  // Reward modulation between 0.5% and 2.5%
  float quality = 0;
  if (modulation > 0.1 && modulation < 5.0) {
      if (modulation >= 0.5 && modulation <= 2.5) quality = 100.0;
      else if (modulation < 0.5) quality = (modulation / 0.5) * 100.0;
      else quality = (1.0 - (modulation - 2.5) / 2.5) * 100.0;
  }
  
  return constrain(quality, 0.0, 100.0);
}

// ... SPO2 LOGIC ...
void readSpo2Stabilized(long irValue, long redValue) {
  if (!fingerDetected) {
    spo2 = 0;
    spo2Smoothed = 0;
    validSpo2Readings = 0;
    return;
  }
  
  // High-frequency sampling buffer
  static int spo2_calc_index = 0;
  #define SPO2_WINDOW_SIZE 100 // Increased from 50 for better stability
  static long ir_buffer_window[SPO2_WINDOW_SIZE]; 
  static long red_buffer_window[SPO2_WINDOW_SIZE];
  
  ir_buffer_window[spo2_calc_index] = irValue;
  red_buffer_window[spo2_calc_index] = redValue;
  spo2_calc_index++;
  
  // Calculate every window size (approx every 1s at 100Hz)
  if (spo2_calc_index >= SPO2_WINDOW_SIZE) {
      spo2_calc_index = 0;
      
      // Update Temperature from MAX30102
      // Adding a +4.0C offset (typical skin-to-core differential) for better accuracy
      tempC = particleSensor.readTemperature() + 4.0;
      
      // 1. Calculate DC (Mean)
      double irSum = 0;
      double redSum = 0;
      for (int i=0; i<SPO2_WINDOW_SIZE; i++) {
          irSum += ir_buffer_window[i];
          redSum += red_buffer_window[i];
      }
      double irDC = irSum / (double)SPO2_WINDOW_SIZE;
      double redDC = redSum / (double)SPO2_WINDOW_SIZE;
      
      double irAC_SumSq = 0;
      double redAC_SumSq = 0;
      
      // Calculate AC components by removing DC and summing squares
      // Using a smaller window or high-pass filter logic conceptually
      for (int i=0; i<SPO2_WINDOW_SIZE; i++) {
         double irDelta = (double)ir_buffer_window[i] - irDC;
         double redDelta = (double)red_buffer_window[i] - redDC;
         irAC_SumSq += irDelta * irDelta;
         redAC_SumSq += redDelta * redDelta;
      }
      
      // RMS AC calculation
      double irAC = sqrt(irAC_SumSq / (double)SPO2_WINDOW_SIZE);
      double redAC = sqrt(redAC_SumSq / (double)SPO2_WINDOW_SIZE);

      // Low signal safety check: AC must be at least 0.1% of DC
      bool irValid = (irAC / irDC) > 0.001;
      bool redValid = (redAC / redDC) > 0.001;
      
      // 3. Ratio Calculation
      if (irDC > 0 && irAC > 0 && irValid && redValid) {
          double R = (redAC / redDC) / (irAC / irDC);
          
          // 4. Improved Calibration Curve (Quadratic approximation)
          // Based on clinical research for MAX3010x sensors
          // SpO2 = -45.060*R*R + 30.354*R + 94.845
          double calculatedSpO2 = -45.060 * R * R + 30.354 * R + 94.845;
          
          // Constrain to realistic physiological limits
          if (calculatedSpO2 > 100) calculatedSpO2 = 100;
          if (calculatedSpO2 < 60) calculatedSpO2 = 60; 
          
          // 5. Exponential Smoothing (Low Pass Filter)
          if (spo2Smoothed == 0) spo2Smoothed = calculatedSpO2;
          else spo2Smoothed = (0.15 * calculatedSpO2) + (0.85 * spo2Smoothed);
          
          spo2 = (int)spo2Smoothed;
          validSpo2Readings++;
      }
  }
}

// Keep updateMPUData (unchanged)
void updateMPUData() {
  if (millis() - lastMpuUpdate >= MPU_UPDATE_RATE) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    
    accelX = 0.7 * accelX + 0.3 * a.acceleration.x;
    accelY = 0.7 * accelY + 0.3 * a.acceleration.y;
    accelZ = 0.7 * accelZ + 0.3 * a.acceleration.z;
    
    gyroX = 0.7 * gyroX + 0.3 * g.gyro.x;
    gyroY = 0.7 * gyroY + 0.3 * g.gyro.y;
    gyroZ = 0.7 * gyroZ + 0.3 * g.gyro.z;
    
    // tempC is now updated from MAX30102 in readSpo2Stabilized()
    lastMpuUpdate = millis();

    // Call detectStep more frequently than display update if needed
    // But MPU_UPDATE_RATE is currently 500ms which is TOO SLOW for fall/steps
    // Moving it to 50ms is better.
    detectStep(); 
  }
}

// Fall Detection logic from health_monitor
void checkForFall() {
  // Convert acceleration to g
  float accelXg = accelX / 9.81;
  float accelYg = accelY / 9.81;
  float accelZg = accelZ / 9.81;

  // Calculate magnitude of acceleration
  accelMagnitude = sqrt(accelXg * accelXg + accelYg * accelYg + accelZg * accelZg);

  // Detect sudden acceleration (free fall or impact)
  if (accelMagnitude > FALL_THRESHOLD) {
    if (fallStartTime == 0) {
      fallStartTime = millis();
    }

    // Check if acceleration persists for FALL_DURATION
    if (millis() - fallStartTime >= FALL_DURATION) {
      if (!emergencyActive) {
          emergencyActive = true;
          emergencyStatus = "FALL DETECTED!";
          Serial.println("*** FALL DETECTED ***");
      }
      fallStartTime = 0;
    }
  } else {
    fallStartTime = 0;
  }
}

void detectStep() {
  // Convert m/s^2 to Gs (approximate)
  float accX_G = accelX / 9.81;
  float accY_G = accelY / 9.81;
  float accZ_G = accelZ / 9.81;

  // Calculate the magnitude of acceleration in Gs
  float accMagnitude = sqrt(accX_G * accX_G + accY_G * accY_G + accZ_G * accZ_G);
  
  // Peak detection (from Step-Sense logic)
  if (accMagnitudePrev > accMagnitude + 0.1 && accMagnitudePrev > 1.5) {
    stepCount++;
  }
  accMagnitudePrev = accMagnitude;
}

void checkSleepStatus() {
  float movement = sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
  static float baselineMovement = 9.81; 
  static unsigned long lastBaselineUpdate = 0;
  
  if (millis() - lastBaselineUpdate > 10000) { 
    baselineMovement = 0.9 * baselineMovement + 0.1 * movement;
    lastBaselineUpdate = millis();
  }
  
  float relativeMovement = abs(movement - baselineMovement);
  
  if (relativeMovement < movementThreshold) {
    if (lastMovement == 0) {
      lastMovement = millis();
    } else if (millis() - lastMovement > sleepThreshold) {
      sleeping = true;
      
      // Classify stage based on movement intensity
      if (relativeMovement < 0.4) sleepStage = 'D'; // Deep
      else if (relativeMovement < 0.8) sleepStage = 'M'; // Medium
      else sleepStage = 'L'; // Light
      
      sleepScore = constrain(100.0 - (millis() - lastMovement - sleepThreshold) / 600000.0, 0.0, 100.0);
    }
  } else {
    lastMovement = millis();
    sleeping = false;
    sleepStage = 'A'; // Awake
    sleepScore = 100.0;
  }
}

void checkEmergencyButton() {
  int buttonState = digitalRead(EMERGENCY_BUTTON_PIN);
  
  if (buttonState == LOW) {
    unsigned long currentTime = millis();
    if (currentTime - lastButtonPress > debounceDelay) {
      emergencyActive = !emergencyActive;
      lastButtonPress = currentTime;
      
      if (emergencyActive) {
        emergencyStatus = "EMERGENCY! Patient needs assistance!";
      } else {
        emergencyStatus = "Normal";
      }
    }
  }
}

void displayEmergencyScreen() {
  static bool blinkState = false;
  static unsigned long lastBlink = 0;
  
  if (millis() - lastBlink > 500) {
    blinkState = !blinkState;
    lastBlink = millis();
  }
  
  if (blinkState) {
    display.clearDisplay();
    display.setTextSize(2);
    display.setCursor(15, 0);
    display.println("EMERGENCY!");
    display.setTextSize(3);
    display.setCursor(20, 20);
    display.println("! ! !");
    display.setTextSize(1);
    display.setCursor(5, 45);
    display.println("PATIENT NEEDS");
    display.setCursor(15, 55);
    display.println("ASSISTANCE!");
    display.display();
  } else {
    display.clearDisplay();
    display.display();
  }
}

// Measurement State
unsigned long stableSignalStartTime = 0;
bool isMeasuring = false;
bool badPlacement = false;
bool noisySignal = false;
const int STABILIZATION_TIME = 30000; // Increased to 30 seconds for higher accuracy (clinical standard for pulse ox stability)

void displayMainScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("VITALS");
  display.setCursor(90, 0);
  
  if (deviceConnected) {
    display.print("BLE On");
  } else {
    display.print("Wait..");
  }
  
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
  
  if (!fingerDetected) {
     display.setCursor(15, 25);
     display.setTextSize(1);
     display.println("NO FINGER DETECTED");
     display.setCursor(35, 40);
     display.println("Try Again");
     // Debug: show value so user knows if sensor is alive
     display.setCursor(40, 50);
     display.print("v:"); display.print(currentIRValue); 
     
     isMeasuring = false;
     stableSignalStartTime = 0;
  } else {
      // Finger is detected, check quality using GLOBAL value
      // Do NOT read sensor here, use currentIRValue populated in loop
      
      float sigQuality = calculateSignalQuality();
      
      // 1. Check Contact Pressure (IR Amplitude)
      if (currentIRValue < 5000) { // Threshold for "Weak Signal" aligned with detection
         badPlacement = true;
         stableSignalStartTime = millis(); 
      } else {
         badPlacement = false;
      }

      // 2. Check Noise/Motion
      if (!badPlacement && sigQuality < 20.0 && bufferFull) {
        noisySignal = true;
      } else {
        noisySignal = false;
      }

      // Display Logic
      if (badPlacement) {
         display.setCursor(25, 25);
         display.setTextSize(1);
         display.println("WEAK SIGNAL");
         display.setCursor(15, 40);
         display.println("Press Harder");
         display.setCursor(40, 50);
         display.print("v:"); display.print(currentIRValue); 
      } 
      else if (noisySignal) {
         display.setCursor(25, 25);
         display.setTextSize(1);
         display.println("MOTION DETECTED");
         display.setCursor(20, 40);
         display.println("Keep Still");
         stableSignalStartTime = millis(); 
      }
      else {
         // Signal is good!
         unsigned long currentStableTime = millis() - stableSignalStartTime;
         
         if (stableSignalStartTime == 0) stableSignalStartTime = millis(); 
         
         if (currentStableTime < STABILIZATION_TIME) {
            // ANALYZING PHASE
            display.setCursor(30, 25);
            display.setTextSize(1);
            display.println("ANALYZING...");
            
            int barWidth = 100;
            int progress = map(currentStableTime, 0, STABILIZATION_TIME, 0, barWidth);
            display.drawRect(14, 40, barWidth, 8, SSD1306_WHITE);
            display.fillRect(16, 42, progress - 4, 4, SSD1306_WHITE);
         } 
         else {
            // SHOW RESULTS PHASE (Stable)
            // HR
            display.setCursor(0, 15);
            display.print("HR:");
            display.setTextSize(2);
            
            if (heartRate > 0) {
              display.print(" ");
              if (heartRate < 100) display.print(" ");
              display.print((int)heartRate);
              display.setTextSize(1);
              display.print(" BPM");
            } else {
              display.setTextSize(2);
              display.print(" ---");
              display.setTextSize(1);
              display.print(" BPM");
            }
            
            // SpO2
            display.setTextSize(1);
            display.setCursor(0, 35);
            display.print("SpO2:");
            display.setTextSize(2);
            
            if (spo2 > 0) {
              display.print(" ");
              if (spo2 < 100) display.print(" ");
              display.print(spo2);
              display.setTextSize(1);
              display.print(" %");
            } else {
              display.setTextSize(2);
              display.print(" ---");
              display.setTextSize(1);
              display.print(" %");
            }
         }
      }
  }
  
  display.setTextSize(1);
  display.setCursor(0, 55);
  display.print("Status: ");
  if (sleepStage == 'D') display.print("DEEP SLEEP");
  else if (sleepStage == 'M') display.print("MED SLEEP ");
  else if (sleepStage == 'L') display.print("LIGHT SLP ");
  else display.print("AWAKE     ");
  
  display.display();
}
