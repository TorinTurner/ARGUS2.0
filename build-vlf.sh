#!/bin/bash
# Build standalone Python executable for VLF Message Compressor
# This creates a self-contained executable with Python and all dependencies bundled

echo "========================================="
echo "  VLF - Building Python Executable"
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

# Install PyInstaller and brotli if not present
echo "[1/4] Ensuring PyInstaller and dependencies are installed..."
python3 -m pip install --quiet pyinstaller brotli

# Clean previous builds
echo ""
echo "[2/4] Cleaning previous VLF builds..."
rm -rf python/dist/VLF_core python/build/VLF_core

# Build the executable
echo ""
echo "[3/4] Building standalone Python executable..."
echo "This may take 1-2 minutes..."
cd python
python3 -m PyInstaller VLF_core.spec --clean
cd ..

# Check if build succeeded (onedir creates a directory, not a single file)
if [ ! -d "python/dist/VLF_core" ]; then
    echo ""
    echo "✗ Build failed! VLF_core directory not found."
    exit 1
fi

if [ ! -f "python/dist/VLF_core/VLF_core" ]; then
    echo ""
    echo "✗ Build failed! VLF_core executable not found in output directory."
    exit 1
fi

# Create python-dist directory and copy entire VLF_core folder (onedir build)
echo ""
echo "[4/4] Preparing for Electron bundling..."
mkdir -p python-dist
cp -r python/dist/VLF_core python-dist/

echo ""
echo "========================================="
echo "  VLF Executable Built Successfully!"
echo "========================================="
echo ""
echo "Location: python-dist/VLF_core/ (onedir build)"
echo "Structure:"
echo "  VLF_core/"
echo "  ├── VLF_core"
echo "  └── _internal/ (all dependencies)"
echo ""
echo "Directory contents:"
ls -1 python-dist/VLF_core
echo ""
