#!/usr/bin/env python3
"""
Raspberry Pi Zero WH Patient Monitor - Optimized Version
Features:
- Hardware-optimized pin connections
- Robust error handling and recovery
- Real-time fall detection
- GPS location tracking
- SMS alerts
- System health monitoring
"""

import time
import os
import serial
import board
import busio
import adafruit_mpu6050
import math
import logging
import sys
import RPi.GPIO as GPIO
import threading
import atexit
import subprocess
from datetime import datetime

# Try to import pigpio, but make it optional
try:
    import pigpio
    PIGPIO_AVAILABLE = True
except ImportError:
    PIGPIO_AVAILABLE = False
    logging.warning("pigpio library not found. Some features may be limited.")

# --- HARDWARE CONFIGURATION ---
# Device Identification
PATIENT_ID = "PATIENT_001"
CAREGIVER_PHONE = "+917592991242"  # Replace with actual number

# Fall Detection Parameters
FALL_THRESHOLD_G = 2.0     # Adjust sensitivity (2.0g is standard for fall detection)
FALL_DURATION_MS = 40      # Duration in milliseconds for impact detection
ALERT_COOLDOWN = 300       # 5 minutes between alerts (prevents spam)
SAMPLE_RATE = 50           # Sensor sampling rate (Hz)
SMS_RETRY_COUNT = 3        # Number of SMS retry attempts

# Hardware Pins (BCM numbering)
# Power Management
POWER_EN_PIN = 4           # GPIO4 (Pin 7) - Main power enable
BATTERY_ADC_PIN = 0        # MCP3008 channel 0 for battery monitoring

# GSM Module (SIM800L)
SIM800L_POWER_PIN = 17      # GPIO17 (Pin 11) - Power key
SIM800L_RST_PIN = 27       # GPIO27 (Pin 13) - Reset pin
SIM800L_RX_PIN = 15        # GPIO15 (Pin 10) - UART0 RX
SIM800L_TX_PIN = 14        # GPIO14 (Pin 8)  - UART0 TX

# GPS Module
GPS_POWER_PIN = 22         # GPIO22 (Pin 15) - Power control
GPS_RX_PIN = 10            # GPIO10 (Pin 19) - UART1 RX
GPS_TX_PIN = 8             # GPIO8 (Pin 24)  - UART1 TX

# I2C Devices (MPU6050)
I2C_SDA_PIN = 2            # GPIO2 (Pin 3) - I2C1 SDA
I2C_SCL_PIN = 3            # GPIO3 (Pin 5) - I2C1 SCL

# User Interface
BUZZER_PIN = 23            # GPIO23 (Pin 16) - Buzzer
BUTTON_PIN = 24            # GPIO24 (Pin 18) - Emergency button
LED_PIN = 25               # GPIO25 (Pin 22) - Status LED

# File paths
import os
LOG_DIR = os.path.join(os.path.expanduser("~"), ".patient_monitor")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "patient_monitor.log")
CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".config/patient_monitor")
os.makedirs(CONFIG_DIR, exist_ok=True)
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.ini")

def setup_logging():
    """Configure logging to both file and console with fallback to stderr"""
    # Create log formatter
    log_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    
    logger = logging.getLogger("PatientMonitor")
    logger.setLevel(logging.DEBUG)  # Enable debug logging to see GPS data
    
    try:
        # Create logs directory if it doesn't exist
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        
        # Try to set permissions on the directory (rwxr-x---)
        try:
            os.chmod(os.path.dirname(LOG_FILE), 0o750)
        except:
            pass
        
        # File handler
        try:
            file_handler = logging.FileHandler(LOG_FILE)
            file_handler.setFormatter(log_formatter)
            # Set file permissions (rw-r-----)
            try:
                os.chmod(LOG_FILE, 0o640)
            except:
                pass
            logger.addHandler(file_handler)
        except (IOError, PermissionError) as e:
            sys.stderr.write(f"Warning: Could not write to log file {LOG_FILE}: {e}\n")
    except Exception as e:
        sys.stderr.write(f"Warning: Could not create log directory: {e}\n")
    
    # Always log to console
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(log_formatter)
    logger.addHandler(console_handler)
    
    # Set log level
    logger.setLevel(logging.INFO)
    
    # Disable debug logs from libraries
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('serial').setLevel(logging.WARNING)
    logging.getLogger('RPi.GPIO').setLevel(logging.WARNING)
    
    return logger

