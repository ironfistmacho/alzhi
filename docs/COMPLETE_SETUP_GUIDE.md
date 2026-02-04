# 🚀 Three-Component Patient Monitoring System
## Complete Setup & Implementation Guide

---

## 📋 System Overview

This integrated system combines three hardware components for comprehensive patient monitoring:

### Component Architecture

```
┌──────────────────┐      SMS Alert      ┌───────────────────┐
│  Raspberry Pi    │────────────────────▶│  Mobile App       │
│  Zero WH         │                      │  (Caregiver)      │
│                  │                      │                   │
│ • Fall Detection │◀─────┐              │ • SMS Parser      │
│ • GPS Tracking   │      │              │ • Map Display     │
│ • SMS Alerts     │      │              │ • Geofencing      │
└──────────────────┘      │              │ • BLE Connection  │
                          │              └───────────────────┘
                          │                        ▲
                       BLE (optional)              │
                          │                     BLE│
                   ┌──────▼─────────┐             │
                   │  ESP32 XIAO-C3  │─────────────┘
                   │                 │
                   │ • Heart Rate    │
                   │ • SpO2          │
                   │ • Temperature   │
                   │ • Fall Backup   │
                   └─────────────────┘
```

### Data Flow

1. **Fall Detection (Raspberry Pi → Mobile)**
   - Pi detects fall via MPU6050
   - Acquires GPS coordinates
   - Sends structured SMS with location
   - Mobile app parses SMS
   - Creates geofence around fall location
   - Sends push notification

2**Health Monitoring (ESP32 → Mobile)**
   - ESP32 reads vitals from MAX30102
   - Transmits via BLE to mobile app
   - App stores in Supabase database
   - Displays real-time on dashboard
   - Creates alerts for abnormal values

3. **Geofencing (Mobile App)**
   - Auto-creates zones around fall locations
   - Monitors patient location
   - Alerts on zone exit

---

## 🛠️ Quick Start Guide

### Prerequisites Checklist

**Hardware:**
- [ ] Raspberry Pi Zero WH with accessories
- [ ] ESP32 XIAO-C3
- [ ] MAX30102 sensor
- [ ] MPU6050 sensor (x2, one for each device)
- [ ] NEO-6M GPS module
- [ ] SIM800L GSM module + active SIM card
- [ ] OLED display (128x64)
- [ ] Power supplies and cables
- [ ] Android smartphone

**Software:**
- [ ] Windows PC with Node.js 18+
- [ ] Arduino IDE
- [ ] Android Studio (for building APK)
- [ ] Supabase account

**Accounts:**
- [ ] Phone number with SMS capability (for SIM card)
- [ ] Caregiver phone number (to receive alerts)
- [ ] Supabase project created

### Setup Order

**Phase 1: Mobile App (1-2 hours)**
1. Install dependencies
2. Build Android APK
3. Grant permissions
4. Test app launches

**Phase 2: ESP32 Hardware (30-60 minutes)**
1. Wire sensors to ESP32
2. Upload firmware via Arduino IDE
3. Test BLE connection to mobile app
4. Verify vitals display

**Phase 3: Raspberry Pi (2-3 hours)**
1. Wire sensors to Pi
2. Install Raspberry Pi OS
3. Configure Python script
4. Test fall detection and SMS

**Phase 4: Integration Testing (1 hour)**
1. Test end-to-end fall alert
2. Test BLE health monitoring
3. Test geofencing
4. Verify all notifications

**Total Time: 5-7 hours**

---

## 📱 Mobile App Setup

### 1. Install Dependencies

```bash
cd C:\Users\alber\OneDrive\Documents\alzhi

# Install packages
npm install

# Build Android development APK
npm run android
```

### 2. Grant Permissions on Device

When app launches, grant these permissions:

- ✅ **Location** → "Allow all the time" (for background geofencing)
- ✅ **Notifications** → Allow
- ✅ **Bluetooth** → Allow
- ✅**SMS** → Go to Settings → Apps → Permissions → SMS → Allow

### 3. Configure Supabase
1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Run the SQL script `GEOFENCE_SCHEMA.sql` in the Supabase SQL Editor to create the geofences table and security policies.
3. Ensure `.env.local` exists in the project root with your credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Test App

- Navigate between tabs (Dashboard, Patients, Device, Location, Alerts)
- Verify no crashes
- Check that Login/SignUp works

---

## 🔧 ESP32 Setup

### 1. Hardware Wiring

**All sensors connect to shared I2C bus:**

| Sensor | VCC | GND | SCL | SDA | Other |
|--------|-----|-----|-----|-----|-------|
| MAX30102 | 3.3V | GND | D5 (GPIO7) | D4 (GPIO6) | - |
| MPU6050 | 3.3V | GND | D5 | D4 | - |
| OLED | 3.3V | GND | D5 | D4 | - |
| Button | - | GND | - | - | D2 |

### 2. Upload Firmware

1. Open Arduino IDE
2. Install ESP32 board support
3. Install libraries:
   - Adafruit GFX
   - Adafruit SSD1306
   - Adafruit MPU6050
   - MAX30105 (SparkFun)
