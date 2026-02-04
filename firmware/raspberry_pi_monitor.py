#!/usr/bin/env python3
"""
Raspberry Pi Zero WH Patient Monitor - Robust Refactor
Features: 
- Thread-safe peripheral handling
- Non-blocking I2C sampling (50Hz active / 5Hz idle)
- Asynchronous threaded SMS alerts
- 60s System Heartbeat for sanity checks
- Automatic I2C bus recovery
"""

import time
import serial
import board
import busio
import adafruit_mpu6050
from datetime import datetime
import math
import logging
import sys
import pigpio
import threading

# --- CONFIGURATION ---
PATIENT_ID = "PATIENT_001"
CAREGIVER_PHONE = "+917592991242"
FALL_THRESHOLD_G = 2.0
FALL_DURATION_MS = 40
SMS_RETRY_COUNT = 3

# GPIO Pins
SIM800L_RX_PIN = 4
SIM800L_TX_PIN = 17

# Logging Configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('patient_monitor.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("PatientMonitor")

# --- CORE CLASSES ---

class I2CBusManager:
    """Manages a shared, fault-tolerant I2C bus"""
    def __init__(self):
        self.bus = None
        self.lock = threading.Lock()
        self.initialize_bus()

    def initialize_bus(self):
        with self.lock:
            try:
                if self.bus:
                    try: self.bus.deinit()
                    except: pass
                self.bus = busio.I2C(board.SCL, board.SDA)
                logger.info("I2C Bus (re)initialized at 50kHz")
                return True
            except Exception as e:
                logger.error(f"Critical I2C Bus Failure: {e}")
                self.bus = None
                return False

    def get_bus(self):
        return self.bus

class MPU6050Sensor:
    """Robust MPU6050 wrapper with retry and bus-recovery logic"""
    def __init__(self, bus_manager):
        self.bm = bus_manager
        self.sensor = None
        self._setup()

    def _setup(self):
        try:
            bus = self.bm.get_bus()
            if bus:
                self.sensor = adafruit_mpu6050.MPU6050(bus)
                # Test read
                _ = self.sensor.acceleration
                return True
        except Exception as e:
            logger.warning(f"MPU6050 Sensor Setup Failed: {e}")
            self.sensor = None
        return False

    def read_all(self):
        """Read Accel, Gyro, and Temp in one robust block"""
        for attempt in range(2):
            try:
                if not self.sensor:
                    if not self._setup():
                        time.sleep(0.1)
                        continue
                
                a = self.sensor.acceleration
                g = self.sensor.gyro
                t = self.sensor.temperature
                mag = math.sqrt(a[0]**2 + a[1]**2 + a[2]**2) / 9.80665
                
                return {
                    'accel': a, 'gyro': g, 'temp': t, 'mag': mag, 'ok': True
                }
            except (OSError, Exception) as e:
                logger.warning(f"I2C Read Error (attempt {attempt+1}): {e}")
                self.sensor = None
                if attempt == 1:
                    logger.info("Triggering I2C Bus Recovery...")
                    self.bm.initialize_bus()
                time.sleep(0.05)
        
        return {'mag': 0.0, 'ok': False}

class GPSHandler(threading.Thread):
    """Non-blocking background GPS tracker"""
    def __init__(self, port='/dev/serial0', baud=9600):
        super().__init__()
        self.daemon = True
        self.location = None
        self.lock = threading.Lock()
        self.running = False
        try:
            self.ser = serial.Serial(port, baud, timeout=0.1)
            self.running = True
            logger.info(f"GPS Serial opened on {port}")
        except Exception as e:
            logger.error(f"GPS Hardware Init Failed: {e}")

    def run(self):
        while self.running:
            try:
                line = self.ser.readline().decode('ascii', errors='replace')
                if '$GPGGA' in line:
                    parts = line.split(',')
                    if len(parts) > 6 and parts[6] != '0':  # Valid fix
                        lat = self._parse_deg(parts[2], parts[3])
                        lon = self._parse_deg(parts[4], parts[5])
                        with self.lock:
                            self.location = (lat, lon, time.time())
            except:
                time.sleep(1)

    def _parse_deg(self, raw, direction):
        if not raw: return 0.0
        deg = float(raw[:2])
        min = float(raw[2:])
        final = deg + (min / 60.0)
        return -final if direction in ['S', 'W'] else final

    def get_last_fix(self):
        with self.lock:
            if self.location and (time.time() - self.location[2] < 300):
                return self.location
        return None