# Initialize logger
logger = setup_logging()

# --- CORE CLASSES ---

class HardwareManager:
    """Manages hardware initialization and cleanup"""
    
    @staticmethod
    def setup_gpio():
        """Initialize all GPIO pins"""
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            
            # Set up power management
            GPIO.setup(POWER_EN_PIN, GPIO.OUT)
            GPIO.output(POWER_EN_PIN, GPIO.HIGH)  # Enable power
            
            # GSM module - Only set up RST pin if PWR pin is not available
            GPIO.setup(SIM800L_RST_PIN, GPIO.OUT)
            GPIO.output(SIM800L_RST_PIN, GPIO.HIGH)  # Active low reset
            
            # GPS module
            GPIO.setup(GPS_POWER_PIN, GPIO.OUT)
            GPIO.output(GPS_POWER_PIN, GPIO.HIGH)  # Enable GPS power
            
            # User interface
            GPIO.setup(BUZZER_PIN, GPIO.OUT)
            GPIO.setup(LED_PIN, GPIO.OUT)
            GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
            
            # Turn off buzzer initially
            GPIO.output(BUZZER_PIN, GPIO.LOW)
            # Blink LED to indicate startup
            for _ in range(3):
                GPIO.output(LED_PIN, GPIO.HIGH)
                time.sleep(0.2)
                GPIO.output(LED_PIN, GPIO.LOW)
                time.sleep(0.2)
            
            # Initialize GSM module
            HardwareManager.reset_gsm()
                
            logger.info("GPIO and GSM initialization complete")
            return True
            
        except Exception as e:
            logger.error(f"GPIO initialization failed: {e}")
            return False
    
    @staticmethod
    def reset_gsm():
        """Reset the GSM module using RST pin"""
        try:
            logger.info("Resetting GSM module...")
            # Reset the module
            GPIO.output(SIM800L_RST_PIN, GPIO.LOW)
            time.sleep(1)
            GPIO.output(SIM800L_RST_PIN, GPIO.HIGH)
            time.sleep(5)  # Allow time for module to restart
            logger.info("GSM module reset complete")
            return True
        except Exception as e:
            logger.error(f"Error resetting GSM: {e}")
            return False
            
    @staticmethod
    def power_cycle_gsm():
        """Alias for reset_gsm for backward compatibility"""
        return HardwareManager.reset_gsm()


class I2CManager:
    """Manages I2C communication with automatic recovery"""
    
    def __init__(self):
        self.bus = None
        self.lock = threading.Lock()
        self.initialize()
        atexit.register(self.cleanup)
        
    def get_bus(self):
        """Get the I2C bus instance"""
        with self.lock:
            if not self.bus and not self.initialize():
                return None
            return self.bus

    def initialize(self):
        """Initialize or reinitialize I2C bus"""
        with self.lock:
            try:
                if self.bus:
                    try:
                        self.bus.deinit()
                    except:
                        pass
                
                # Initialize I2C with specific pins
                self.bus = busio.I2C(
                    scl=board.D3,  # GPIO3 (Pin 5)
                    sda=board.D2,  # GPIO2 (Pin 3)
                    frequency=400000  # 400kHz
                )
                
                # Test the bus
                while not self.bus.try_lock():
                    pass
                try:
                    devices = self.bus.scan()
                    logger.info(f"I2C devices found: {[hex(addr) for addr in devices]}")
                finally:
                    self.bus.unlock()
                
                logger.info("I2C bus initialized at 400kHz")
                return True
                
            except Exception as e:
                logger.error(f"I2C initialization failed: {e}")
                self.bus = None
                return False
    
    def read_register(self, device, register, length):
        """Thread-safe I2C read"""
        with self.lock:
            if not self.bus and not self.initialize():
                return None
                
            try:
                result = bytearray(length)
                self.bus.writeto(device, bytes([register]))
                self.bus.readfrom_into(device, result)
                return result
            except Exception as e:
                logger.error(f"I2C read failed: {e}")
                self.bus = None
                return None
    
    def cleanup(self):
        """Clean up resources"""
        self.running = False
        if hasattr(self, 'gsm') and self.gsm:
            self.gsm.initialized = False
            # Clean up pigpio if it was used
            if hasattr(self.gsm, 'pi') and self.gsm.pi is not None:
                try:
                    self.gsm.pi.stop()
                except:
                    pass
        if hasattr(self, 'gps') and self.gps:
            self.gps.running = False
        try:
            GPIO.cleanup()
        except:
            pass
        logging.info("System shutdown complete")

