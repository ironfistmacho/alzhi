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
#include <math.h>

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
0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0x87, 0xe1, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xfe, 0x3b, 0xdc, 0x7f, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xfd, 0xb9, 0x9d, 0xbf, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xfb, 0xb1, 0x8d, 0xdf, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xf7, 0xab, 0xd5, 0xef, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xef, 0xab, 0xd5, 0xf7, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xee, 0xed, 0xb7, 0x77, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xcf, 0x1d, 0xb8, 0xf3, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xdc, 0xf9, 0x9f, 0x3b, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xb3, 0xe5, 0xa7, 0xcd, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xb7, 0xef, 0xf7, 0xed, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xaf, 0xdd, 0xbb, 0xf5, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x6f, 0x31, 0x8c, 0xf4, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x0f, 0xe9, 0x97, 0xf0, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x73, 0xdb, 0xdb, 0xce, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x7f, 0xfd, 0xbf, 0xde, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0xff, 0xfd, 0xbf, 0xff, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0xff, 0xc7, 0xe3, 0xff, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0xdc, 0x39, 0x9c, 0x3b, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0x49, 0xf9, 0x9d, 0x92, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0xe3, 0xf3, 0xcf, 0xc7, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0xf7, 0xc3, 0xc3, 0xef, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0xf7, 0xb9, 0x9d, 0xef, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xfe, 0xf9, 0xbd, 0xbd, 0x9f, 0x7f, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x0f, 0xfd, 0xbf, 0xf0, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x6f, 0xfd, 0xbf, 0xf6, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x77, 0x3d, 0xbc, 0xee, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xb8, 0xbd, 0xbd, 0x1d, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0x9d, 0xc1, 0x83, 0xb9, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xe7, 0xfd, 0xbf, 0xe7, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xef, 0xdd, 0xbb, 0xf7, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xef, 0xdd, 0xbb, 0xf7, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xf7, 0x9f, 0xf9, 0xef, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xf8, 0x1d, 0xb8, 0x1f, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xc1, 0x83, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x3f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x00, 0x00};

// MPU6050
Adafruit_MPU6050 mpu;

// MAX30102
MAX30105 particleSensor;

// Emergency Button
#define EMERGENCY_BUTTON_PIN D2
bool emergencyActive = false;
unsigned long lastButtonPress = 0;
const unsigned long debounceDelay = 250;

// BLE Reset Button
#define BLE_RESET_PIN D3

// ==============================================
// MEDICAL-GRADE CONFIGURATION
// ==============================================

// Heart Rate Configuration
#define HR_SAMPLE_RATE 100          // 100Hz sampling (medical standard)
#define HR_BUFFER_SIZE 512          // 5.12 seconds of data for FFT
#define MIN_HR 30                   // Minimum valid heart rate
#define MAX_HR 220                  // Maximum valid heart rate

// SpO2 Configuration
#define SPO2_CAL_HRATIO 0.5         // Calibration for 100% SpO2
#define SPO2_CAL_LRATIO 3.4         // Calibration for 0% SpO2
#define MIN_SPO2 70
#define MAX_SPO2 100

// Signal Quality
#define MIN_SIGNAL_AMPLITUDE 2000   // Minimum PPG amplitude
#define MIN_SNR 10                  // Minimum SNR in dB

// Measurement Stabilization
#define STABILIZATION_TIME_HR 15000  // 15 seconds for HR stabilization
#define STABILIZATION_TIME_SPO2 20000 // 20 seconds for SpO2 stabilization

// ==============================================
// ADVANCED FILTERING CLASSES
// ==============================================

// Kalman Filter Class
class KalmanFilter {
private:
    float Q = 0.01;
    float R = 0.1;
    float P = 1.0;
    float K = 0.0;
    float X = 0.0;
    
public:
    float update(float measurement) {
        P = P + Q;
        K = P / (P + R);
        X = X + K * (measurement - X);
        P = (1 - K) * P;
        return X;
    }
    
    void setParameters(float q, float r) {
        Q = q;
        R = r;
    }
    
