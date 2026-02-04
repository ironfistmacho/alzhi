# ESP32 XIAO-C3 Setup Guide

## Hardware Requirements

- Seeed XIAO ESP32-C3
- MAX30102 Heart Rate & SpO2 Sensor
-MPU6050 Accelerometer/Gyroscope (optional - for redundant fall detection)
- SSD1306 OLED Display (128x64)
- Push button (for emergency alert)
- Breadboard and jumper wires
- USB-C cable for programming and power

## Pin Connections

### MAX30102 (I2C)
```
MAX30102  →   ESP32 XIAO-C3
VIN       →   3.3V
GND       →   GND
SCL       →   D5 (GPIO7)
SDA       →   D4 (GPIO6)
INT       →   Not connected (or D2 for interrupt)
```

### MPU6050 (I2C - Optional)
```
MPU6050   →   ESP32 XIAO-C3
VCC       →   3.3V
GND       →   GND
SCL       →   D5 (GPIO7) - shared with MAX30102
SDA       →   D4 (GPIO6) - shared with MAX30102
```

### OLED Display (I2C)
```
OLED      →   ESP32 XIAO-C3
VCC       →   3.3V
GND       →   GND
SCL       →   D5 (GPIO7) - shared I2C bus
SDA       →   D4 (GPIO6) - shared I2C bus
```

### Emergency Button
```
Button    →   ESP32 XIAO-C3
One side  →   D2 (GPIO2)
Other     →   GND (with 10kΩ pull-up resistor)
```

> **Note**: All I2C devices share the same SCL/SDA bus. Ensure each has a unique I2C address:
> - MAX30102: 0x57
> - MPU6050: 0x68
> - SSD1306: 0x3C

## Software Setup

### 1. Install Arduino IDE

