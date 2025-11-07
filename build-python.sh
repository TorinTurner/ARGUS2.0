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

# Check if build succeeded (onedir creates a directory, not a single file)
if [ ! -d "python/dist/ARGUS_core" ]; then
    echo ""
    echo "✗ Build failed! ARGUS_core directory not found."
    exit 1
fi

if [ ! -f "python/dist/ARGUS_core/ARGUS_core" ]; then
    echo ""
    echo "✗ Build failed! ARGUS_core executable not found in output directory."
    exit 1
fi

# Create python-dist directory and copy entire ARGUS_core folder (onedir build)
echo ""
echo "[4/4] Preparing for Electron bundling..."
rm -rf python-dist
mkdir -p python-dist
cp -r python/dist/ARGUS_core python-dist/

echo ""
echo "========================================="
echo "  Python Executable Built Successfully!"
echo "========================================="
echo ""
echo "Location: python-dist/ARGUS_core/ (onedir build)"
echo "Structure:"
echo "  ARGUS_core/"
echo "  ├── ARGUS_core"
echo "  └── _internal/ (all dependencies)"
echo ""
echo "Directory contents:"
ls -1 python-dist/ARGUS_core
echo ""
echo "Next steps:"
echo "  1. Run: npm run dist-mac (for macOS)"
echo "  2. Your .dmg will be in dist/"
echo ""