    void reset() {
        P = 1.0;
        K = 0.0;
        X = 0.0;
    }
};

// Moving Median Filter
class MovingMedianFilter {
private:
    float buffer[5];
    int index = 0;
    
public:
    float update(float value) {
        buffer[index] = value;
        index = (index + 1) % 5;
        
        float sorted[5];
        for(int i = 0; i < 5; i++) sorted[i] = buffer[i];
        for(int i = 0; i < 4; i++) {
            for(int j = i+1; j < 5; j++) {
                if(sorted[i] > sorted[j]) {
                    float temp = sorted[i];
                    sorted[i] = sorted[j];
                    sorted[j] = temp;
                }
            }
        }
        return sorted[2];
    }
};

// ==============================================
// GLOBAL VARIABLES
// ==============================================

long irBuffer[HR_BUFFER_SIZE];
long redBuffer[HR_BUFFER_SIZE];
int bufferIndex = 0;
bool bufferFull = false;

float heartRate = 0.0;
int spo2 = 0;
float perfusionIndex = 0.0;
float heartRateVariability = 0.0;

float signalQuality = 0.0;
float hrConfidence = 0.0;
float spo2Confidence = 0.0;
bool fingerDetected = false;

KalmanFilter hrFilter;
KalmanFilter spo2Filter;
MovingMedianFilter hrMedianFilter;
MovingMedianFilter spo2MedianFilter;

unsigned long lastSampleTime = 0;
unsigned long lastBeatTime = 0;
unsigned long stableSignalStartTime = 0;
bool isMeasuring = false;

float motionScore = 0.0;
float baselineAccel = 9.81;

float sleepScore = 100.0;
bool sleeping = false;
unsigned long lastMovement = 0;
const unsigned long sleepThreshold = 300000; // 5 minutes
float movementThreshold = 1.2;

float accelX = 0, accelY = 0, accelZ = 0;
float gyroX = 0, gyroY = 0, gyroZ = 0;
float tempC = 0;
unsigned long lastMpuUpdate = 0;
#define MPU_UPDATE_RATE 500

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;
unsigned long lastBleUpdate = 0;
String emergencyStatus = "Normal";
long currentIRValue = 0;

// ==============================================
// SIGNAL PROCESSING & LOGIC
// ==============================================

float calculateSQI(long* buffer, int size) {
    if(size < 10) return 0.0;
    float mean = 0;
    for(int i = 0; i < size; i++) mean += buffer[i];
    mean /= size;
    float variance = 0;
    for(int i = 0; i < size; i++) {
        float diff = buffer[i] - mean;
        variance += diff * diff;
    }
    variance /= size;
    float stdDev = sqrt(variance);
    float sqi = 100.0 * exp(-0.1 * (stdDev / mean));
    return constrain(sqi, 0.0, 100.0);
}

float bandpassFilter(float input, float& prev1, float& prev2, float& prevOut1, float& prevOut2) {
    static const float b0 = 0.0300;
    static const float b1 = 0.0000;
    static const float b2 = -0.0300;
    static const float a1 = -1.8744;
    static const float a2 = 0.9429;
    
    float output = b0 * input + b1 * prev1 + b2 * prev2 - a1 * prevOut1 - a2 * prevOut2;
    prev2 = prev1;
    prev1 = input;
    prevOut2 = prevOut1;
    prevOut1 = output;
    return output;
}

bool detectPPGPeak(long sample, long* buffer, int bufferSize, float& threshold) {
    static float peakDetectAlpha = 0.1;
    
    if(bufferSize < 3) return false;
    
    long windowSum = 0;
    int windowSize = min(25, bufferSize);
    for(int i = bufferSize - windowSize; i < bufferSize; i++) {
        windowSum += buffer[i];
    }
    float movingAvg = (float)windowSum / windowSize;
    threshold = peakDetectAlpha * movingAvg * 1.5 + (1 - peakDetectAlpha) * threshold;
    
    long prev1 = buffer[bufferSize-2];
    long prev2 = buffer[bufferSize-3];
    
    if(sample > threshold && sample > prev1 && sample > prev2) {
        unsigned long currentTime = millis();
        if(currentTime - lastBeatTime > 250) {
            lastBeatTime = currentTime;
            return true;
        }
    }
    return false;
}

