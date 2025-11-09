#!/bin/bash
# =============================================================================
# ARGUS 2.0 - Linux Build Script
# =============================================================================
# This script builds a portable Linux AppImage for ARGUS 2.0
# The AppImage will include:
#   - Electron runtime
#   - Python interpreter (embedded)
#   - All Python dependencies
#   - All application code and templates
#
# Requirements (for building only):
#   - Node.js 18+
#   - Python 3.8-3.11
#   - npm
#
# The final AppImage will run on most modern Linux distributions with
# NO dependencies required!
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Header
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  ARGUS 2.0 - Linux Build Script${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# =============================================================================
# Step 1: Check Prerequisites
# =============================================================================

echo -e "${BLUE}[1/6] Checking prerequisites...${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found!${NC}"
    echo "  Please install Node.js 18+ from: https://nodejs.org/"
    echo "  Or use your package manager:"
    echo "    Ubuntu/Debian: sudo apt install nodejs npm"
    echo "    Fedora: sudo dnf install nodejs npm"
    echo "    Arch: sudo pacman -S nodejs npm"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js found: ${NODE_VERSION}${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not found!${NC}"
    echo "  Please install npm (usually comes with Node.js)"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo -e "${GREEN}✓ npm found: v${NPM_VERSION}${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python 3 not found!${NC}"
    echo "  Please install Python 3.8+ from: https://python.org/"
    echo "  Or use your package manager:"
    echo "    Ubuntu/Debian: sudo apt install python3 python3-pip"
    echo "    Fedora: sudo dnf install python3 python3-pip"
    echo "    Arch: sudo pacman -S python python-pip"
    exit 1
fi

PYTHON_VERSION=$(python3 --version)
echo -e "${GREEN}✓ Python found: ${PYTHON_VERSION}${NC}"

# Check pip
if ! command -v pip3 &> /dev/null; then
    echo -e "${YELLOW}⚠ pip3 not found, trying to install...${NC}"
    python3 -m ensurepip --default-pip || {
        echo -e "${RED}✗ Could not install pip${NC}"
        echo "  Please install pip manually:"
        echo "    Ubuntu/Debian: sudo apt install python3-pip"
        echo "    Fedora: sudo dnf install python3-pip"
        exit 1
    }
fi

PIP_VERSION=$(pip3 --version | awk '{print $2}')
echo -e "${GREEN}✓ pip found: v${PIP_VERSION}${NC}"

echo ""

# =============================================================================
# Step 2: Install Node.js Dependencies
# =============================================================================

echo -e "${BLUE}[2/6] Installing Node.js dependencies...${NC}"
echo ""

if [ ! -d "node_modules" ]; then
    echo "Installing Electron and build tools..."
    npm install
    echo -e "${GREEN}✓ Node.js dependencies installed${NC}"
else
    echo "Node modules already installed, skipping..."
    echo -e "${GREEN}✓ Node.js dependencies OK${NC}"
fi

echo ""

# =============================================================================
# Step 3: Install Python Dependencies
# =============================================================================

echo -e "${BLUE}[3/6] Installing Python dependencies...${NC}"
echo ""

cd python

# Check if requirements are already installed
echo "Checking Python packages..."
if pip3 show pyinstaller opencv-python numpy Pillow imageio pyyaml &> /dev/null; then
    echo -e "${GREEN}✓ Python dependencies already installed${NC}"
else
    echo "Installing Python packages (opencv, numpy, pillow, imageio, pyyaml, pyinstaller)..."
    pip3 install -r requirements.txt
    echo -e "${GREEN}✓ Python dependencies installed${NC}"
fi

cd ..

echo ""

# =============================================================================
# Step 4: Build Python Executable
# =============================================================================

echo -e "${BLUE}[4/6] Building standalone Python executable...${NC}"
echo -e "${YELLOW}This may take 2-5 minutes...${NC}"
echo ""

# Clean previous Python builds
echo "Cleaning previous builds..."
rm -rf python/dist python/build python-dist

# Build using PyInstaller
echo "Running PyInstaller..."
cd python
python3 -m PyInstaller ARGUS_core.spec --clean --noconfirm

# Check if build succeeded
if [ ! -d "dist/ARGUS_core" ] || [ ! -f "dist/ARGUS_core/ARGUS_core" ]; then
    echo ""
    echo -e "${RED}✗ Python build failed!${NC}"
    echo "  Check python/build/ARGUS_core/warn-ARGUS_core.txt for details"
    exit 1
fi

cd ..

# Copy to python-dist directory
echo "Preparing Python executable for bundling..."
mkdir -p python-dist
cp -r python/dist/ARGUS_core python-dist/

echo -e "${GREEN}✓ Python executable built successfully${NC}"
echo "  Location: python-dist/ARGUS_core/"

echo ""

# =============================================================================
# Step 5: Build Electron AppImage
# =============================================================================

echo -e "${BLUE}[5/6] Building Electron AppImage...${NC}"
echo -e "${YELLOW}This may take 3-5 minutes...${NC}"
echo ""

# Clean previous Electron builds
echo "Cleaning previous Electron builds..."
rm -rf dist

# Build AppImage
echo "Running electron-builder..."
npm run dist -- --linux

# Check if build succeeded
if [ ! -f dist/ARGUS-*.AppImage ]; then
    echo ""
    echo -e "${RED}✗ Electron build failed!${NC}"
    echo "  Check the output above for errors"
    exit 1
fi

echo -e "${GREEN}✓ AppImage built successfully${NC}"

echo ""

# =============================================================================
# Step 6: Build Summary
# =============================================================================

echo -e "${BLUE}[6/6] Build complete!${NC}"
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  Build Summary${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# Get AppImage details
APPIMAGE_FILE=$(ls -1 dist/ARGUS-*.AppImage | head -1)
APPIMAGE_NAME=$(basename "$APPIMAGE_FILE")
APPIMAGE_SIZE=$(du -h "$APPIMAGE_FILE" | cut -f1)

echo -e "${GREEN}✓ Build successful!${NC}"
echo ""
echo "Output file:"
echo "  ${APPIMAGE_NAME}"
echo ""
echo "Location:"
echo "  ${APPIMAGE_FILE}"
echo ""
echo "Size:"
echo "  ${APPIMAGE_SIZE}"
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  What's Included${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""
echo "✓ Electron runtime"
echo "✓ Python interpreter (embedded)"
echo "✓ All Python packages (opencv, numpy, etc.)"
echo "✓ Application code and UI"
echo "✓ Weather map templates"
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  How to Use${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""
echo "1. Make the AppImage executable:"
echo "   ${YELLOW}chmod +x ${APPIMAGE_FILE}${NC}"
echo ""
echo "2. Run the application:"
echo "   ${YELLOW}./${APPIMAGE_NAME}${NC}"
echo ""
echo "3. Or double-click the file in your file manager"
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  Distribution${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""
echo "This AppImage is completely self-contained and can be:"
echo "  ✓ Copied to USB drives"
echo "  ✓ Shared via network"
echo "  ✓ Run on most modern Linux distributions"
echo "  ✓ Used without installing ANY dependencies"
echo ""
echo "Supported distributions:"
echo "  • Ubuntu 18.04+"
echo "  • Debian 10+"
echo "  • Fedora 30+"
echo "  • openSUSE Leap 15+"
echo "  • Arch Linux (current)"
echo "  • And most other modern Linux distributions"
echo ""
echo -e "${GREEN}Happy building! 🚀${NC}"
echo ""
