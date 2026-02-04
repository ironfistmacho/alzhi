# 🥧 Raspberry Pi Patient Monitor: Complete Setup Guide

This guide covers the **Fall Detection & GPS Alert** unit. Follow these steps in order.

---

## 🛠️ Phase 1: Hardware Wiring

Connect the components according to the table below. Use the [**WIRING_DIAGRAM.md**](./WIRING_DIAGRAM.md) for a visual schematic.

### 1. MPU6050 (Fall Sensor)
| MPU6050 Pin | → | Pi Pin | GPIO |
| :--- | :--- | :--- | :--- |
| **VCC** | → | Pin 1 | 3.3V |
| **GND** | → | Pin 6 | GND |
| **SCL** | → | Pin 5 | GPIO 3 |
| **SDA** | → | Pin 3 | GPIO 2 |

### 2. NEO-6M (GPS Module)
| GPS Pin | → | Pi Pin | GPIO |
| :--- | :--- | :--- | :--- |
| **VCC** | → | Pin 2 | 5V |
| **GND** | → | Pin 39 (or any GND) | GND |
| **TX** | → | Pin 10 | GPIO 15 (RX) |
| **RX** | → | Pin 8 | GPIO 14 (TX) |

### 3. SIM800L (GSM/SMS Module)
> [!IMPORTANT]
> **SIM800L requires 4V at 2A.** Do NOT power it from the Raspberry Pi pins. Use an external battery or buck converter.

| SIM800L Pin | → | Connection |
| :--- | :--- | :--- |
| **VCC** | → | **External 4V Supply (+)** |
| **GND** | → | **External 4V Supply (-) AND Pi Pin 9 (GND)** |
| **TX** | → | **Pi Pin 7 (GPIO 4)** |
| **RX** | → | **Pi Pin 11 (GPIO 17)** |

---

## 💻 Phase 2: Raspberry Pi OS Setup

### 1. Enable Hardware Interfaces
Run the configuration tool:
```bash
sudo raspi-config
```
Go to **Interface Options** and enable:
- **I2C**: Yes
- **Serial Port**: 
  - Login shell over serial? → **No**
  - Serial port hardware enabled? → **Yes**
- **Finish** and **Reboot**.

### 2. Configure UART for GPS/GSM
Open the boot configuration:
```bash
sudo nano /boot/config.txt
```
Scroll to the bottom and add these lines:
```text
dtoverlay=disable-bt
enable_uart=1
# Lower I2C baudrate for stability (default is 100000)
dtparam=i2c_arm_baudrate=50000
```
*(Press `Ctrl+O`, `Enter`, then `Ctrl+X` to save)*

---

## 🐍 Phase 3: Software Installation

### 1. Install Dependencies
Run these commands to install the required libraries:
```bash
sudo apt-get update
sudo apt-get install python3-pip i2c-tools pigpio python3-pigpio -y
sudo pip3 install adafruit-circuitpython-mpu6050 pyserial

# Enable and start pigpiod daemon (REQUIRED for GSM)
sudo systemctl enable pigpiod
sudo systemctl start pigpiod
```

### 2. Verify Hardware
**Test MPU6050 (I2C):**
```bash
sudo i2cdetect -y 1
```
*You should see `68` in the output grid.*

**Test GPS (Serial):**
```bash
sudo cat /dev/serial0
```
*You should see text starting with `$GP...`. If not, move the antenna near a window.*

---

## 🚀 Phase 4: Deploy Monitoring App

### 1. Setup Files
Create the project folder:
```bash
sudo mkdir -p /opt/patient_monitor
sudo nano /opt/patient_monitor/raspberry_pi_monitor.py
```
**Paste the complete code from your project file:**
`C:\Users\alber\OneDrive\Documents\alzhi\firmware\raspberry_pi_monitor.py`

### 2. Configure Your Settings
Inside the file, update these lines:
```python
PATIENT_ID = "PATIENT_001"
CAREGIVER_PHONE = "+1XXXXXXXXXX"  # YOUR phone number
```

### 3. Test Run
```bash
cd /opt/patient_monitor
python3 raspberry_pi_monitor.py
```
*Shake the Pi to simulate a fall. You should receive an SMS within 30 seconds.*

---

## 🔄 Phase 5: Auto-Start (Service)

To make the monitor start every time you turn the Pi on:
1. Create the service file:
   ```bash
   sudo nano /etc/systemd/system/patient-monitor.service
   ```
2. Paste this:
   ```ini
   [Unit]
   Description=Patient Monitor Service
   After=network.target

   [Service]
   ExecStart=/usr/bin/python3 /opt/patient_monitor/raspberry_pi_monitor.py
   WorkingDirectory=/opt/patient_monitor
   Restart=always
   User=root

   [Install]
   WantedBy=multi-user.target
   ```
3. Start it:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable patient-monitor.service
   sudo systemctl start patient-monitor.service
   ```

---

## 🛑 Common Fixes
- **No SMS?** Check if SIM card has balance and the 4V power supply is connected to Pi GND.
- **No GPS Fix?** The ceramic antenna must be outside or near a window.
- **MPU6050 Error?** Check if SDA/SCL wires are swapped.
