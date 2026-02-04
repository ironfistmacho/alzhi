# Raspberry Pi Zero WH - Complete Wiring Diagram

## Pin Layout Reference

```
Raspberry Pi Zero WH GPIO Pinout (40-pin header)

    3.3V  [ 1] [ 2]  5V
    SDA   [ 3] [ 4]  5V
    SCL   [ 5] [ 6]  GND
    GPIO4 [ 7] [ 8]  GPIO14 (TX)
    GND   [ 9] [10]  GPIO15 (RX)
  GPIO17  [11] [12]  GPIO18
  GPIO27  [13] [14]  GND
  GPIO22  [15] [16]  GPIO23
    3.3V  [17] [18]  GPIO24
  GPIO10  [19] [20]  GND
   GPIO9  [21] [22]  GPIO25
  GPIO11  [23] [24]  GPIO8
    GND   [25] [26]  GPIO7
```

---

## Component Connections

### 1. MPU6050 Accelerometer (Fall Detection)

**I2C Connection:**

| MPU6050 Pin | → | Raspberry Pi Pin | GPIO | Description |
|-------------|---|------------------|------|-------------|
| VCC | → | Pin 1 | 3.3V | Power |
| GND | → | Pin 6 | GND | Ground |
| SCL | → | Pin 5 | GPIO 3 (SCL) | I2C Clock |
| SDA | → | Pin 3 | GPIO 2 (SDA) | I2C Data |

**I2C Address:** `0x68` (default) or `0x69` (if AD0 high)

---

### 2. NEO-6M GPS Module

**Hardware UART Connection:**

| NEO-6M Pin | → | Raspberry Pi Pin | GPIO | Description |
|------------|---|------------------|------|-------------|
| VCC | → | Pin 2 | 5V | Power (GPS needs 5V) |
| GND | → | Pin 6 | GND | Ground |
| TX | → | Pin 10 | GPIO 15 (RX) | GPS transmits to Pi |
| RX | → | Pin 8 | GPIO 14 (TX) | GPS receives from Pi |

**Serial Port:** `/dev/serial0` (hardware UART)  
**Baud Rate:** 9600

**Note:** Hardware UART provides stable GPS communication

---

### 3. SIM800L GSM Module (SMS Alerts)

**Software UART via GPIO:**

| SIM800L Pin | → | Raspberry Pi Pin | GPIO | Description |
|-------------|---|------------------|------|-------------|
| VCC | → | **External 4V Supply** | - | **CRITICAL: 4V 2A supply!** |
| GND | → | Pin 9 + External GND | GND | Common ground required |
| TX | → | Pin 7 | GPIO 4 (RX) | SIM800L transmits to Pi |
| RX | → | Pin 11 | GPIO 17 (TX) | SIM800L receives from Pi |

**⚠️ POWER CRITICAL:**
- **DO NOT** power SIM800L from Pi's 5V or 3.3V pins
- Use **dedicated 4V 2A power supply** or buck converter (5V → 4V)
- **MUST** connect external power supply GND to Pi GND (common ground)
- SIM800L draws up to **2A during transmission** (will brown out Pi if powered from GPIO)

**Serial Interface:** Software serial on GPIO 4/17  
**Baud Rate:** 9600

---

## Complete Wiring Schematic

```
┌─────────────────────────────────────────────────────────────┐
│                    RASPBERRY PI ZERO WH                     │
│                                                             │
│  [1] 3.3V ────────────────────────┐                        │
│  [2] 5V ──────────────────┐       │                        │
│  [3] SDA (GPIO2) ─────┐   │       │                        │
│  [4] 5V               │   │       │                        │
│  [5] SCL (GPIO3) ───┐ │   │       │                        │
│  [6] GND ────────┐  │ │   │       │                        │
│  [7] GPIO4 (RX)  │  │ │   │       │                        │
│  [8] GPIO14 (TX) │  │ │   │       │                        │
│  [9] GND ────┐   │  │ │   │       │                        │
│ [10] GPIO15 (RX) │ │ │ │ │ │     │                        │
│ [11] GPIO17 (TX) │ │ │ │ │ │     │                        │
│                  │ │ │ │ │ │     │                        │
└──────────────────┼─┼─┼─┼─┼─┼─────┼────────────────────────┘
                   │ │ │ │ │ │     │
                   │ │ │ │ │ │     │
    ┌──────────────┘ │ │ │ │ │     │
    │ GND            │ │ │ │ │     │
    │  ┌─────────────┘ │ │ │ │     │
    │  │ GND           │ │ │ │     │
    │  │  ┌────────────┘ │ │ │     │
    │  │  │ SCL          │ │ │     │
    │  │  │  ┌───────────┘ │ │     │
    │  │  │  │ SDA         │ │     │
    ▼  ▼  ▼  ▼             │ │     │
┌──────────────┐            │ │     │
│   MPU6050    │            │ │     │
│ (I2C: 0x68)  │            │ │     │
│              │            │ │     │
│ Fall Detect  │            │ │     │
└──────────────┘            │ │     │
                            │ │     │
                            │ │     │
                      5V ◄──┘ │     │
                      GND ◄────┘     │
                       RX ◄──────────┘ (from GPIO14 TX)
                       TX ────────────► (to GPIO15 RX)
                    ┌──────────────┐
                    │   NEO-6M     │
                    │     GPS      │
                    │              │
                    │ (/dev/serial0)│
                    └──────────────┘

                       4V ◄───── External 4V 2A Power Supply
                      GND ◄───── Pi GND + Power Supply GND (common)
                       TX ────► GPIO 4 (Pi RX)
                       RX ◄──── GPIO 17 (Pi TX)
                    ┌──────────────┐
                    │   SIM800L    │
                    │     GSM      │
                    │              │
                    │ Software UART│
                    └──────────────┘
```

