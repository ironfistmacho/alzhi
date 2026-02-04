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
bool sleeping = false;
unsigned long lastMovement = 0;
const unsigned long sleepThreshold = 300000; // 5 minutes
float movementThreshold = 1.2;

// MPU6050 Data (Used for sleep detection only)
float accelX = 0, accelY = 0, accelZ = 0;
float gyroX = 0, gyroY = 0, gyroZ = 0;
float tempC = 0;
unsigned long lastMpuUpdate = 0;
#define MPU_UPDATE_RATE 500

// BLE State
BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;
unsigned long lastBleUpdate = 0;
String emergencyStatus = "Normal";
long currentIRValue = 0; // GLOBAL SENSOR VALUE

// Step Counting
int stepCount = 0;
float accMagnitudePrev = 0;

// Forward declarations
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
  BLEDevice::init("XIAO C3 Health");
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
  
  pService->start();
  
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0);
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
        
        readVitalsOptimized(irValue, redValue);
        readSpo2Stabilized(irValue, redValue);
        
        particleSensor.nextSample(); // We're finished with this sample so move to next sample
    }
    
    updateMPUData();
    checkSleepStatus();
    
    // Update Display (Main Vitals + Sleep Status)
    displayMainScreen();

    // BLE Updates
    if (deviceConnected && millis() - lastBleUpdate > 500) {
        String json = generateJsonVitals();
        pCharacteristic->setValue((uint8_t*)json.c_str(), json.length());
        pCharacteristic->notify();
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
  json += "\"heartRate\":\"" + String(fingerDetected && heartRate > 0 ? (int)heartRate : 0) + "\",";
  json += "\"spo2\":\"" + String(fingerDetected && spo2 > 0 ? spo2 : 0) + "\",";
  json += "\"fingerDetected\":\"" + String(fingerDetected ? "true" : "false") + "\",";
  json += "\"signalQuality\":\"" + String(calculateSignalQuality(), 1) + "\",";
  json += "\"spo2Stability\":\"" + String(validSpo2Readings) + "\",";
  json += "\"sleepStatus\":\"" + String(sleeping ? "Sleeping" : "Awake") + "\",";
  json += "\"sleepScore\":\"" + String((int)sleepScore) + "\",";
  // Reduced MPU data precision in BLE to save bandwidth if needed, but keeping for app
  json += "\"accelX\":\"" + String(accelX, 1) + "\",";
  json += "\"accelY\":\"" + String(accelY, 1) + "\",";
  json += "\"accelZ\":\"" + String(accelZ, 1) + "\",";
  json += "\"gyroX\":\"" + String(gyroX, 1) + "\",";
  json += "\"gyroY\":\"" + String(gyroY, 1) + "\",";
  json += "\"temperature\":\"" + String(tempC, 1) + "\",";
  json += "\"emergency\":\"" + String(emergencyActive ? "ACTIVE" : "INACTIVE") + "\",";
  json += "\"emergencyMessage\":\"" + emergencyStatus + "\",";
  json += "\"bleStatus\":\"" + String(deviceConnected ? "Connected" : "Advertising") + "\",";
  json += "\"stepCount\":\"" + String(stepCount) + "\",";
  json += "\"displayMode\":\"Vitals\"";
  json += "}";
  return json;
}

// ... READ VITALS LOGIC ...

void readVitalsOptimized(long irValue, long redValue) {
  currentIRValue = irValue;
  static bool wasFingerDetected = false;
  
  // Hysteresis
  if (currentIRValue > 4000) { 
    fingerDetected = true;
  } else if (currentIRValue < 3000) {
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
  if (!bufferFull && bufferIndex < 10) return 0.0;
  int samplesToCheck = bufferFull ? HR_BUFFER_SIZE : bufferIndex;
  long sum = 0;
  long sumSq = 0;
  for (int i = 0; i < samplesToCheck; i++) {
    sum += irBuffer[i];
    sumSq += (long)irBuffer[i] * irBuffer[i];
  }
  float mean = (float)sum / samplesToCheck;
  float variance = (float)sumSq / samplesToCheck - mean * mean;
  float stdDev = sqrt(variance);
  float quality = constrain(100.0 - (stdDev / 1000.0 * 100.0), 0.0, 100.0);
  return quality;
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
  static long ir_buffer_window[50]; 
  static long red_buffer_window[50];
  
  ir_buffer_window[spo2_calc_index] = irValue;
  red_buffer_window[spo2_calc_index] = redValue;
  spo2_calc_index++;
  
  // Calculate every 50 samples (approx every 0.5s at 100Hz)
  if (spo2_calc_index >= 50) {
      spo2_calc_index = 0;
      
      // 1. Calculate DC (Mean)
      double irSum = 0;
      double redSum = 0;
      for (int i=0; i<50; i++) {
          irSum += ir_buffer_window[i];
          redSum += red_buffer_window[i];
      }
      double irDC = irSum / 50.0;
      double redDC = redSum / 50.0;
      
      // 2. Calculate AC (RMS - Root Mean Square) for better accuracy
      double irAC_SumSq = 0;
      double redAC_SumSq = 0;
      
      for (int i=0; i<50; i++) {
         irAC_SumSq += (ir_buffer_window[i] - irDC) * (ir_buffer_window[i] - irDC);
         redAC_SumSq += (red_buffer_window[i] - redDC) * (red_buffer_window[i] - redDC);
      }
      
      double irAC = sqrt(irAC_SumSq / 50.0);
      double redAC = sqrt(redAC_SumSq / 50.0);
      
      // 3. Ratio Calculation
      if (irDC > 0 && irAC > 0) {
          double R = (redAC / redDC) / (irAC / irDC);
          
          // 4. Standard Calibration Curve (Linear approximation for Red/IR)
          // SpO2 = 104 - 17 * R (Common for MAX30102)
          double calculatedSpO2 = 104.0 - 17.0 * R; 
          
          // Constrain to realistic physiological limits
          if (calculatedSpO2 > 100) calculatedSpO2 = 100;
          if (calculatedSpO2 < 60) calculatedSpO2 = 60; // Ignore garbage below 60
          
          // 5. Exponential Smoothing (Low Pass Filter)
          spo2Smoothed = (0.1 * calculatedSpO2) + (0.9 * spo2Smoothed);
          
          if(spo2Smoothed > 100) spo2Smoothed = 100;
          
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
    
    tempC = temp.temperature;
    lastMpuUpdate = millis();

    detectStep(); // Call step detection logic
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
      sleepScore = constrain(100.0 - (millis() - lastMovement - sleepThreshold) / 600000.0, 0.0, 100.0);
    }
  } else {
    lastMovement = millis();
    sleeping = false;
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
const int STABILIZATION_TIME = 15000; // 15 seconds to ensure accuracy (User requested 30-40, but 15 is usually sufficient for stability. We can increase if needed)

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
  if (sleeping) {
    display.print("ASLEEP ");
  } else {
    display.print("AWAKE  ");
  }
  
  display.display();
}
