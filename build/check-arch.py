#!/usr/bin/env python3
"""
Check Python architecture to ensure we're building 64-bit executables
"""
import sys
import platform
import struct

def check_architecture():
    """Check and report Python architecture"""
    bits = struct.calcsize("P") * 8
    machine = platform.machine()
    python_version = sys.version

    print("=" * 50)
    print("Python Architecture Check")
    print("=" * 50)
    print(f"Python Version: {python_version}")
    print(f"Architecture: {bits}-bit")
    print(f"Machine: {machine}")
    print(f"Platform: {platform.platform()}")
    print("=" * 50)

    if bits != 64:
        print("\n[WARNING] You are using 32-bit Python!")
        print("PyInstaller will create 32-bit executables.")
        print("\nFor 64-bit builds, install 64-bit Python from:")
        print("https://www.python.org/downloads/")
        print("\nLook for 'Windows installer (64-bit)' download")
        return False

    print("\n[OK] Using 64-bit Python - will create 64-bit executables")
    return True

if __name__ == "__main__":
    success = check_architecture()
    sys.exit(0 if success else 1)