float calculateMedicalGradeSpO2(long* irBuffer, long* redBuffer, int bufferSize) {
    if(bufferSize < 100) return 0.0;
    
    float irDC = 0, redDC = 0;
    for(int i = 0; i < bufferSize; i++) {
        irDC += irBuffer[i];
        redDC += redBuffer[i];
    }
    irDC /= bufferSize;
    redDC /= bufferSize;
    
    float irAC = 0, redAC = 0;
    for(int i = 0; i < bufferSize; i++) {
        float irACval = irBuffer[i] - irDC;
        float redACval = redBuffer[i] - redDC;
        irAC += irACval * irACval;
        redAC += redACval * redACval;
    }
    irAC = sqrt(irAC / bufferSize);
    redAC = sqrt(redAC / bufferSize);
    
    if(irDC == 0 || redDC == 0) return 0.0;
    float R = (redAC / redDC) / (irAC / irDC);
    
    float spo2 = -16.666 * R * R + 8.3333 * R + 100.0;
    spo2 = constrain(spo2, MIN_SPO2, MAX_SPO2);
    
    float signalPower = (irAC * irAC) + (redAC * redAC);
    float noisePower = 0;
    for(int i = 1; i < bufferSize; i++) {
        float diff = irBuffer[i] - irBuffer[i-1];
        noisePower += diff * diff;
    }
    noisePower /= (bufferSize - 1);
    float snr = 10 * log10(signalPower / (noisePower + 1));
    
    if(snr < MIN_SNR) return 0.0;
    return spo2;
}

float calculatePerfusionIndex(long* irBuffer, int bufferSize) {
    if(bufferSize < 10) return 0.0;
    long minVal = irBuffer[0];
    long maxVal = irBuffer[0];
    long sum = irBuffer[0];
    
    for(int i = 1; i < bufferSize; i++) {
        if(irBuffer[i] < minVal) minVal = irBuffer[i];
        if(irBuffer[i] > maxVal) maxVal = irBuffer[i];
        sum += irBuffer[i];
    }
    
    float dc = (float)sum / bufferSize;
    float ac = (float)(maxVal - minVal) / 2.0;
    float pi = (dc > 0) ? (ac / dc * 100.0) : 0.0;
    return constrain(pi, 0.0, 20.0);
}