class MPU6050Sensor:
    """Robust MPU6050 wrapper with retry and bus-recovery logic"""
    def __init__(self, i2c_manager):
        self.i2c = i2c_manager
        self.sensor = None
        self._setup()

    def _setup(self):
        try:
            if not self.i2c.bus:
                if not self.i2c.initialize():
                    return False
            
            # Initialize MPU6050 with the I2C bus
            self.sensor = adafruit_mpu6050.MPU6050(self.i2c.bus)
            
            # Test read to verify connection
            _ = self.sensor.acceleration
            logger.info("MPU6050 initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize MPU6050: {e}")
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
                    self.i2c.initialize()
                time.sleep(0.05)
        
        return {'mag': 0.0, 'ok': False}

class GPSHandler(threading.Thread):
    """Non-blocking background GPS tracker using software serial"""
    def __init__(self, port=None, baud=9600):
        self._rx_pin = 10  # GPIO10 (Pin 19) - GPS RX
        self._tx_pin = 8   # GPIO8 (Pin 24) - GPS TX
        self._baud = baud
        self._use_sw_uart = True
        self.pi = None
        
        super().__init__()
        self.daemon = True
        self.location = None
        self.lock = threading.Lock()
        self.running = False
        
        try:
            # Initialize pigpio for software serial
            if PIGPIO_AVAILABLE:
                self.pi = pigpio.pi()
                if not self.pi.connected:
                    logger.error("pigpiod not running for GPS, falling back to hardware serial")
                    self._use_sw_uart = False
                else:
                    logger.info("GPS using software serial via pigpio")
            else:
                logger.warning("pigpio not available for GPS")
                self._use_sw_uart = False
            
            if self._use_sw_uart and self.pi:
                # Ensure GPS is powered on
                try:
                    GPIO.setup(GPS_POWER_PIN, GPIO.OUT)
                    GPIO.output(GPS_POWER_PIN, GPIO.HIGH)
                    logger.info("GPS power enabled via GPIO22")
                    time.sleep(1)  # Give GPS time to power up
                except Exception as e:
                    logger.warning(f"Could not control GPS power: {e}")
                
                # Set up software serial
                self.pi.set_mode(self._rx_pin, pigpio.INPUT)
                self.pi.set_mode(self._tx_pin, pigpio.OUTPUT)
                
                # Open serial read
                try:
                    self.pi.bb_serial_read_close(self._rx_pin)
                except:
                    pass
                    
                err = self.pi.bb_serial_read_open(self._rx_pin, self._baud)
                if err < 0:
                    logger.error(f"GPS software serial open failed: {err}")
                    self._use_sw_uart = False
                else:
                    logger.info(f"GPS software serial initialized on GPIO{self._rx_pin}/GPIO{self._tx_pin} at {baud} baud")
                    
                    # Test GPS communication by sending a simple command
                    time.sleep(2)  # Wait for GPS to be ready
                    try:
                        # Send a test command to see if GPS responds
                        self.pi.wave_clear()
                        test_cmd = b'$PMTK000*32\r\n'  # Generic test command
                        self.pi.wave_add_serial(self._tx_pin, self._baud, test_cmd)
                        wid = self.pi.wave_create()
                        self.pi.wave_send_once(wid)
                        while self.pi.wave_tx_busy():
                            time.sleep(0.1)
                        self.pi.wave_delete(wid)
                        logger.info("GPS test command sent")
                    except Exception as e:
                        logger.warning(f"GPS test command failed: {e}")
                    
                    self.running = True
            else:
                # Fallback to hardware serial (will conflict with GSM)
                logger.warning("GPS falling back to hardware serial (may conflict with GSM)")
                for test_port in ['/dev/serial1', '/dev/ttyS1', '/dev/ttyAMA1']:
                    if os.path.exists(test_port):
                        port = test_port
                        logger.info(f"GPS using hardware serial: {port}")
                        break
                else:
                    port = '/dev/serial0'
                    logger.warning(f"GPS using default serial: {port}")
                
                try:
                    self.ser = serial.Serial(port, baudrate=self._baud, timeout=0.1)
                    logger.info(f"GPS hardware serial initialized on {port}")
                    self.running = True
                except Exception as e:
                    logger.error(f"Failed to open GPS serial {port}: {e}")
                    self.running = False
                
        except Exception as e:
            logger.error(f"GPS Initialization failed: {e}")
            self.running = False

    def run(self):
        last_status_log = 0
        buffer = ""
        last_data_time = time.time()
        
        while self.running:
            try:
                if self._use_sw_uart and self.pi:
                    # Software serial using pigpio
                    (count, data) = self.pi.bb_serial_read(self._rx_pin)
                    if count > 0:
                        last_data_time = time.time()
                        buffer += data.decode('ascii', errors='replace')
                        logger.debug(f"GPS raw data: {data.decode('ascii', errors='replace').strip()}")
                        
                        # Process complete lines
                        while '\n' in buffer:
                            line, buffer = buffer.split('\n', 1)
                            line = line.strip()
                            self._process_gps_line(line, last_status_log)
                    else:
                        # Log every 30 seconds if no data received
                        if time.time() - last_data_time > 30:
                            logger.warning("No GPS data received in last 30 seconds - check connections")
                            last_data_time = time.time()
                else:
                    # Hardware serial
                    if hasattr(self, 'ser') and self.ser.in_waiting > 0:
                        line = self.ser.readline().decode('ascii', errors='replace')
                        logger.debug(f"GPS raw data: {line.strip()}")
                        self._process_gps_line(line.strip(), last_status_log)
                    else:
                        time.sleep(0.1)
                        
            except Exception as e:
                logger.warning(f"GPS read error: {e}")
                time.sleep(1)
    
    def _process_gps_line(self, line, last_status_log):
        """Process a single NMEA sentence"""
        # Log any NMEA sentences for debugging
        if line.startswith('$') and any(x in line for x in ['GPGGA', 'GNGGA', 'GPRMC', 'GPGSA']):
            logger.debug(f"GPS NMEA: {line}")
        
        if '$GPGGA' in line or '$GNGGA' in line:
            parts = line.split(',')
            if len(parts) > 6:
                fix_quality = int(parts[6]) if parts[6] else 0
                satellites = int(parts[7]) if parts[7] else 0
                
                # Log GPS status every 30 seconds
                if time.time() - last_status_log > 30:
                    logger.info(f"GPS Status: Fix={fix_quality}, Sats={satellites}")
                    last_status_log = time.time()
                
                if fix_quality > 0 and parts[2] and parts[4]:  # Valid fix with data
                    lat = self._parse_deg(parts[2], parts[3])
                    lon = self._parse_deg(parts[4], parts[5])
                    with self.lock:
                        self.location = (lat, lon, time.time())
                        logger.info(f"GPS Fix: {lat:.6f}, {lon:.6f} ({satellites} satellites)")

    def _parse_deg(self, raw, direction):
        if not raw: return 0.0
        try:
            # NMEA format: DDMM.MMMM for Latitude, DDDMM.MMMM for Longitude
            # The last 2 digits before the decimal are always minutes
            raw_float = float(raw)
            degrees = int(raw_float / 100)
            minutes = raw_float % 100
            final = degrees + (minutes / 60.0)
            return -final if direction in ['S', 'W'] else final
        except (ValueError, TypeError, Exception) as e:
            logger.debug(f"GPS parse error for '{raw}': {e}")
            return 0.0

    def get_last_fix(self):
        with self.lock:
            if self.location and (time.time() - self.location[2] < 300):
                return self.location
        return None
    
    def get_gps_status(self):
        """Get detailed GPS status for SMS reporting"""
        with self.lock:
            if self.location and (time.time() - self.location[2] < 300):
                age = int(time.time() - self.location[2])
                return f"GPS_OK({age}s)"
            else:
                return "GPS_NO_FIX"