4. Open `ESP32_C3_XIAO_COMPLETE_CODE.ino`
5. Select Board: "XIAO_ESP32C3"
6. Upload

### 3. Verify Operation

**Serial Monitor (115200 baud) should show:**
```
Initializing sensors...
BLE Server started
Device Name: Health Monitor
Waiting for client...
```

**OLED should display:**
- Boot animation
- Heart rate: --
- SpO2: --%
- Temp: -- °C

### 4. Test BLE Connection

1. Open mobile app
2. Device tab → Scan
3. Connect to "Health Monitor"
4. Dashboard should show real-time vitals

---

## 🥧 Raspberry Pi Setup

### 1. Hardware Connections

**Detailed Schematics:** See [WIRING_DIAGRAM.md](./WIRING_DIAGRAM.md) for pin-by-pin mapping.

**MPU6050 (I2C):**
- VCC → Pin 1 (3.3V)
- GND → Pin 6
- SCL → Pin 5 (GPIO3)
- SDA → Pin 3 (GPIO2)

**NEO-6M GPS (UART):**
- VCC → Pin 2 (5V)
- GND → Pin 6
- TX → Pin 10 (RX)
- RX → Pin 8 (TX)

**SIM800L GSM (GPIO UART):**
- **POWER**: External 4V 2A supply (CRITICAL: Share GND with Pi)
- TX → Pin 7 (GPIO4 RX)
- RX → Pin 11 (GPIO17 TX)
- Uses software serial via GPIO pins 4 and 17.

### 2. Software Installation

```bash
# SSH into Pi (default: pi@raspberrypi.local, password: raspberry)

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Enable I2C and UART
sudo raspi-config
# Interface Options → I2C → Enable
# Interface Options → Serial → Console:No, Hardware:Yes

# Install Python dependencies
sudo pip3 install adafruit-circuitpython-mpu6050 pyserial

# Copy Python script
sudo mkdir -p /opt/patient_monitor
sudo nano /opt/patient_monitor/raspberry_pi_monitor.py
# Paste code from firmware/raspberry_pi_monitor.py
```

### 3. Configure Patient Info

Edit `/opt/patient_monitor/raspberry_pi_monitor.py`:

```python
PATIENT_ID = "PATIENT_001"  # Match with mobile app
CAREGIVER_PHONE = "+1234567890"  # Your phone number
FALL_THRESHOLD_G = 2.5
```

### 4. Test Manually

```bash
cd /opt/patient_monitor
python3 raspberry_pi_monitor.py

# Should see:
# MPU6050 initialized
# GPS initialized
# GSM initialized
# Starting monitoring loop

# Shake the Pi to trigger fall detection
# SMS should be sent
```

### 5. Install as Service

```bash
# Create service file
sudo nano /etc/systemd/system/patient-monitor.service
```

Paste:
```ini
[Unit]
Description=Patient Monitoring System
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/patient_monitor
ExecStart=/usr/bin/python3 /opt/patient_monitor/raspberry_pi_monitor.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable patient-monitor.service
sudo systemctl start patient-monitor.service
```

---

## ✅ System Integration Testing

### Test 1: End-to-End Fall Alert

**Objective:** Verify fall detection → SMS → Mobile app → Geofence

**Steps:**
1. Ensure Raspberry Pi is running (`sudo systemctl status patient-monitor`)
2. Ensure mobile app is installed on phone (can be in background)
3. Shake Raspberry Pi sharply to trigger fall detection
4. **Expected Results:**
   - Pi logs show: "FALL DETECTED"
   - Pi acquires GPS coordinates
   - Pi sends SMS
   - Mobile app receives SMS notification
   - Alert appears in mobile app Alerts tab
   - Fall location appears on Location tab map (red pin)
   - 250m geofence circle appears around fall location
   - Push notification sent to phone

**Verification:**
```bash
# On Pi, check logs:
sudo journalctl -u patient-monitor.service -f

# Should see:
# FALL EVENT DETECTED
# GPS location acquired: 12.345, 98.765
# SMS sent successfully
```

### Test 2: BLE Health Monitoring

**Objective:** Verify ESP32 → Mobile app vitals transmission

**Steps:**
1. Power on ESP32
2. Open mobile app → Device tab
3. Tap "Connect to Device"
4. Place finger on MAX30102 sensor
5. **Expected Results:**
   - BLE connection established
   - Dashboard displays real-time heart rate
   - SpO2 percentage shown
   - Temperature displayed
   - Data updates every 1-2 seconds

**Verification:**
- Check Supabase `patient_vitals` table for new records
- Vitals should be stored every 10 seconds

### Test 3: Geofencing Alert

**Objective:** Verify geofence exit notification

**Steps:**
1. Create manual geofence at current location (100m radius)
   - Location tab → Add Zone
2. Enable tracking: Location tab → Start
3. Walk or drive 150m away from geofence center
4. **Expected Results:**
   - Geofence exit detection
   - Push notification: "Patient has left safe zone"
   - Alert logged in Alerts tab