void processVitalSigns(long irValue, long redValue) {
    currentIRValue = irValue;
    static bool wasFingerDetected = false;
    
    if(currentIRValue > 5000) fingerDetected = true;
    else if(currentIRValue < 3000) fingerDetected = false;
    
    if(fingerDetected && !wasFingerDetected) {
        bufferIndex = 0;
        bufferFull = false;
        heartRate = 0;
        spo2 = 0;
        stableSignalStartTime = millis();
        isMeasuring = false;
        hrFilter.reset();
        spo2Filter.reset();
    }
    wasFingerDetected = fingerDetected;
    
    if(!fingerDetected) {
        heartRate = 0; spo2 = 0; signalQuality = 0;
        return;
    }
    
    if(bufferIndex < HR_BUFFER_SIZE) {
        irBuffer[bufferIndex] = irValue;
        redBuffer[bufferIndex] = redValue;
        bufferIndex++;
    } else {
        bufferFull = true;
    }
    
    signalQuality = calculateSQI(irBuffer, min(bufferIndex, HR_BUFFER_SIZE));
    hrConfidence = signalQuality / 100.0;
    
    if(bufferFull && signalQuality > 20.0) {
        static float bpPrev1 = 0, bpPrev2 = 0, bpOut1 = 0, bpOut2 = 0;
        static float peakThreshold = 0;
        bandpassFilter(irValue, bpPrev1, bpPrev2, bpOut1, bpOut2);
        
        static unsigned long lastPeakTime = 0;
        if(detectPPGPeak(irValue, irBuffer, min(bufferIndex, HR_BUFFER_SIZE), peakThreshold)) {
            unsigned long currentTime = millis();
            if(lastPeakTime > 0) {
                long interval = currentTime - lastPeakTime;
                if(interval > 272 && interval < 2000) {
                    float instantBPM = 60000.0 / interval;
                    instantBPM = hrMedianFilter.update(instantBPM);
                    instantBPM = hrFilter.update(instantBPM);
                    if(instantBPM >= MIN_HR && instantBPM <= MAX_HR) heartRate = instantBPM;
                }
            }
            lastPeakTime = currentTime;
        }
        
        static unsigned long lastSpo2Calc = 0;
        if(millis() - lastSpo2Calc > 1000) {
            if(bufferIndex >= 100) {
                float calculatedSpO2 = calculateMedicalGradeSpO2(irBuffer, redBuffer, min(bufferIndex, HR_BUFFER_SIZE));
                if(calculatedSpO2 > 0) {
                    calculatedSpO2 = spo2MedianFilter.update(calculatedSpO2);
                    spo2 = (int)spo2Filter.update(calculatedSpO2);
                    perfusionIndex = calculatePerfusionIndex(irBuffer, min(bufferIndex, HR_BUFFER_SIZE));
                    spo2Confidence = constrain(perfusionIndex / 10.0, 0.0, 1.0);
                }
            }
            lastSpo2Calc = millis();
        }
    }
    
    if(signalQuality > 50.0 && millis() - stableSignalStartTime > STABILIZATION_TIME_HR) {
        isMeasuring = true;
    }
}

// ==============================================
// OLED DISPLAY
// ==============================================

void displayMainScreen() {
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.print(deviceConnected ? "BLE+" : "BLE-");
    
    display.setCursor(110, 0);
    display.print((int)signalQuality); display.print("%");
    
    display.setTextSize(2);
    display.setCursor(0, 15);
    display.print("HR:");
    if(fingerDetected && hrConfidence > 0.7 && isMeasuring && heartRate > 0) {
        if(heartRate > 100) display.setTextColor(SSD1306_INVERSE);
        display.print(" ");
        if(heartRate < 100) display.print(" ");
        display.print((int)heartRate);
        display.setTextSize(1); display.print(" BPM");
        if(hrConfidence < 0.9) display.print("*");
    } else {
        display.setTextSize(2); display.print(" ---"); display.setTextSize(1); display.print(" BPM");
    }
    
    display.setTextColor(SSD1306_WHITE); // Reset color
    display.setTextSize(1);
    display.setCursor(0, 35);
    display.print("SpO2:");
    display.setTextSize(2);
    
    if(fingerDetected && spo2Confidence > 0.8 && isMeasuring && spo2 > 0) {
        if(spo2 < 94) display.fillRect(85, 35, 10, 8, SSD1306_WHITE);
        display.print(" ");
        if(spo2 < 100) display.print(" ");
        display.print(spo2);
        display.setTextSize(1); display.print(" %");
        
        display.setCursor(100, 35); display.print("PI:"); display.print((int)perfusionIndex); display.print("%");
    } else {
         display.setTextSize(2); display.print(" ---"); display.setTextSize(1); display.print(" %");
    }
    
    display.setTextSize(1);
    display.setCursor(0, 50);
    if(!fingerDetected) display.print("Place Finger");
    else if(!isMeasuring) {
        unsigned long elapsed = millis() - stableSignalStartTime;
        if(elapsed < STABILIZATION_TIME_HR) {
            display.print("Analyzing "); display.print((STABILIZATION_TIME_HR - elapsed) / 1000); display.print("s");
        } else display.print("Ready");
    } else {
        display.print("Measuring");
        if(sleeping) display.print(" | Sleep");
    }
    
    display.drawRect(0, 58, 128, 6, SSD1306_WHITE);
    int qualityWidth = map((int)signalQuality, 0, 100, 0, 124);
    display.fillRect(2, 60, qualityWidth, 2, SSD1306_WHITE);
    display.display();
}