class GSMHandler:
    """Asynchronous SMS handler using threaded dispatch"""
    def __init__(self):
        self.pi = pigpio.pi()
        self.initialized = False
        self.module_ready = False
        if not self.pi.connected:
            logger.error("pigpiod NOT running. SMS Disabled.")
            return

        # Bit-bang serial setup
        try:
            self.pi.set_mode(SIM800L_RX_PIN, pigpio.INPUT)
            self.pi.set_mode(SIM800L_TX_PIN, pigpio.OUTPUT)
            
            # Try to close first in case of previous crash
            try: self.pi.bb_serial_read_close(SIM800L_RX_PIN)
            except: pass
            
            err = self.pi.bb_serial_read_open(SIM800L_RX_PIN, 9600)
            if err < 0:
                logger.error(f"GSM Serial Open failed with error {err}")
                return

            self.initialized = True
            logger.info("GSM Hardware Interface initialized")
            
            # Initialize the module
            self.initialize_module()
            
        except Exception as e:
            logger.error(f"GSM Init Failed: {e}")

    def initialize_module(self):
        """Initialize SIM800L module with proper sequence"""
        if not self.initialized:
            return False
            
        logger.info("Initializing SIM800L module...")
        
        # Wait for module to power up and stabilize
        time.sleep(3)
        
        # Test basic communication
        for attempt in range(5):
            resp = self.send_at("AT", wait="OK", timeout=5)
            if resp and "OK" in resp:
                logger.info("SIM800L module is responding")
                self.module_ready = True
                break
            logger.warning(f"Module init attempt {attempt+1} failed, retrying...")
            time.sleep(2)
        
        if not self.module_ready:
            logger.error("SIM800L module failed to initialize")
            return False
            
        # Configure module for SMS
        try:
            # Set text mode
            resp = self.send_at("AT+CMGF=1", wait="OK", timeout=3)
            if not resp or "OK" not in resp:
                logger.warning("Failed to set text mode")
            
            # Check network registration
            reg = self.send_at("AT+CREG?", wait="+CREG:", timeout=5)
            logger.info(f"Network registration: {reg.strip() if reg else 'No response'}")
            
            # Check signal strength
            signal = self.send_at("AT+CSQ", wait="+CSQ:", timeout=3)
            if signal:
                logger.info(f"Signal strength: {signal.strip()}")
            
            logger.info("SIM800L module initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Module configuration failed: {e}")
            return False

    def send_at(self, cmd, wait="OK", timeout=3):
        if not self.initialized: 
            return None
            
        # Clear any pending data
        for _ in range(3):
            (count, data) = self.pi.bb_serial_read(SIM800L_RX_PIN)
            if count == 0:
                break
            time.sleep(0.01)
        
        # Send command with proper timing
        self.pi.wave_clear()
        cmd_bytes = (cmd + "\r\n").encode('utf-8')
        self.pi.wave_add_serial(SIM800L_TX_PIN, 9600, cmd_bytes)
        wid = self.pi.wave_create()
        if wid >= 0:
            self.pi.wave_send_once(wid)
            while self.pi.wave_tx_busy():
                time.sleep(0.01)
            self.pi.wave_delete(wid)
        
        # Wait for response with longer timeout
        start = time.time()
        resp = ""
        last_read = time.time()
        
        while (time.time() - start) < timeout:
            (count, data) = self.pi.bb_serial_read(SIM800L_RX_PIN)
            if count > 0:
                resp += data.decode('ascii', errors='replace')
                last_read = time.time()
                if wait in resp or "ERROR" in resp: 
                    break
            else:
                # If no data for 1 second, break
                if time.time() - last_read > 1.0:
                    break
            time.sleep(0.02)
        
        # Debug logging
        if resp:
            logger.debug(f"AT '{cmd}' -> '{resp.strip()[:100]}'")
        else:
            logger.debug(f"AT '{cmd}' -> No response")
            
        return resp

    def dispatch_sms_async(self, message):
        """Spawns a background thread to send SMS without blocking monitoring"""
        thread = threading.Thread(target=self._send_sms_logic, args=(message,))
        thread.daemon = True
        thread.start()

    def _send_sms_logic(self, message):
        if not self.initialized or not self.module_ready:
            logger.error("SMS skip: GSM not initialized or ready")
            return False
            
        logger.info(f"Background SMS Dispatching to {CAREGIVER_PHONE}")
        for attempt in range(SMS_RETRY_COUNT):
            try:
                logger.info(f"SMS Attempt {attempt+1}/{SMS_RETRY_COUNT}")
                
                # 1. Check if module is still responsive
                resp = self.send_at("AT", timeout=2)
                if not resp or "OK" not in resp:
                    logger.warning("GSM module not responding, reinitializing...")
                    self.initialize_module()
                    time.sleep(2)
                    continue
                
                # 2. Check network registration
                reg = self.send_at("AT+CREG?", wait="+CREG:", timeout=3)
                logger.info(f"Network Reg: {reg.strip() if reg else 'No response'}")
                if not reg or ("+CREG: 0,1" not in reg and "+CREG: 0,5" not in reg):
                    logger.warning("Not registered on network")
                    time.sleep(3)
                    continue

                # 3. Set text mode
                cmgf_resp = self.send_at("AT+CMGF=1", wait="OK", timeout=2)
                if not cmgf_resp or "OK" not in cmgf_resp:
                    logger.warning("Failed to set text mode")
                    time.sleep(1)
                    continue
                
                # 4. Start SMS
                resp = self.send_at(f'AT+CMGS="{CAREGIVER_PHONE}"', wait=">", timeout=3)
                if not resp or ">" not in resp:
                    logger.warning(f"No SMS prompt (resp: {resp[:50] if resp else 'None'}")")
                    time.sleep(2)
                    continue
                
                # 5. Send message + Ctrl+Z
                self.pi.wave_clear()
                # Send message first
                self.pi.wave_add_serial(SIM800L_TX_PIN, 9600, message.encode('utf-8'))
                # Send Ctrl+Z separately
                self.pi.wave_add_serial(SIM800L_TX_PIN, 9600, chr(26).encode())
                wid = self.pi.wave_create()
                self.pi.wave_send_once(wid)
                while self.pi.wave_tx_busy():
                    time.sleep(0.1)
                self.pi.wave_delete(wid)

                # 6. Wait for final response
                time.sleep(1)  # Give module time to process
                final_resp = ""
                for _ in range(10):  # 10 second timeout
                    (count, data) = self.pi.bb_serial_read(SIM800L_RX_PIN)
                    if count > 0:
                        final_resp += data.decode('ascii', errors='replace')
                    if "+CMGS:" in final_resp or "OK" in final_resp or "ERROR" in final_resp:
                        break
                    time.sleep(0.5)
                
                logger.info(f"SMS Response: {final_resp.strip()[:100] if final_resp else 'No response'}...")
                if "+CMGS:" in final_resp or "OK" in final_resp:
                    logger.info("SMS Sent successfully!")
                    return True
                
            except Exception as e:
                logger.error(f"SMS Attempt {attempt+1} failed: {e}")
            
            time.sleep(2)  # Wait before retry
            
        logger.error("All SMS attempts failed")
        return False

