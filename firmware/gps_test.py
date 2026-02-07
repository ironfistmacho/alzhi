#!/usr/bin/env python3
"""
Simple GPS Test Program
Tests GPS communication using software serial via pigpio
"""

import time
import os
import logging
import RPi.GPIO as GPIO
from datetime import datetime

# Try to import pigpio
try:
    import pigpio
    PIGPIO_AVAILABLE = True
except ImportError:
    PIGPIO_AVAILABLE = False
    print("pigpio library not found. Install with: sudo apt install pigpio")
    exit(1)

# GPS Configuration
GPS_RX_PIN = 10   # GPIO10 (Pin 19) - GPS RX
GPS_TX_PIN = 8    # GPIO8 (Pin 24) - GPS TX
GPS_POWER_PIN = 22 # GPIO22 (Pin 15) - GPS Power
GPS_BAUD = 9600

# Setup logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("GPSTest")

def setup_gpio():
    """Setup GPIO pins"""
    try:
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        
        # Setup GPS power pin
        GPIO.setup(GPS_POWER_PIN, GPIO.OUT)
        GPIO.output(GPS_POWER_PIN, GPIO.HIGH)
        logger.info(f"GPS power enabled on GPIO{GPS_POWER_PIN}")
        
        return True
    except Exception as e:
        logger.error(f"GPIO setup failed: {e}")
        return False

def test_gps():
    """Test GPS communication"""
    logger.info("Starting GPS Test...")
    
    # Initialize pigpio
    pi = pigpio.pi()
    if not pi.connected:
        logger.error("pigpiod not running. Start with: sudo pigpiod")
        return False
    
    logger.info("pigpio connected successfully")
    
    try:
        # Setup software serial
        pi.set_mode(GPS_RX_PIN, pigpio.INPUT)
        pi.set_mode(GPS_TX_PIN, pigpio.OUTPUT)
        
        # Close any existing serial
        try:
            pi.bb_serial_read_close(GPS_RX_PIN)
        except:
            pass
        
        # Open serial for reading
        err = pi.bb_serial_read_open(GPS_RX_PIN, GPS_BAUD)
        if err < 0:
            logger.error(f"Failed to open GPS serial: {err}")
            return False
        
        logger.info(f"GPS serial opened on GPIO{GPS_RX_PIN}/GPIO{GPS_TX_PIN} at {GPS_BAUD} baud")
        
        # Give GPS time to initialize
        time.sleep(2)
        
        # Send test command to configure GPS output
        logger.info("Sending GPS configuration commands...")
        
        # Enable all NMEA sentences
        commands = [
            b'$PMTK314,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0*28\r\n',  # All sentences
            b'$PMTK220,1000*1F\r\n',  # 1Hz update rate
        ]
        
        for cmd in commands:
            pi.wave_clear()
            pi.wave_add_serial(GPS_TX_PIN, GPS_BAUD, cmd)
            wid = pi.wave_create()
            pi.wave_send_once(wid)
            while pi.wave_tx_busy():
                time.sleep(0.1)
            pi.wave_delete(wid)
            time.sleep(0.5)
        
        logger.info("GPS configuration sent. Waiting for data...")
        
        # Read GPS data for 60 seconds
        start_time = time.time()
        last_data_time = time.time()
        buffer = ""
        
        while time.time() - start_time < 60:
            (count, data) = pi.bb_serial_read(GPS_RX_PIN)
            
            if count > 0:
                last_data_time = time.time()
                raw_data = data.decode('ascii', errors='replace')
                buffer += raw_data
                
                # Process complete lines
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    line = line.strip()
                    
                    if line.startswith('$'):
                        logger.info(f"GPS NMEA: {line}")
                        
                        # Parse GPGGA for location
                        if '$GPGGA' in line:
                            parts = line.split(',')
                            if len(parts) > 6:
                                fix_quality = int(parts[6]) if parts[6] else 0
                                satellites = int(parts[7]) if parts[7] else 0
                                time_str = parts[1]
                                
                                logger.info(f"Time: {time_str}, Fix: {fix_quality}, Satellites: {satellites}")
                                
                                if fix_quality > 0 and parts[2] and parts[4]:
                                    lat = parse_deg(parts[2], parts[3])
                                    lon = parse_deg(parts[4], parts[5])
                                    logger.info(f"*** GPS FIX: {lat:.6f}, {lon:.6f} ***")
            else:
                # Check if no data for 10 seconds
                if time.time() - last_data_time > 10:
                    logger.warning("No GPS data received for 10 seconds")
                    logger.info("Check connections:")
                    logger.info(f"  GPS VCC -> 3.3V (Pin 1 or 17)")
                    logger.info(f"  GPS GND -> GND (Pin 6, 9, 14, 20, 25, 30, 34, 39)")
                    logger.info(f"  GPS TX -> GPIO{GPS_RX_PIN} (Pin 19)")
                    logger.info(f"  GPS RX -> GPIO{GPS_TX_PIN} (Pin 24)")
                    logger.info(f"  GPS PWR -> GPIO{GPS_POWER_PIN} (Pin 15)")
                    last_data_time = time.time()
            
            time.sleep(0.1)
        
        logger.info("GPS test completed")
        
    except Exception as e:
        logger.error(f"GPS test error: {e}")
    finally:
        # Cleanup
        try:
            pi.bb_serial_read_close(GPS_RX_PIN)
        except:
            pass
        pi.stop()
        GPIO.cleanup()
        logger.info("Cleanup completed")

def parse_deg(raw, direction):
    """Parse GPS coordinates"""
    if not raw: return 0.0
    deg = float(raw[:2])
    minutes = float(raw[2:])
    final = deg + (minutes / 60.0)
    return -final if direction in ['S', 'W'] else final

if __name__ == "__main__":
    print("GPS Test Program")
    print("================")
    print("This will test GPS communication for 60 seconds")
    print("Make sure GPS is connected:")
    print(f"  GPS VCC -> 3.3V (Pin 1 or 17)")
    print(f"  GPS GND -> GND (Pin 6, 9, 14, 20, 25, 30, 34, 39)")
    print(f"  GPS TX -> GPIO{GPS_RX_PIN} (Pin 19)")
    print(f"  GPS RX -> GPIO{GPS_TX_PIN} (Pin 24)")
    print(f"  GPS PWR -> GPIO{GPS_POWER_PIN} (Pin 15)")
    print()
    
    if not setup_gpio():
        print("GPIO setup failed!")
        exit(1)
    
    test_gps()
