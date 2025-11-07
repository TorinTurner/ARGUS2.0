#!/bin/bash
# Quick build script - Works for both Mac and Windows (using Git Bash on Windows)

echo "ARGUS Quick Build"
echo "================="

# Clean previous builds
rm -rf dist node_modules package-lock.json

# Copy fixed files
cp main_fixed.js main.js 2>/dev/null
cp package_working.json package.json 2>/dev/null

# Install dependencies
echo "Installing dependencies..."
npm install

# Build based on platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Building for macOS..."
    npm run dist-mac
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    echo "Building for Windows..."
    npm run dist-win
else
    echo "Building for Linux..."
    npm run dist
fi

echo "Build complete! Check 'dist' folder"
