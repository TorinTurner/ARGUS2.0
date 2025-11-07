#!/usr/bin/env python3
"""
ARGUS Core - FINAL WORKING VERSION
With proper color scale ordering (blue to red for wave heights)
"""

import sys
import json
import os
import imageio.v2 as imageio
import cv2 as cv
import numpy as np
import yaml

# Add path for module imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import plot
import textCompression as tc
import buildConfig as bc


def create_template(image_path, template_name, scale_coords, crop_coords):
    """
    Create a new template from an image with CORRECT scale extraction
    """
    try:
        # Load image
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        # Read image properly
        image_data = imageio.mimread(image_path)
        if isinstance(image_data, list) and len(image_data) > 0:
            image = image_data[0]
        else:
            image = imageio.imread(image_path)
        
        # Ensure numpy array
        image = np.array(image)
        
        # Create templates directory structure
        templates_dir = './templates'
        template_dir = os.path.join(templates_dir, template_name)
        
        os.makedirs(template_dir, exist_ok=True)
        
        # Extract coordinates
        scale_x1 = scale_coords['start_x']
        scale_y1 = scale_coords['start_y']
        scale_x2 = scale_coords['end_x']
        scale_y2 = scale_coords['end_y']
        
        crop_top = crop_coords['top']
        crop_bottom = crop_coords['bottom']
        crop_left = crop_coords['left']
        crop_right = crop_coords['right']
        
        # Create arrays for bounds
        b = [min(scale_y1, scale_y2), max(scale_y1, scale_y2), 
             min(scale_x1, scale_x2), max(scale_x1, scale_x2)]
        cr = [crop_top, crop_bottom, crop_left, crop_right]
        
        # Create white template
        template_image = 255 * np.ones_like(image).astype(np.uint8)
        
        # Copy scale bar and crop area
        template_image[b[0]:b[1], b[2]:b[3]] = image[b[0]:b[1], b[2]:b[3]]
        template_image[cr[0]:cr[1], cr[2]:cr[3]] = image[cr[0]:cr[1], cr[2]:cr[3]]
        
        # Extract scale colors with improved algorithm
        scale = []
        scale_box = np.array(image[b[0]:b[1], b[2]:b[3]]).astype(int)
        
        # Determine orientation
        is_vertical = (b[1] - b[0]) > (b[3] - b[2])
        
        # Try multiple positions to extract scale
        best_scale = []
        for d in range(2, min(scale_box.shape[0], scale_box.shape[1]), 2):
            try:
                if is_vertical:
                    scale_slice = scale_box[:, d, :]
                else:
                    scale_slice = scale_box[d, :, :]
                
                extracted = plot.build_scale(scale_slice)
                if len(extracted) > len(best_scale):
                    best_scale = extracted
                    if len(best_scale) >= 15:  # Good enough scale
                        break
            except:
                continue
        
        scale = best_scale
        
        if len(scale) == 0:
            raise ValueError("Could not extract color scale from image")
        
        # CRITICAL: Verify scale order - should go from blue/cool to red/warm
        # Check if scale needs to be reversed
        if len(scale) > 2:
            first_color = scale[0]
            last_color = scale[-1]
            
            # Simple heuristic: if first color is more red than blue, reverse it
            if first_color[0] > first_color[2] and last_color[2] > last_color[0]:
                # Silently reverse the scale
                scale = scale[::-1]
        
        # Apply colored area identification
        l, r, t, b_coord = plot.lrtb(template_image)
        plt = plot.gen(template_image, np.array(scale))
        plt = plot.smooth(plt, 2)
        plt = plt // 1
        
        # Apply masks for template visualization
        mask = np.array(plt == np.min(plt)).astype(int)
        for i in range(3):
            template_image[t:b_coord, l:r, i] = np.multiply(
                template_image[t:b_coord, l:r, i], mask
            ).astype(np.uint8)
        
        mask = np.array(plt > np.min(plt)).astype(int)
        template_image[t:b_coord, l:r, 0] = np.clip(
            template_image[t:b_coord, l:r, 0] + 125 * mask, 0, 255
        ).astype(np.uint8)
        
        # Save template
        template_gif_path = os.path.join(template_dir, f"{template_name}_template.gif")
        imageio.mimsave(template_gif_path, [template_image])
        
        # Save configuration
        config = {
            'name': template_name,
            'scale': scale.tolist() if isinstance(scale, np.ndarray) else scale,
            'cr': cr,
            'b': b
        }
        
        config_path = os.path.join(template_dir, f"{template_name}.yaml")
        with open(config_path, 'w') as f:
            yaml.safe_dump(config, f, default_flow_style=False)
        
        return {
            'status': 'success',
            'template_name': template_name,
            'template_path': template_gif_path,
            'config_path': config_path,
            'scale_colors': len(scale)
        }
        
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