1. Download Arduino IDE from [arduino.cc](https://www.arduino.cc/en/software)
2. Install and launch Arduino IDE

### 2. Add ESP32 Board Support

1. Open **File → Preferences**
2. Add to "Additional Board Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Click OK
4. Open **Tools → Board → Boards Manager**
5. Search for "ESP32"
6. Install "esp32" by Espressif Systems

### 3. Select XIAO ESP32-C3 Board

1. Connect ESP32 XIAO-C3 via USB-C
2. **Tools → Board → ESP32 Arduino**
3. Select **"XIAO_ESP32C3"**
4. **Tools → Port** → Select COM port (Windows) or `/dev/ttyUSB0` (Linux)

### 4. Install Required Libraries

**Tools → Manage Libraries**, search and install:

- **Adafruit GFX Library** (for OLED graphics)
- **Adafruit SSD1306** (for OLED display)
- **Adafruit MPU6050** (for accelerometer)
- **Adafruit Unified Sensor** (dependency)
- **MAX30105 Particle Sensor** by SparkFun
- **ESP32 BLE Arduino** (included with ESP32 board package)

### 5. Upload Firmware

1. Open `ESP32_C3_XIAO_COMPLETE_CODE.ino` in Arduino IDE
2. Verify board settings:
   - Board: "XIAO_ESP32C3"
   - Upload Speed: "921600"
   - Flash Mode: "QIO"
   - Partition Scheme: "Default 4MB"
3. Click **Upload** (→ button)
4. Wait for compilation and upload
5. Open **Tools → Serial Monitor** (115200 baud)

### 6. Verify Firmware Operation

After upload, Serial Monitor should show:
```
Initializing OLED...
OLED initialized successfully
Initializing MPU6050...
MPU6050 initialized successfully
Initializing MAX30102...
MAX30102 initialized successfully
Initializing BLE...
BLE Server started
Device Name: Health Monitor
Waiting for client connection...
```

OLED Display should show:
- Boot animation with brain logo
- Main screen with vitals display
- Heart rate, SpO2, temperature
- Connection status

## Configuration

### Change Device Name

Edit in `ESP32_C3_XIAO_COMPLETE_CODE.ino`:

```cpp
#define DEVICE_NAME "Health Monitor"  // Change to unique name
#define PATIENT_ID "PATIENT_001"      // Match with Raspberry Pi
```

### Adjust Fall Detection Sensitivity

```cpp
const float FALL_THRESHOLD = 2.5;  // Acceleration in g's
const int FALL_DURATION = 100;     // Duration in milliseconds
```

Lower threshold = more sensitive (may cause false positives)
Higher threshold = less sensitive (may miss falls)

### BLE UUIDs (for mobile app compatibility)

```cpp
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
```

These match the mobile app's BLE service configuration.

## Testing

### 1. Test I2C Devices

Add this to `setup()` function for debugging:

```cpp
Wire.begin(D4, D5);  // SDA, SCL
Serial.println("Scanning I2C bus...");

for (byte address = 1; address < 127; address++) {
  Wire.beginTransmission(address);
  byte error = Wire.endTransmission();
  
  if (error == 0) {
    Serial.print("I2C device found at address 0x");
    Serial.println(address, HEX);
  }
}

// Expected output:
// I2C device at 0x3C (OLED)
// I2C device at 0x57 (MAX30102)
// I2C device at 0x68 (MPU6050)
```

### 2. Test MAX30102 Heart Rate Sensor

1. Place finger on sensor (cover LED completely)
2. Hold still for 5-10 seconds
3. Serial Monitor should show:
   ```
   IR Value: 50000+
   Finger Detected: true
   BPM: 72
   SpO2: 98
   ```
4. OLED displays heart rate and SpO2

### 3. Test Fall Detection

1. Hold ESP32 securely
2. Make sudden sharp movement (simulate fall)
3. Serial Monitor shows:
   ```
   Fall detected! Acceleration: 3.2g
   ```
4. OLED displays "FALL DETECTED!"
5. Emergency alert flag set in BLE characteristic

### 4. Test BLE Connection

1. Open mobile app
2. Navigate to Device tab
3. Tap "Scan for Devices"
4. ESP32 should appear as "Health Monitor"
5. Connect
6. Serial Monitor shows: `Client connected!`
7. Dashboard displays real-time vitals

### 5. Test Emergency Button

1. Press emergency button
2. OLED shows emergency screen
3. BLE characteristic sends emergency flag
4. Serial Monitor: `Emergency button pressed!`
5. Mobile app receives fall alert

## Troubleshooting

### OLED Not Working

**Check Wiring:**
- Verify 3.3V and GND connections
- Check SCL/SDA are not swapped

**Check I2C Address:**
```cpp
// Try different address
display.begin(SSD1306_SWITCHCAPVCC, 0x3C);  // or 0x3D
```

**Test I2C Scan** (see Testing section above)

### MAX30102 No Readings

**Finger Placement:**
- Cover sensor completely
- Don't press too hard (restricts blood flow)
- Keep finger steady for 10 seconds

**Check Power:**
- MAX30102 needs stable 3.3V
- May need external power if USB can't provide enough current

**Serial Debug:**
```cpp
Serial.print("IR: ");
Serial.println(particleSensor.getIR());
// Should be > 50000 with finger detected
```

### MPU6050 Not Detected

**Check Address:**
```cpp
// MPU6050 has address 0x68 or 0x69 (depending on AD0 pin)
mpu.begin(0x68);  // Try 0x69 if 0x68 fails
```

**Check Connections:**
- Verify SCL/SDA not reversed
- Check 3.3V power supply

### BLE Not Advertising

**Reset BLE:**
```cpp
ESP.restart();  // Full reset
```

**Check Serial Monitor:**
```
BLE Server started
Device Name: Health Monitor
```

**Mobile App Can't Find:**
- Ensure Bluetooth enabled on phone
- Grant Location permission (required for BLE scan)
- Restart both devices

### Upload Fails

**COM Port Error:**
- Unplug and replug USB cable
- Try different USB port
- Install CP210x drivers (for CH340 chip)

**Permission Denied (Linux):**
```bash
sudo usermod -a -G dialout $USER
# Log out and back in
```

**Wrong Board Selected:**
- Verify Tools → Board is "XIAO_ESP32C3"
- Not "ESP32 Dev Module" or other variants

## Power Consumption

**Active Mode (BLE Connected):**
- ~80mA typical
- Peaks at ~120mA during BLE transmission

**Sleep Mode (Future Enhancement):**
```cpp
// Add deep sleep when no movement detected
esp_deep_sleep_start();
```

**Battery Operation:**
- 500mAh battery: ~6 hours continuous
- 1000mAh battery: ~12 hours continuous
- With sleep optimization: 24+ hours

## Firmware Updates

### OTA Updates (Future Enhancement)

Add OTA capability for wireless updates:

```cpp
#include <WiFi.h>
#include <ArduinoOTA.h>

// In setup():
WiFi.begin("SSID", "password");
ArduinoOTA.begin();

// In loop():
ArduinoOTA.handle();
```

### USB Updates

1. Stop monitoring/disconnect BLE
2. Upload new firmware via Arduino IDE
3. ESP32 restarts automatically
4. Reconnect to mobile app

## Integration with System

### Expected Data Format (BLE JSON)

ESP32 sends JSON over BLE characteristic:

```json
{
  "hr": 72,
  "ox": 98,
  "tp": 36.5,
  "fd": true,
  "sq": 95,
  "ax": 0.1,
  "ay": 0.2,
  "az": 9.8,
  "em": 0,
  "sl": "W",
  "ss": 0,
  "sc": 150
}
```

Fields:
- `hr`: Heart rate (BPM)
- `ox`: SpO2 (%)
- `tp`: Temperature (°C)
- `fd`: Finger detected
- `sq`: Signal quality (%)
- `ax, ay, az`: Acceleration (m/s²)
- `em`: Emergency (0=normal, 1=fall)
- `sl`: Sleep status (W=awake, S=sleeping)
- `ss`: Sleep score
- `sc`: Step count

### Mobile App Parsing

Mobile app (`bleService.js`) automatically parses this JSON and:
1. Stores vitals in Supabase `patient_vitals` table
2. Creates alerts for abnormal values
3. Logs fall events
4. Tracks sleep data

## Next Steps

After hardware setup and firmware upload:

1. **Test BLE Connection**: Verify mobile app can connect and receive data
2. **Calibrate Sensors**: Ensure accurate readings (compare with medical devices)
3. **Test Fall Detection**: Simulate falls and verify alerts trigger
4. **Integration Test**: Run full system with Raspberry Pi + ESP32 + Mobile App
5. **Deploy to Patient**: Attach to patient's wrist or chest

## Maintenance

###Weekly Checks:
- Clean MAX30102 sensor
- Check battery level
- Verify BLE connection stable

### Monthly:
- Update firmware if new version available
- Recalibrate sensors if drift detected
- Check all physical connections

## Safety Notes

⚠️ **Medical Device Disclaimer**: 
This is NOT a certified medical device. Do not use as sole monitoring system. Always consult healthcare professionals.

⚠️ **Electrical Safety**:
- Use only 3.3V power supply
- Do not expose to water
- Ensure proper insulation