void displayEmergencyScreen() {
    static bool blinkState = false;
    static unsigned long lastBlink = 0;
    if(millis() - lastBlink > 500) { blinkState = !blinkState; lastBlink = millis(); }
    
    if(blinkState) {
        display.clearDisplay();
        display.setTextSize(2); display.setCursor(15, 0); display.println("EMERGENCY!");
        display.setTextSize(3); display.setCursor(20, 20); display.println("! ! !");
        display.setTextSize(1); display.setCursor(5, 45); display.println("PATIENT NEEDS"); display.setCursor(15, 55); display.println("ASSISTANCE!");
        display.display();
    } else {
        display.clearDisplay(); display.display();
    }
}

// ==============================================
// BLE CALLBACKS & SETUP
// ==============================================

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        deviceConnected = true;
        Serial.println("BLE Device Connected!");
    };
    void onDisconnect(BLEServer* pServer) {
        deviceConnected = false;
        Serial.println("BLE Device Disconnected!");
    }
};

String generateJsonVitals() {
    String json = "{";
    json += "\"heartRate\":\"" + String(fingerDetected && heartRate > 0 ? (int)heartRate : 0) + "\",";
    json += "\"hrConfidence\":\"" + String(hrConfidence, 2) + "\",";
    json += "\"spo2\":\"" + String(fingerDetected && spo2 > 0 ? spo2 : 0) + "\",";
    json += "\"spo2Confidence\":\"" + String(spo2Confidence, 2) + "\",";
    json += "\"perfusionIndex\":\"" + String(perfusionIndex, 1) + "\",";
    json += "\"signalQuality\":\"" + String(signalQuality, 1) + "\",";
    json += "\"fingerDetected\":\"" + String(fingerDetected ? "true" : "false") + "\",";
    json += "\"isMeasuring\":\"" + String(isMeasuring ? "true" : "false") + "\",";
    json += "\"sleepStatus\":\"" + String(sleeping ? "Sleeping" : "Awake") + "\",";
    json += "\"sleepScore\":\"" + String((int)sleepScore) + "\",";
    json += "\"accelX\":\"" + String(accelX, 1) + "\",";
    json += "\"accelY\":\"" + String(accelY, 1) + "\",";
    json += "\"accelZ\":\"" + String(accelZ, 1) + "\",";
    json += "\"temperature\":\"" + String(tempC, 1) + "\",";
    json += "\"emergency\":\"" + String(emergencyActive ? "ACTIVE" : "INACTIVE") + "\",";
    json += "\"emergencyMessage\":\"" + emergencyStatus + "\",";
    json += "\"bleStatus\":\"" + String(deviceConnected ? "Connected" : "Advertising") + "\",";
    json += "\"device\":\"XIAO_C3_Medical\"";
    json += "}";
    return json;
}

void updateMPUData() {
    if(millis() - lastMpuUpdate >= MPU_UPDATE_RATE) {
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
    }
}

void checkSleepStatus() {
    float movement = sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
    static float baselineMovement = 9.81;
    static unsigned long lastBaselineUpdate = 0;
    
    if(millis() - lastBaselineUpdate > 10000) {
        baselineMovement = 0.9 * baselineMovement + 0.1 * movement;
        lastBaselineUpdate = millis();
    }
    
    float relativeMovement = abs(movement - baselineMovement);
    if(relativeMovement < movementThreshold) {
        if(lastMovement == 0) lastMovement = millis();
        else if(millis() - lastMovement > sleepThreshold) {
            sleeping = true;
            sleepScore = constrain(100.0 - (millis() - lastMovement - sleepThreshold) / 600000.0, 0.0, 100.0);
        }
    } else {
        lastMovement = millis(); sleeping = false; sleepScore = 100.0;
    }
}

void checkEmergencyButton() {
    int buttonState = digitalRead(EMERGENCY_BUTTON_PIN);
    if(buttonState == LOW) {
        unsigned long currentTime = millis();
        if(currentTime - lastButtonPress > debounceDelay) {
            emergencyActive = !emergencyActive;
            lastButtonPress = currentTime;
            emergencyStatus = emergencyActive ? "EMERGENCY! Patient needs assistance!" : "Normal";
        }
    }
}

