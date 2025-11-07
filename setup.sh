#!/bin/bash
# ARGUS Modern - Quick Setup Script
# Run this to get started TONIGHT

echo "========================================="
echo "  ARGUS Modern - Setup"
echo "========================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found!"
    echo "Please install Node.js from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check Python
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "❌ Python not found!"
    echo "Please install Python 3.8+ from: https://python.org/"
    exit 1
fi

PYTHON_CMD=$(command -v python3 || command -v python)
echo "✅ Python found: $($PYTHON_CMD --version)"

echo ""
echo "Installing dependencies..."
echo ""

# Install Node dependencies
echo "[1/3] Installing Electron..."
npm install

# Install Python dependencies
echo ""
echo "[2/3] Installing Python packages..."
$PYTHON_CMD -m pip install opencv-python numpy Pillow imageio pyyaml --break-system-packages 2>/dev/null || \
$PYTHON_CMD -m pip install opencv-python numpy Pillow imageio pyyaml

# Create output directory
echo ""
echo "[3/3] Creating directories..."
mkdir -p output

echo ""
echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "To run ARGUS:"
echo "  npm start"
echo ""
echo "To package for distribution:"
echo "  npm run package-portable"
echo ""
echo "Example files are in ./examples/"
echo "Templates are in ./templates/"
echo ""
