#!/bin/bash
# Build standalone Python executable for ARGUS
# This creates a self-contained executable with Python and all dependencies bundled

echo "========================================="
echo "  ARGUS - Building Python Executable"
echo "========================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "✗ Python not found!"
    echo "Python is required to BUILD the executable."
    echo "Install from: https://python.org/"
    exit 1
fi

echo "✓ Python found"
python3 --version
echo ""

# Install PyInstaller if not present
echo "[1/4] Ensuring PyInstaller is installed..."
python3 -m pip install --quiet pyinstaller opencv-python numpy Pillow imageio pyyaml

# Clean previous builds
echo ""
echo "[2/4] Cleaning previous builds..."
rm -rf python/dist python/build

# Build the executable
echo ""
echo "[3/4] Building standalone Python executable..."
echo "This may take 2-5 minutes..."
cd python
python3 -m PyInstaller ARGUS_core.spec --clean
cd ..

# Check if build succeeded
if [ ! -f "python/dist/ARGUS_core" ]; then
    echo ""
    echo "✗ Build failed! ARGUS_core executable not found."
    exit 1
fi

# Create python-dist directory for Electron to bundle
echo ""
echo "[4/4] Preparing for Electron bundling..."
mkdir -p python-dist
cp python/dist/ARGUS_core python-dist/

echo ""
echo "========================================="
echo "  Python Executable Built Successfully!"
echo "========================================="
echo ""
echo "Location: python-dist/ARGUS_core"
echo "Size:"
ls -lh python-dist/ARGUS_core | awk '{print $5 " " $9}'
echo ""
echo "Next steps:"
echo "  1. Run: npm run dist-mac (for macOS)"
echo "  2. Your .dmg will be in dist/"
echo ""