void checkBLEResetButton() {
    if(digitalRead(BLE_RESET_PIN) == LOW) {
        // Simple software reset if button held
        ESP.restart();
    }
}

void playBootAnimation() {
    for(int i = 0; i <= 64; i+=2) {
        display.clearDisplay(); display.drawBitmap(0, 0, brain_logo, 128, i, SSD1306_WHITE); display.display(); delay(10);
    }
    delay(500);
}

void setupBLE() {
    BLEDevice::init("XIAO-C3-Medical");
    BLEDevice::setPower(ESP_PWR_LVL_P9);
    
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());
    
    BLEService *pService = pServer->createService(SERVICE_UUID);
    pCharacteristic = pService->createCharacteristic(
        CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY
    );
    
    pCharacteristic->addDescriptor(new BLE2902());
    pService->start();
    
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    
    BLEAdvertisementData advertisementData;
    advertisementData.setFlags(0x06);
    advertisementData.setName("XIAO-C3-Medical");
    advertisementData.setCompleteServices(BLEUUID(SERVICE_UUID));
    pAdvertising->setAdvertisementData(advertisementData);

    pAdvertising->setMinInterval(0x20); pAdvertising->setMaxInterval(0x40);
    pAdvertising->setMinPreferred(0x20); pAdvertising->setMaxPreferred(0x40);
    
    BLEDevice::startAdvertising();
}

void setup() {
    Serial.begin(115200);
    delay(2000); // Wait for Serial
    
    Wire.begin(6, 7); // XIAO C3 I2C pins
    
    if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
        Serial.println("MSD1306 Fail"); for(;;);
    }
    playBootAnimation();
    
    if(!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
        display.clearDisplay(); display.println("MAX30102 Fail"); display.display(); while(1);
    }
    particleSensor.setup(0x60, 4, 2, 100, 411, 4096);
    particleSensor.setPulseAmplitudeRed(0x60);
    particleSensor.setPulseAmplitudeIR(0x60);
    
    if(!mpu.begin(0x68, &Wire)) {
        display.clearDisplay(); display.println("MPU6050 Fail"); display.display(); while(1);
    }
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    
    pinMode(EMERGENCY_BUTTON_PIN, INPUT_PULLUP);
    pinMode(BLE_RESET_PIN, INPUT_PULLUP);
    
    hrFilter.setParameters(0.01, 0.5); 
    spo2Filter.setParameters(0.001, 0.2);
    
    setupBLE();
}

void loop() {
    checkEmergencyButton();
    checkBLEResetButton();
    
    if(emergencyActive) {
        displayEmergencyScreen();
        if(deviceConnected && millis() - lastBleUpdate > 200) {
            String json = generateJsonVitals();
            pCharacteristic->setValue((uint8_t*)json.c_str(), json.length());
            pCharacteristic->notify();
            lastBleUpdate = millis();
        }
    } else {
        particleSensor.check();
        while(particleSensor.available()) {
            processVitalSigns(particleSensor.getFIFOIR(), particleSensor.getFIFORed());
            particleSensor.nextSample();
        }
        
        updateMPUData();
        checkSleepStatus();
        displayMainScreen();
        
        // Push to BLE every 1s
        if(deviceConnected && millis() - lastBleUpdate > 1000) {
            String json = generateJsonVitals();
            pCharacteristic->setValue((uint8_t*)json.c_str(), json.length());
            pCharacteristic->notify();
            lastBleUpdate = millis();
        }
    }
    
    // Auto-restart advertising if disconnected (watchdog)
    if(!deviceConnected && oldDeviceConnected) {
        delay(500); 
        pServer->startAdvertising(); 
        oldDeviceConnected = deviceConnected;
    }
    if(deviceConnected && !oldDeviceConnected) {
        oldDeviceConnected = deviceConnected;
    }
    
    delay(2);
}