def compress_image(image_path, template_name, dtg, output_path):
    """
    Compress image to VLF message format - following original exactly
    """
    try:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        # Load image
        image_data = imageio.mimread(image_path)
        if isinstance(image_data, list) and len(image_data) > 0:
            image = image_data[0]
        else:
            image = imageio.imread(image_path)
        
        # Convert to array
        image = np.array(image)
        
        # Create file structure
        ext = os.path.splitext(image_path)[1].lower()
        fp = bc.File_Structure(image_path, ext)
        fp.update(template_name)
        fp.dtg = dtg
        
        # Load configuration
        if not os.path.exists(fp.config):
            raise FileNotFoundError(f"Template config not found: {fp.config}")
        
        with open(fp.config, 'r') as f:
            c = yaml.safe_load(f)
        
        c['scale'] = np.array(c['scale'])
        
        # Generate plot using original method
        plt = plot.gen(image, c['scale'])
        
        # Condition with padding (50 as in original)
        plt = plot.condition(plt, 50)
        
        # Get max coefficient BEFORE smoothing/processing
        max_coeff = int(np.max(plt - np.min(plt)) - 1)
        
        # Build DFT exactly as original
        dft = cv.dft(plt)
        
        # Normalize DFT
        max_dft = np.max(np.abs(dft))
        if max_dft > 0:
            dft = dft * (1000.0 / max_dft)
        
        # Write message
        msg_data = tc.msgdata_write(dft, 12)
        msg_intro, msg_outro = tc.msgcontent_write(fp)
        
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
        
        # Return success
        size_bytes = os.path.getsize(output_path)
        return {
            'status': 'success',
            'message_path': output_path,
            'size_bytes': size_bytes,
            'size_kb': round(size_bytes / 1024, 2),
            'template': template_name,
            'dtg': dtg,
            'max_coeff': max_coeff
        }
        
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


def decompress_message(message_path, output_path, template_override=None):
    """
    Decompress VLF message to image - following original test.py exactly
    """
    try:
        if not os.path.exists(message_path):
            raise FileNotFoundError(f"Message file not found: {message_path}")
        
        # Read and parse message
        with open(message_path, 'r') as file:
            msg = file.read()
        
        # Parse message using original function
        dft, max_coeff, template_from_msg, dtg = tc.msg_read(msg)
        
        # Select template
        template = template_override if template_override else template_from_msg
        
        # Load template config
        fp = bc.File_Structure(message_path, '.txt')
        fp.update(template)
        
        if not os.path.exists(fp.config):
            raise FileNotFoundError(f"Template not found: {template}")
        
        with open(fp.config, 'r') as f:
            c = yaml.safe_load(f)
        
        c['scale'] = np.array(c['scale']).astype(np.uint8)
        
        # Apply inverse DFT exactly as in original test.py
        plt_out = cv.idft(dft)
        
        # Clip negative values
        plt_out[plt_out < 0] = 0
        
        # Scale by max_coeff
        if np.max(plt_out) > 0:
            plt_out = plt_out * (max_coeff / np.max(plt_out))
        
        # Remove padding (50 pixels as in compression)
        plt_out = plt_out[50:-50, 50:-50]
        
        # Round to integers
        plt_out = np.round(plt_out).astype(int)
        
        # CRITICAL FIX: Add 1 to plt_out values
        # plot.gen produces 1,2,3... but we need to shift back after processing
        plt_out = plt_out + 1  # Now matches what plot.gen produces
        
        # Use the proper restore function
        restored_image = restore_properly(plt_out, fp, c['scale'], dtg)
        
        # Ensure valid image format
        restored_image = np.clip(restored_image, 0, 255).astype(np.uint8)
        
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