class GSMHandler:
    """Asynchronous SMS handler using threaded dispatch"""
    SMS_RETRY_COUNT = 3  # Class constant for SMS retry attempts
    
    def __init__(self):
        self.initialized = False
        self.module_ready = False
        self.pi = None
        
        if PIGPIO_AVAILABLE:
            try:
                self.pi = pigpio.pi()
            except Exception as e:
                logging.error(f"Failed to initialize pigpio: {e}")
                self.pi = None
        else:
            logging.warning("pigpio not available. Using basic GPIO mode.")
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
        for attempt in range(self.SMS_RETRY_COUNT):
            try:
                logger.info(f"SMS Attempt {attempt+1}/{self.SMS_RETRY_COUNT}")
                
                # 1. Check if module is still responsive
                resp = self.send_at("AT", timeout=2)
                if not resp or "OK" not in resp:
                    logger.warning("GSM module not responding, attempting hardware reset...")
                    # Try hardware reset first
                    HardwareManager.reset_gsm()
                    time.sleep(3)
                    # Then try software reinitialization
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
                    logger.warning(f"No SMS prompt (resp: {resp[:50] if resp else 'None'}")
                    time.sleep(2)
                    continue
                
                # 5. Send message + Ctrl+Z with proper timing
                self.pi.wave_clear()
                # Send message content
                message_bytes = message.encode('utf-8')
                self.pi.wave_add_serial(SIM800L_TX_PIN, 9600, message_bytes)
                wid = self.pi.wave_create()
                self.pi.wave_send_once(wid)
                while self.pi.wave_tx_busy():
                    time.sleep(0.1)
                self.pi.wave_delete(wid)
                
                # Small delay between message and Ctrl+Z
                time.sleep(0.5)
                
                # Send Ctrl+Z to end message
                self.pi.wave_clear()
                self.pi.wave_add_serial(SIM800L_TX_PIN, 9600, chr(26).encode())
                wid = self.pi.wave_create()
                self.pi.wave_send_once(wid)
                while self.pi.wave_tx_busy():
                    time.sleep(0.1)
                self.pi.wave_delete(wid)

                # 6. Wait for final response with longer timeout
                time.sleep(3)  # Give module more time to process SMS
                final_resp = ""
                start_time = time.time()
                
                # Wait up to 15 seconds for SMS response
                while (time.time() - start_time) < 15:
                    (count, data) = self.pi.bb_serial_read(SIM800L_RX_PIN)
                    if count > 0:
                        chunk = data.decode('ascii', errors='replace')
                        final_resp += chunk
                        logger.debug(f"SMS chunk: {chunk.strip()}")
                        
                        # Check for success indicators
                        if "+CMGS:" in final_resp:
                            logger.info("SMS reference received")
                            # Wait for final OK
                            continue
                        elif "Call Ready" in final_resp and "SMS Ready" in final_resp:
                            logger.info("SMS Sent successfully! (Call Ready + SMS Ready)")
                            return True
                        elif "OK" in final_resp and "+CMGS:" in final_resp:
                            logger.info("SMS Sent successfully! (CMGS + OK)")
                            return True
                        elif "SMS Ready" in final_resp:
                            logger.info("SMS appears to be sent! (SMS Ready)")
                            return True
                        elif "Call Ready" in final_resp:
                            logger.info("SMS appears to be sent! (Call Ready)")
                            return True
                        elif "ERROR" in final_resp:
                            logger.error(f"SMS Error: {final_resp}")
                            break
                    
                    time.sleep(0.2)
                
                logger.info(f"SMS Final Response: {final_resp.strip()[:200] if final_resp else 'No response'}...")
                
                # Check if we got any success indicators
                if ("+CMGS:" in final_resp or 
                    "SMS Ready" in final_resp or 
                    "Call Ready" in final_resp):
                    logger.info("SMS appears to be sent successfully!")
                    return True
                
            except Exception as e:
                logger.error(f"SMS Attempt {attempt+1} failed: {e}")
            
            # Longer cooldown between attempts to let module recover
            if attempt < self.SMS_RETRY_COUNT - 1:
                logger.info(f"Waiting 5 seconds before next SMS attempt...")
                time.sleep(5)  # Wait before retry
            
        logger.error("All SMS attempts failed")
        return False

