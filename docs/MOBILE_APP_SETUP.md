# Mobile App Setup Guide

## Prerequisites

- Node.js 18+ installed
- Android Studio installed (for Android development)
- Android device or emulator
- Supabase account and project

## Installation Steps

### 1. Install Dependencies

```bash
cd C:\Users\alber\OneDrive\Documents\alzhi

# Install all npm packages
npm install

# Install specific new dependencies
npm install expo-sms expo-task-manager
```

### 2. Configure Android Native Module

The SMS listener requires native Android setup:

#### Update MainApplication.java

Edit `android/app/src/main/java/com/alzheimercaregiver/MainApplication.java`:

```java
// Add import
import com.alzheimercaregiver.SmsListenerPackage;

// In getPackages() method, add:
packages.add(new SmsListenerPackage());
```

### 3. Request Permissions at Runtime

The app requires several sensitive permissions. These must be granted by the user:

#### Location Permissions
- Foreground location (for map and tracking)
- Background location (for geofencing)

#### SMS Permissions
- `READ_SMS` - Read SMS messages
- `RECEIVE_SMS` - Receive SMS in background

#### Bluetooth Permissions
- `BLUETOOTH_CONNECT` - Connect to ESP32
- `BLUETOOTH_SCAN` - Scan for devices

#### Notification Permission
- `POST_NOTIFICATIONS` - Show push notifications

### 4. Build Development APK

```bash
# Build Android development client
npm run android

# Or using Expo
npx expo run:android
```

This will:
1. Install dependencies
2. Build native modules (including SMS listener)
3. Install APK on connected device
4. Launch the app

### 5. Grant Permissions on Device

When app first launches:

1. **Location Permission** - Tap "Allow" → "Allow all the time" (for background tracking)
2. **Notifications** - Tap "Allow"
3. **Bluetooth** - Tap "Allow"
4. **SMS** - Navigate to Settings → Apps → Alzheimer Caregiver → Permissions → SMS → Allow

> **Note**: SMS permission may require manual granting in app settings as it's a sensitive permission.

### 6. Configure Supabase Connection

Ensure `.env.local` has correct Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 7. Initialize Services

The app will automatically initialize services on first launch:

```javascript
// Services auto-initialized in App.js:
import smsListenerService from './src/services/smsListener.android';
import geofencingService from './src/services/geofencing';

// Initialize SMS listener
await smsListenerService.initialize();
await smsListenerService.startListening();

// Initialize geofencing
await geofencingService.initialize();
```

## Usage Guide

### Connecting to ESP32 Device

1. Navigate to **Device** tab
2. Tap "Scan for Devices"
3. Select your ESP32 (should show as "Health Monitor" or similar)
4. Wait for connection (status shows "Connected")
5. Health data will appear on Dashboard

### SMS Fall Alert Reception

**Automatic Process:**
1. Raspberry Pi detects fall
2. Pi sends SMS to caregiver phone
3. Android receives SMS in background
4. App parses SMS and extracts GPS coordinates
5. Fall location displayed on map
6. Push notification sent to caregiver
7. Geofence automatically created around fall location

**Manual Test:**
Send test SMS to your phone in this format:
```
FALL_ALERT|PATIENT_001|12.345678,98.765432|2024-01-19 11:30:45|Battery:85%|Device:Pi
```

### Viewing Fall Locations

1. Navigate to **Location** tab
2. Toggle "Falls" button to show/hide fall markers (red pins)
3. Tap on fall marker to see details
4. Map auto-zooms to fall location

### Managing Geofences

**View Active Geofences:**
- Navigate to Location tab
- Toggle "Zones" button
- Geofence circles displayed in blue

**Create Manual Geofence:**
1. Navigate to Location tab
2. Move map to desired location (or use current location)
3. Select radius (100m, 250m, 500m, 1km)
4. Tap "Add Zone"
5. Geofence created and monitoring starts

**Geofence Alerts:**
- Exit alert: Patient leaves safe zone (High priority)
- Entry alert: Patient returns to zone (Low priority)

### Viewing Alerts

1. Navigate to **Alerts** tab
2. View all alerts sorted by priority:
   - 🔴 Critical: Fall detection from Raspberry Pi
   - 🟠 High: Fall detection from ESP32, Geofence violations
   - 🟡 Medium: Abnormal vital signs
   - 🔵 Low: Geofence entry, informational
