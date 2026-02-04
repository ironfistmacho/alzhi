from PIL import Image, ImageOps
import sys
import os

def convert_image(image_path):
    try:
        if not os.path.exists(image_path):
            print(f"Error: File not found at {image_path}")
            return

        img = Image.open(image_path).convert('L')
        
        # Resize to fit 128x64 while maintaining aspect ratio
        target_size = (128, 64)
        img.thumbnail(target_size, Image.Resampling.LANCZOS)
        
        # Create a new blank (black) image
        new_img = Image.new('1', target_size, 0)
        
        # Center the image
        img_w, img_h = img.size
        offset = ((128 - img_w) // 2, (64 - img_h) // 2)
        
        # Paste and convert to binary (dither or threshold)
        # Using simple threshold
        img = img.point(lambda x: 0 if x < 128 else 255, '1')
        new_img.paste(img, offset)
        
        # Convert to byte array (Row-major)
        # 128 width = 16 bytes per row
        # 64 height
        pixels = new_img.load()
        width, height = new_img.size
        
        print(f"// Image size: {width}x{height}")
        print(f"const unsigned char brain_logo [] PROGMEM = {{")
        
        byte_val = 0
        bit_pos = 0
        count = 0
        
        hex_output = []
        
        # Standard GFX bitmap is row-major
        # Top-left pixel is byte 0, bit 7 (usually MSB first for GFX?)
        # Adafruit_GFX: "The data is stored as a byte array, with the most significant bit of the first byte corresponding to the pixel at (0,0)"
        
        for y in range(height):
            for x in range(width):
                if pixels[x, y] > 0: # White pixel
                    byte_val |= (0x80 >> bit_pos)
                
                bit_pos += 1
                if bit_pos == 8:
                    hex_output.append(f"0x{byte_val:02x}")
                    byte_val = 0
                    bit_pos = 0
                    
        # Join and format
        print(", ".join(hex_output))
        print("};")
        
    except Exception as e:
        print(f"Error converting image: {e}")

if __name__ == "__main__":
    convert_image(r'C:/Users/alber/.gemini/antigravity/brain/acc2c0e7-afbc-44cf-a192-a80d7022f89a/uploaded_image_1768111493112.png')