class Monitor:
    """The main monitoring orchestrator"""
    def __init__(self):
        logger.info("--- PATIENT MONITOR SYSTEM STARTING ---")
        
        # Initialize GPIO and hardware components
        HardwareManager.setup_gpio()
        self.hardware = HardwareManager()
        self.i2c = I2CManager()
        
        # Initialize sensors and modules
        self.imu = MPU6050Sensor(self.i2c)
        self.gps = GPSHandler()
        self.gsm = GSMHandler()
        
        # Initialize state variables
        self.last_heartbeat = time.time()
        self.iterations = 0
        self.fall_cooldown = 0
        self.fall_stage = 0 
        self.fall_start = 0
        self.last_high_accel = 0
        self.running = False

    def run(self):
        self.gps.start()
        logger.info("Monitoring loop active. Heartbeat every 60s.")
        
        while True:
            t_start = time.monotonic()
            self.iterations += 1
            
            # 1. Data Sampling
            data = self.imu.read_all()
            mag = data['mag']
            
            # 2. Heartbeat & Periodic Location (Every 60s/300s)
            now_time = time.time()
            if (now_time - self.last_heartbeat) > 60:
                logger.info(f"[HEARTBEAT] System Healthy | Iterations: {self.iterations} | Accel: {mag:.2f}g")
                
                # Send periodic location update every 5 minutes (300s)
                if self.iterations % 5 == 0: 
                    loc = self.gps.get_last_fix()
                    if loc:
                        gps_status = self.gps.get_gps_status()
                        ts = datetime.now().strftime('%H:%M:%S')
                        loc_sms = f"LOCATION_UPDATE|{PATIENT_ID}|{loc[0]:.6f},{loc[1]:.6f}|{gps_status}|{ts}|Device:PiZero"
                        logger.info(f"Sending periodic location update: {loc_sms}")
                        self.gsm.dispatch_sms_async(loc_sms)
                
                self.last_heartbeat = now_time

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
        
        # Get GPS data and status
        loc = self.gps.get_last_fix()
        gps_status = self.gps.get_gps_status()
        
        if loc:
            coords = f"{loc[0]:.6f},{loc[1]:.6f}"
            location_info = f"{coords}|{gps_status}"
        else:
            location_info = f"NO_GPS_FIX|{gps_status}"
        
        # Format SMS with more detailed information
        ts = datetime.now().strftime('%H:%M:%S')
        sms = f"FALL_ALERT|{PATIENT_ID}|{location_info}|{ts}|Impact:{impact_force:.2f}g|Device:PiZero"
        
        logger.info(f"SMS Content: {sms}")
        
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