3. Tap alert to expand details
4. Use "View on Map" to see location
5. Use "Call" to contact emergency contact

## Testing

### Test SMS Parsing

```javascript
// In React Native debug console
import smsParser from './src/services/smsParser';

smsParser.testParser();
// Should output parsed data
```

### Test Geofencing

1. Create geofence at current location (100m radius)
2. Enable "Start Tracking"
3. Walk 150m away from location
4. Should receive geofence exit notification
5. Walk back
6. Should receive entry notification

### Test BLE Connection

1. Power on ESP32 with firmware uploaded
2. Open app > Device tab
3. Tap "Scan"
4. Should see ESP32 device
5. Connect and verify health data displays

## Troubleshooting

### SMS Not Received by App

**Check Permissions:**
```bash
# Via ADB
adb shell pm list permissions -d -g
# Should show SMS permissions granted
```

**Manual Permission Grant:**
- Settings → Apps → Alzheimer Caregiver
- Permissions → SMS → Allow

**Check Logs:**
```bash
adb logcat | grep -i sms
# Should show SMS received events
```

### Geofencing Not Working

**Check Location Permission:**
- Must grant "Allow all the time" for background
- Settings → Apps → Permissions → Location → Allow all the time

**Check Background Service:**
```bash
adb logcat | grep -i geofence
```

### BLE Connection Fails

**Check Bluetooth:**
- Enable Bluetooth on phone
- Grant Bluetooth permissions
- Ensure ESP32 is powered and advertising

**Reset BLE:**
- Turn Bluetooth off/on
- Force stop app and reopen
- Restart ESP32 device

### App Crashes on Launch

**Check Native Modules:**
```bash
cd android
./gradlew clean
cd ..
npm run android
```

**Check Logs:**
```bash
adb logcat | grep -i ReactNative
```

### Notifications Not Showing

**Enable Notifications:**
- Settings → Apps → Notifications → Allow

**Check Notification Channel:**
```javascript
import * as Notifications from 'expo-notifications';

Notifications.setNotificationChannelAsync('default', {
  name: 'Default',
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#FF231F7C',
});
```

## Performance Optimization

### Reduce Battery Usage

**Adjust Location Update Frequency:**
Edit `src/services/geofencing.js`:
```javascript
await Location.startLocationUpdatesAsync(GEOFENCE_TASK_NAME, {
  accuracy: Location.Accuracy.Balanced, // Instead of High
  distanceInterval: 30, // Instead of 10
  timeInterval: 60000, // 1 minute instead of 30 seconds
});
```

**Limit Background Tasks:**
- Only start geofencing when needed
- Stop tracking when patient is safe at home

### Reduce Data Usage

**Throttle Vital Signs Storage:**
Already implemented - stores every 10 seconds max

**Limit Location Logging:**
Only stores significant location changes

## Security Considerations

### SMS Privacy

SMS messages can be intercepted. For production:
1. Consider end-to-end encryption for SMS
2. Use encrypted push notifications instead
3. Implement message signing/verification

### Database Security

Ensure Supabase RLS policies are enabled:
```sql
-- Only caregivers can see their patients' data
CREATE POLICY "Caregivers can view their patients"
ON patients FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM caregiver_patients cp
    WHERE cp.patient_id = patients.id
    AND cp.caregiver_id = auth.uid()
  )
);
```

### API Keys

Never commit `.env.local` to version control:
```bash
echo ".env.local" >> .gitignore
```

## Production Deployment

### Build Release APK

```bash
# Configure signing in android/app/build.gradle
# Generate keystore
keytool -genkey -v -keystore alzheimer-caregiver.keystore -alias my-app-alias -keyalg RSA -keysize 2048 -validity 10000

# Build release
cd android
./gradlew assembleRelease

# APK will be at:
# android/app/build/outputs/apk/release/app-release.apk
```

### Play Store Submission

**SMS Permission Declaration Required:**
Google Play requires declaration for SMS permissions with valid use case.

**Declare in Play Console:**
- Permission: RECEIVE_SMS, READ_SMS
- Use Case: Emergency fall detection system for Alzheimer's patients

## Support

For issues:
1. Check logs: `adb logcat`
2. Test each service individually
3. Verify all permissions granted
4. Ensure Supabase connection is active
5. Check ESP32/Raspberry Pi are powered and transmitting