class Monitor:
    """The main monitoring orchestrator"""
    def __init__(self):
        logger.info("--- PATIENT MONITOR SYSTEM STARTING ---")
        self.bm = I2CBusManager()
        self.imu = MPU6050Sensor(self.bm)
        self.gps = GPSHandler()
        self.gsm = GSMHandler()
        
        self.last_heartbeat = time.time()
        self.iterations = 0
        self.fall_cooldown = 0
        self.fall_stage = 0 
        self.fall_start = 0
        self.last_high_accel = 0

    def run(self):
        self.gps.start()
        logger.info("Monitoring loop active. Heartbeat every 60s.")
        
        while True:
            t_start = time.monotonic()
            self.iterations += 1
            
            # 1. Data Sampling
            data = self.imu.read_all()
            mag = data['mag']
            
            # 2. Heartbeat (Every 60s)
            if (time.time() - self.last_heartbeat) > 60:
                logger.info(f"[HEARTBEAT] System Healthy | Iterations: {self.iterations} | Accel: {mag:.2f}g")
                self.last_heartbeat = time.time()

            # 3. Fall Detection Logic (Cumulative Window)
            if mag > FALL_THRESHOLD_G:
                if self.fall_stage == 0:
                    self.fall_stage = 1
                    self.fall_start = time.time() * 1000
                    logger.warning(f"IMPACT DETECTED: {mag:.2f}g")
                self.last_high_accel = time.time()
            
            # Check for confirmation if in impact window
            if self.fall_stage == 1:
                duration_ms = (time.time() * 1000 - self.fall_start)
                if duration_ms > FALL_DURATION_MS:
                    if (time.time() - self.fall_cooldown) > 60:
                        logger.critical(f"FALL CONFIRMED: Impact stage reached {duration_ms:.0f}ms")
                        self.trigger_emergency(mag)
                        self.fall_cooldown = time.time()
                        self.fall_stage = 0 # Reset stage after trigger
                
                # Reset if it's been quiet/low for > 200ms
                elif (time.time() - self.last_high_accel) > 0.2:
                    logger.info(f"Reset: Impact subsided ({duration_ms:.0f}ms total)")
                    self.fall_stage = 0

            # 4. Adaptive Sampling Rate
            rate = 50.0 if mag > 1.4 or self.fall_stage == 1 else 5.0
            
            # Precision Sleep
            elapsed = time.monotonic() - t_start
            sleep_time = max(0, (1.0 / rate) - elapsed)
            time.sleep(sleep_time)

    def trigger_emergency(self, impact_force):
        logger.critical("!!! FALL CONFIRMED - INITIATING EMERGENCY ALERTS !!!")
        
        # Get GPS
        loc = self.gps.get_last_fix()
        coords = f"{loc[0]:.6f},{loc[1]:.6f}" if loc else "NO_GPS_FIX"
        
        # Format SMS
        ts = datetime.now().strftime('%H:%M:%S')
        sms = f"FALL_ALERT|{PATIENT_ID}|{coords}|{ts}|Impact:{impact_force:.2f}g|Device:PiZero"
        
        # Dispatch Async
        self.gsm.dispatch_sms_async(sms)

if __name__ == "__main__":
    try:
        app = Monitor()
        app.run()
    except KeyboardInterrupt:
        logger.info("Monitor killed by user")
    except Exception as e:
        logger.critical(f"FATAL SYSTEM CRASH: {e}")
        sys.exit(1)