**Verification:**
- Check Alerts tab for "Geofence Exit" alert
- Check Supabase `patient_alerts` table

### Test 4: Simultaneous Operation

**Objective:** All systems working together

**Steps:**
1. ESP32 connected via BLE (vitals streaming)
2. Raspberry Pi monitoring for falls
3. Mobile app in background
4. Trigger fall on Raspberry Pi
5. **Expected Results:**
   - ESP32 continues sending vitals (uninterrupted)
   - SMS fall alert received
   - Geofence created
   - Both data streams visible in app

---

## 🔍 Troubleshooting

### Mobile App Issues

**SMS Not Received:**
- Check SMS permission granted
- Verify phone number format in Pi config (+country code)
- Test manual SMS in same format

**BLE Connection Fails:**
- Enable Bluetooth on phone
- Grant Location permission (required for BLE)
- Restart ESP32
- Clear Bluetooth cache: Settings → Apps → Bluetooth → Storage → Clear

**Geofencing Not Working:*- Grant "Allow all the time" location permission
- Enable background location in app settings
- Check battery optimization disabled for app

### ESP32 Issues

**No BLE Advertising:**
- Check Serial Monitor for "BLE Server started"
- Reset ESP32 (unplug/replug USB)
- Re-upload firmware

**Sensor Readings Show 0:**
- Check sensor wiring (especially I2C pins)
- Run I2C scan (see ESP32 setup guide)
- Verify 3.3V power supply stable

### Raspberry Pi Issues

**Fall Not Detected:**
- Check MPU6050 connection: `sudo i2cdetect -y 1`
- Lower fall threshold in config
- Check logs: `sudo journalctl -u patient-monitor -f`

**GPS No Fix:**
- Move outdoors with clear sky
- Wait 3-5 minutes
- Check GPS serial: `sudo cat /dev/serial0`

**SMS Not Sending:**
- Check SIM card has credit
- Verify GSM signal: Test with `AT+CSQ` (should be >10)
- Check phone number format

---

## 📊 System Monitoring

### Check Raspberry Pi Status

```bash
# Service status
sudo systemctl status patient-monitor

# Real-time logs
sudo journalctl -u patient-monitor -f

# Check system resources
htop
```

### Check Mobile App Logs

```bash
# Connect phone via USB, enable USB debugging

# View logs
adb logcat | grep -i "SMS\|BLE\|Geofence"
```

### Check Database

1. Login to Supabase dashboard
2. Check tables:
   - `patient_vitals` - Health data from ESP32
   - `fall_events` - Fall detections
   - `patient_alerts` - All alerts
   - `patient_locations` - GPS locations from falls
   - `geofences` - Active safe zones

---

## 🎯 Next Steps

**After successful setup:**

1. **Calibration:**
   - Compare ESP32 vitals with medical-grade devices
   - Adjust fall threshold based on patient activity level
   - Test SMS delivery time in your area

2. **Optimization:**
   - Tune geofence radius based on patient mobility
   - Adjust BLE update frequency for battery life
   - Configure Pi to sleep when stationary

3. **Deployment:**
   - Attach ESP32 to patient's wrist or chest
   - Place Raspberry Pi in patient's pocket/bag
   - Ensure caregiver has mobile app installed

4. **Training:**
   - Show caregiver how to use mobile app
   - Explain alert priorities
   - Demonstrate emergency button on ESP32

5. **Maintenance:**
   - Weekly: Check battery levels
   - Monthly: Update firmware
   - Quarterly: Recalibrate sensors

---

## 📞 Support & Resources

**Documentation:**
- [Raspberry Pi Setup](./RASPBERRY_PI_SETUP.md)
- [ESP32 Setup](./ESP32_SETUP.md)
- [Mobile App Setup](./MOBILE_APP_SETUP.md)

**Testing:**
- [System Integration Tests](./SYSTEM_INTEGRATION_TEST.md)

**Code Locations:**
- Raspberry Pi: `firmware/raspberry_pi_monitor.py`
- ESP32: `ESP32_C3_XIAO_COMPLETE_CODE.ino`
- Mobile App: `src/` directory
  - SMS Parser: `src/services/smsParser.js`
  - Geofencing: `src/services/geofencing.js`
  - BLE Service: `src/services/bleService.js`

---

## ⚠️ Important Notes

**Safety:**
- This is NOT a certified medical device
- Use as supplementary monitoring only
- Consult healthcare professionals for medical decisions

**Privacy:**
- SMS messages can be intercepted
- Implement additional encryption for production
- Follow HIPAA/medical data regulations if applicable

**Reliability:**
- GPS may not work indoors
- Cellular coverage required for SMS
- Bluetooth range limited to ~10m

---

## 🎉 Congratulations!

You now have a complete three-component patient monitoring system with:
- ✅ Fall detection with GPS tracking
- ✅ Real-time health vitals monitoring
- ✅ Automatic geofencing around incidents
- ✅ Multi-channel alerting (SMS + Push)
- ✅ Comprehensive caregiver dashboard

**The system is ready for deployment!**