def restore_properly(plt, fp, scale, dtg):
    """
    Properly restore image matching the original plot.restore logic
    
    CRITICAL: plot.gen produces values 1,2,3... for scale indices 0,1,2...
    So plt value 1 should use scale[0], plt value 2 should use scale[1], etc.
    """
    # Load template
    template_data = imageio.mimread(fp.template)
    if isinstance(template_data, list) and len(template_data) > 0:
        out = template_data[0]
    else:
        out = imageio.imread(fp.template)
    
    out = np.array(out).copy()  # Make writable copy
    x, y = out.shape[:2]
    
    # Get bounds using original function
    l, r, t, b = plot.lrtb(out)
    
    # Template mask parameters (red areas)
    mt = [125, 0, 0]  # Red marker color
    var = 25  # Variance threshold
    x_p, y_p = plt.shape
    
    # Create mask for template areas (red regions)
    mask = np.ones_like(out[:,:,0]).astype(int)
    for i in range(3):
        mask = np.multiply(
            mask,
            np.array(abs(out[:,:,i].astype(int) - mt[i]) < var).astype(int)
        )
    
    # Create colored plot
    plt_color = np.zeros((x_p, y_p, 3)).astype(np.uint8)
    
    # CRITICAL FIX: Map plt values correctly to scale indices
    # plt value 0 -> background (no color)
    # plt value 1 -> scale[0]
    # plt value 2 -> scale[1]
    # plt value 3 -> scale[2]
    # etc.
    
    # Skip value 0 (background), start from value 1
    for j in range(1, len(scale) + 1):
        if j <= len(scale):  # Safety check
            scale_idx = j - 1  # plt value j uses scale[j-1]
            for i in range(3):
                # Apply color where plt equals this value
                color_mask = (plt == j).astype(np.uint8)
                plt_color[:,:,i] += color_mask * scale[scale_idx, i]
    
    # Resize colored plot to fit template bounds
    plt_color = cv.resize(plt_color, (r-l, b-t))
    
    # Apply colored plot to template
    for i in range(3):
        # Keep original where mask is 0, replace with colors where mask is 1
        out[t:b,l:r,i] = (
            np.multiply(mask[t:b,l:r] == 0, out[t:b,l:r,i]) +
            np.multiply(mask[t:b,l:r], plt_color[:,:,i])
        )
    
    # Add DTG text if space available
    if t < x - b:
        x_text = b + (x - b)//2
    else:
        x_text = t//2
    
    # Add text with border for visibility - SMALLER SIZE
    font = cv.FONT_HERSHEY_SIMPLEX
    cv.putText(out, dtg, (l, x_text), font, 0.6, (255,255,255), 2, cv.LINE_AA)  # Reduced from 1.25 to 0.6
    cv.putText(out, dtg, (l, x_text), font, 0.6, (0,0,0), 1, cv.LINE_AA)  # Reduced border thickness
    
    return out


def list_templates():
    """
    List available templates
    """
    templates = []
    templates_dir = './templates'
    
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
                    try:
                        with open(config_file, 'r') as f:
                            config = yaml.safe_load(f)
                        
                        templates.append({
                            'name': item,
                            'config_path': config_file,
                            'template_path': template_file,
                            'scale_colors': len(config.get('scale', []))
                        })
                    except:
                        continue
        
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
    """Main CLI entry point"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'status': 'error',
            'error': 'No command provided. Commands: compress, decompress, create-template, list-templates'
        }))
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == 'compress':
            if len(sys.argv) != 6:
                raise ValueError('Usage: compress <image_path> <template_name> <dtg> <output_path>')
            
            result = compress_image(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
            
        elif command == 'decompress':
            if len(sys.argv) < 4:
                raise ValueError('Usage: decompress <message_path> <output_path> [template_name]')
            
            template = sys.argv[4] if len(sys.argv) > 4 else None
            result = decompress_message(sys.argv[2], sys.argv[3], template)
            
        elif command == 'create-template':
            if len(sys.argv) != 12:
                raise ValueError('Usage: create-template <image_path> <template_name> <scale_start_x> <scale_start_y> <scale_end_x> <scale_end_y> <top> <bottom> <left> <right>')
            
            scale_coords = {
                'start_x': int(sys.argv[4]),
                'start_y': int(sys.argv[5]),
                'end_x': int(sys.argv[6]),
                'end_y': int(sys.argv[7])
            }
            
            crop_coords = {
                'top': int(sys.argv[8]),
                'bottom': int(sys.argv[9]),
                'left': int(sys.argv[10]),
                'right': int(sys.argv[11])
            }
            
            result = create_template(sys.argv[2], sys.argv[3], scale_coords, crop_coords)
            
        elif command == 'list-templates':
            result = list_templates()
            
        else:
            result = {
                'status': 'error',
                'error': f'Unknown command: {command}'
            }
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            'status': 'error',
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
