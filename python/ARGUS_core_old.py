#!/usr/bin/env python3
"""
ARGUS Core - CLI Wrapper for Electron Integration
Original compression algorithm by LCDR Sean Peneyra / Aevix LLC
UI modernization wrapper

Usage: python ARGUS_core.py <command> [args]
Commands:
  - compress <image_path> <template_name> <dtg> <output_path>
  - decompress <message_path> <output_path>
  - list-templates
"""

import sys
import json
import os
import imageio
import cv2 as cv
import numpy as np

# Import existing ARGUS modules
import plot
import textCompression as tc
import buildConfig as bc

def compress_image(image_path, template_name, dtg, output_path):
    """
    Compress a weather image to VLF message format
    Args:
        image_path: Path to input GIF/JPG
        template_name: Template name (e.g., "EUCOM")
        dtg: Date-Time-Group string
        output_path: Path for output text file
    Returns:
        dict with status and metadata
    """
    try:
        # Load image
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        image = imageio.mimread(image_path)
        ext = os.path.splitext(image_path)[1].lower()
        
        # If GIF, use first frame
        if isinstance(image, list):
            image = image[0]
        
        # Ensure numpy array
        image = np.array(image)
        
        # Create file structure
        fp = bc.File_Structure(image_path, ext)
        fp.update(template_name)
        fp.dtg = dtg
        
        # Load template configuration
        if not os.path.exists(fp.config):
            raise FileNotFoundError(f"Template config not found: {fp.config}")
        
        c = bc.config_get(fp)
        
        # Build plot and condition it
        plt = plot.gen(image, np.array(c['scale']))
        plt = plot.condition(plt, 50)  # padding = 50
        
        # Get max coefficient for normalization
        max_coeff = int(np.max(plt - np.min(plt)) - 1)
        
        # Build DFT and normalize
        dft = cv.dft(plt)
        dft = dft * (1000 / np.max(np.abs(dft)))  # dft_norm = 1000
        
        # Encode message data
        msg_data = tc.msgdata_write(dft, 12)  # n = 12 coefficients
        msg_intro, msg_outro = tc.msgcontent_write(fp)
        
        # Write to output file
        with open(output_path, 'w') as file:
            for line in msg_intro.splitlines():
                print(line, file=file)
            
            # Header with metadata
            print(
                f"{dft.shape[0]}/{dft.shape[1]}/12/{max_coeff}/{dtg}/{template_name}/A1R1G2U3S5/",
                file=file
            )
            
            for line in msg_data.splitlines():
                print(line, file=file)
            
            for line in msg_outro.splitlines():
                print(line, file=file)
        
        # Calculate file size
        size_bytes = os.path.getsize(output_path)
        size_kb = size_bytes / 1024
        
        return {
            'status': 'success',
            'message_path': output_path,
            'size_bytes': size_bytes,
            'size_kb': round(size_kb, 2),
            'template': template_name,
            'dtg': dtg
        }
        
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }

def decompress_message(message_path, output_path, template_override=None):
    """
    Decompress VLF message to weather image
    Args:
        message_path: Path to input text message
        output_path: Path for output GIF
        template_override: Optional template name to use instead of parsing from message
    Returns:
        dict with status and metadata
    """
    try:
        # Read message
        if not os.path.exists(message_path):
            raise FileNotFoundError(f"Message file not found: {message_path}")
        
        with open(message_path, 'r') as file:
            msg = file.read()
        
        # Parse message to rebuild DFT
        dft, max_coeff, template_from_msg, dtg = tc.msg_read(msg)
        
        # Use override template if provided, otherwise use parsed template
        template = template_override if template_override else template_from_msg
        
        # Load template configuration
        fp = bc.File_Structure(message_path, '.txt')
        fp.update(template)
        
        if not os.path.exists(fp.config):
            raise FileNotFoundError(f"Template not found: {template}. Please ensure templates are downloaded.")
        
        c = bc.config_get(fp)
        c['scale'] = np.array(c['scale']).astype(np.uint8)
        
        # Apply inverse DFT
        plt = cv.idft(dft)
        plt[plt < 0] = 0
        plt = (plt * max_coeff // np.max(plt)) + 1
        plt = plt[50:-50, 50:-50]  # Remove padding
        
        # Restore image with template overlay
        restored_image = plot.restore(plt, fp, c['scale'], dtg)
        
        # Save image
        imageio.mimsave(output_path, [restored_image])
        
        return {
            'status': 'success',
            'image_path': output_path,
            'template': template,
            'dtg': dtg
        }
        
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }

def list_templates():
    """
    List available templates
    Returns:
        dict with template information
    """
    templates = []
    templates_dir = './templates'
    
    # Create templates directory if it doesn't exist
    if not os.path.exists(templates_dir):
        os.makedirs(templates_dir)
        return {'status': 'success', 'templates': []}
    
    try:
        for item in os.listdir(templates_dir):
            template_path = os.path.join(templates_dir, item)
            
            if os.path.isdir(template_path):
                config_file = os.path.join(template_path, f"{item}.yaml")
                template_file = os.path.join(template_path, f"{item}_template.gif")
                
                if os.path.exists(config_file) and os.path.exists(template_file):
                    templates.append({
                        'name': item,
                        'config_path': config_file,
                        'template_path': template_file
                    })
        
        return {
            'status': 'success',
            'templates': templates
        }
        
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }

def main():
    """Main entry point for CLI"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'status': 'error',
            'error': 'No command provided. Usage: ARGUS_core.py <command> [args]'
        }))
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == 'compress':
            if len(sys.argv) != 6:
                raise ValueError('Usage: compress <image_path> <template_name> <dtg> <output_path>')
            
            image_path = sys.argv[2]
            template_name = sys.argv[3]
            dtg = sys.argv[4]
            output_path = sys.argv[5]
            
            result = compress_image(image_path, template_name, dtg, output_path)
            
        elif command == 'decompress':
            if len(sys.argv) < 4:
                raise ValueError('Usage: decompress <message_path> <output_path> [template_name]')
            
            message_path = sys.argv[2]
            output_path = sys.argv[3]
            template_override = sys.argv[4] if len(sys.argv) > 4 else None
            
            result = decompress_message(message_path, output_path, template_override)
            
        elif command == 'list-templates':
            result = list_templates()
            
        else:
            result = {
                'status': 'error',
                'error': f'Unknown command: {command}'
            }
        
        # Output as JSON
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            'status': 'error',
            'error': str(e)
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
