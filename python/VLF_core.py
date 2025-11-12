#!/usr/bin/env python3
"""
VLF Message Compressor Core
Compress and decompress text messages using Brotli + Base32 encoding
"""

import sys
import json
import base64
import brotli


def compress_text(text):
    """
    Compress text using Brotli and encode with Base32

    Args:
        text: String to compress

    Returns:
        dict with 'encoded', 'originalSize', 'compressedSize'
    """
    try:
        # Convert text to bytes
        data = text.encode('utf-8')
        original_size = len(text)

        # Compress using Brotli
        compressed_data = brotli.compress(data)

        # Encode with Base32 (ASCII-safe)
        encoded_data = base64.b32encode(compressed_data).decode('ASCII')
        compressed_size = len(encoded_data)

        return {
            'status': 'success',
            'encoded': encoded_data,
            'originalSize': original_size,
            'compressedSize': compressed_size
        }

    except Exception as e:
        return {
            'status': 'error',
            'error': f'Compression failed: {str(e)}'
        }


def decompress_text(encoded_text):
    """
    Decompress Base32 encoded + Brotli compressed text

    Args:
        encoded_text: Base32 encoded string

    Returns:
        dict with 'decodedText'
    """
    try:
        # Clean the input (remove whitespace/newlines)
        encoded_text = encoded_text.strip()
        encoded_text = ''.join(encoded_text.split())

        # Replace incompatible symbols if needed (# -> =)
        # Base32 uses = for padding, but some systems may have changed it
        if '#' in encoded_text:
            encoded_text = encoded_text.replace('#', '=')

        # Decode from Base32
        compressed_data = base64.b32decode(encoded_text)

        # Decompress using Brotli
        decompressed_data = brotli.decompress(compressed_data)

        # Convert bytes to string
        decoded_text = decompressed_data.decode('utf-8')

        return {
            'status': 'success',
            'decodedText': decoded_text
        }

    except Exception as e:
        return {
            'status': 'error',
            'error': f'Decompression failed: {str(e)}. Make sure the input is a valid Base32 encoded message.'
        }


def main():
    """Main entry point for command-line usage"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'status': 'error',
            'error': 'Usage: VLF_core.py <command> [args...]'
        }))
        sys.exit(1)

    command = sys.argv[1]

    try:
        if command == 'compress':
            if len(sys.argv) < 3:
                raise ValueError('Missing text argument for compress command')

            text = sys.argv[2]
            result = compress_text(text)
            print(json.dumps(result))

        elif command == 'decompress':
            if len(sys.argv) < 3:
                raise ValueError('Missing encoded text argument for decompress command')

            encoded_text = sys.argv[2]
            result = decompress_text(encoded_text)
            print(json.dumps(result))

        else:
            raise ValueError(f'Unknown command: {command}')

    except Exception as e:
        print(json.dumps({
            'status': 'error',
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