---

## Power Supply Setup

### Option 1: Single 5V Power Supply (Recommended)

```
5V 3A Power Supply
    │
    ├──► Raspberry Pi (via micro USB) ────► Powers Pi
    │
    └──► DC-DC Buck Converter (5V → 4V)
             │
             └──► SIM800L VCC (4V 2A capable)
                      GND ──────► Common with Pi GND
```

### Option 2: Dual Power Supplies

```
5V 2.5A Supply ──► Raspberry Pi (via micro USB)
                         │
                         └─► GND (common ground)
                              │
4V 2A Supply ──────► SIM800L VCC
                         │
                         └─► GND (common ground) ◄─┘
```

**CRITICAL:** Always connect grounds together (common ground)!

---

## Testing Each Connection

### Test MPU6050 (I2C)
```bash
sudo i2cdetect -y 1
# Should show device at 0x68
```

### Test GPS (Hardware UART)
```bash
sudo cat /dev/serial0
# Should see NMEA sentences like $GPGGA...
```

### Test SIM800L (Software UART via Python)
```python
import serial
import time

ser = serial.Serial('/dev/serial0', 9600, timeout=1)
time.sleep(2)
ser.write(b'AT\r\n')
print(ser.read(100))  # Should print "OK"
```

---

## Bill of Materials (BOM)

| Component | Quantity | Notes |
|-----------|----------|-------|
| Raspberry Pi Zero WH | 1 | With headers |
| MPU6050 Module | 1 | I2C accelerometer/gyro |
| NEO-6M GPS Module | 1 | With ceramic antenna |
| SIM800L GSM Module | 1 | With antenna, micro SIM slot |
| DC-DC Buck Converter | 1 | 5V → 4V, 2A+ capable |
| Active Nano SIM Card | 1 | With SMS capability |
| 5V 3A Power Supply | 1 | Micro USB for Pi |
| MicroSD Card | 1 | 16GB+ for Raspberry Pi OS |
| Jumper Wires | 20+ | Female-to-female |
| Breadboard (optional) | 1 | For prototyping |

---

## Safety Checklist

- ✅ SIM800L powered from **external 4V supply** (NOT from Pi)
- ✅ Common ground connected between Pi and SIM800L power
- ✅ GPS powered from Pi's **5V pin** (not 3.3V)
- ✅ MPU6050 powered from Pi's **3.3V pin** (not 5V)
- ✅ All ground pins connected to common ground
- ✅ TX/RX pins correctly connected (TX → RX, RX → TX)
- ✅ No short circuits between VCC and GND
- ✅ SIM card inserted and activated
- ✅ GPS antenna has clear view of sky
- ✅ GSM antenna connected

---

## Troubleshooting

**MPU6050 not detected:**
- Check I2C wiring (SDA/SCL not swapped)
- Verify 3.3V power
- Run `sudo i2cdetect -y 1`

**GPS no fix:**
- Move outdoors with clear sky view
- Check antenna connection
- Verify 5V power supply
- Monitor with `sudo cat /dev/serial0`

**SIM800L not responding:**
- **MOST COMMON:** Check 4V power supply provides enough current
- Verify SIM card inserted correctly
- Check TX/RX not swapped
- Ensure common ground connected
- Test with `AT` command

**SMS not sending:**
- Check SIM has credit/active plan
- Verify network registration: `AT+CREG?`
- Check signal strength: `AT+CSQ` (should be >10)
- Use international phone number format: `+CountryCode...`

---

## Additional Notes

- GPS may take 30-180 seconds for cold start (first fix)
- Keep SIM800L antenna away from Pi and GPS antenna to reduce interference
- Use shielded cables for long wire runs
- Consider weatherproof enclosure if using outdoors
- Label all wires for easier troubleshooting

---

*For software setup, see RASPBERRY_PI_SETUP.md*
