#!/bin/bash
# Build Windows Python executable from macOS/Linux
# This script provides multiple options for building Windows .exe on non-Windows platforms

set -e  # Exit on error

echo "========================================="
echo "  ARGUS - Building Windows .exe on macOS"
echo "========================================="
echo ""

# Function to check if GitHub CLI is available
check_gh_cli() {
    if command -v gh &> /dev/null && gh auth status &> /dev/null; then
        return 0
    fi
    return 1
}

# Function to trigger GitHub Actions build
trigger_github_build() {
    echo "Triggering GitHub Actions workflow to build Windows executables..."
    echo ""

    if ! check_gh_cli; then
        echo "✗ GitHub CLI not found or not authenticated"
        echo ""
        echo "To use GitHub Actions builds:"
        echo "  1. Install GitHub CLI: brew install gh"
        echo "  2. Authenticate: gh auth login"
        echo "  3. Re-run this script"
        echo ""
        echo "Or manually trigger the workflow at:"
        echo "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions/workflows/build-windows.yml"
        exit 1
    fi

    gh workflow run build-windows.yml
    echo ""
    echo "✓ Build triggered successfully!"
    echo ""
    echo "Monitor the build at:"
    gh run list --workflow=build-windows.yml --limit 1
    echo ""
    echo "Once complete, download artifacts from the Actions tab."
    exit 0
}

# Detect platform
PLATFORM=$(uname -s)
ARCH=$(uname -m)

echo "Detected platform: $PLATFORM ($ARCH)"
echo ""

# Show options
echo "Building Windows executables from $PLATFORM requires one of these approaches:"
echo ""
echo "  [1] GitHub Actions (Recommended)"
echo "      - Builds on actual Windows servers"
echo "      - Supports both x64 and ARM64"
echo "      - Free for public repos"
echo "      - Requires: GitHub CLI (gh)"
echo ""
echo "  [2] Docker + Wine (Experimental)"
echo "      - Builds locally using Wine"
echo "      - May have compatibility issues"
echo "      - Requires: Docker Desktop"
echo ""
echo "  [3] Remote Windows Machine"
echo "      - Use a Windows PC/VM"
echo "      - Run: build-python.bat"
echo "      - Most reliable"
echo ""

# Check if running non-interactively (CI or script)
if [ ! -t 0 ]; then
    echo "Running in non-interactive mode. Using Docker build..."
    BUILD_METHOD="docker"
else
    read -p "Choose build method [1/2/3]: " choice
    case $choice in
        1)
            BUILD_METHOD="github"
            ;;
        2)
            BUILD_METHOD="docker"
            ;;
        3)
            echo ""
            echo "To build on Windows:"
            echo "  1. Copy this project to a Windows machine"
            echo "  2. Open PowerShell/CMD in the project directory"
            echo "  3. Run: build-python.bat"
            echo "  4. Run: npm run dist-win"
            echo ""
            exit 0
            ;;
        *)
            echo "Invalid choice. Exiting."
            exit 1
            ;;
    esac
fi

# Execute chosen method
case $BUILD_METHOD in
    github)
        trigger_github_build
        ;;
    docker)
        echo ""
        echo "Using Docker + Wine to build Windows executable..."
        echo "This is experimental and may take 10-15 minutes on first run."
        echo ""

        # Check if Docker is installed
        if ! command -v docker &> /dev/null; then
            echo "✗ Docker not found!"
            echo "Install Docker Desktop: https://www.docker.com/products/docker-desktop"
            exit 1
        fi

        # Check if Docker daemon is running
        if ! docker info &> /dev/null; then
            echo "✗ Docker daemon is not running!"
            echo "Please start Docker Desktop and try again."
            exit 1
        fi

        echo "✓ Docker is available"
        echo ""

        # Clean previous builds
        echo "[1/3] Cleaning previous builds..."
        rm -rf python/dist python/build python-dist

        # Build using Docker with Wine
        echo ""
        echo "[2/3] Building Windows executable using Docker..."
        echo "Building Docker image (this may take 10-15 minutes on first run)..."

        docker build -t argus-win-builder -f- . <<'DOCKERFILE'
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install Wine and dependencies
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        wine64 \
        wine32 \
        wget \
        ca-certificates \
        xvfb \
    && rm -rf /var/lib/apt/lists/*

# Set up Wine
ENV WINEDEBUG=-all
ENV WINEARCH=win64
ENV WINEPREFIX=/root/.wine

# Install Python 3.11 for Windows
WORKDIR /tmp
RUN wget -nv https://www.python.org/ftp/python/3.11.6/python-3.11.6-amd64.exe && \
    xvfb-run wine python-3.11.6-amd64.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0 && \
    wineserver -w && \
    rm python-3.11.6-amd64.exe

# Install Python packages
RUN wine python -m pip install --upgrade pip && \
    wine python -m pip install pyinstaller opencv-python-headless numpy Pillow imageio pyyaml && \
    wineserver -w

WORKDIR /build
DOCKERFILE

        echo ""
        echo "Running PyInstaller inside Docker..."
        docker run --rm \
            -v "$(pwd)/python:/build" \
            -w /build \
            argus-win-builder \
            sh -c "xvfb-run wine python -m PyInstaller ARGUS_core.spec --clean; wineserver -w"

        # Check if build succeeded (onedir creates a directory, not a single exe)
        if [ ! -d "python/dist/ARGUS_core" ]; then
            echo ""
            echo "✗ Build failed! ARGUS_core directory not found."
            echo ""
            echo "Docker + Wine builds can be unreliable. Consider using:"
            echo "  - GitHub Actions (option 1)"
            echo "  - A real Windows machine (option 3)"
            exit 1
        fi

        if [ ! -f "python/dist/ARGUS_core/ARGUS_core.exe" ]; then
            echo ""
            echo "✗ Build failed! ARGUS_core.exe not found in output directory."
            echo ""
            echo "Docker + Wine builds can be unreliable. Consider using:"
            echo "  - GitHub Actions (option 1)"
            echo "  - A real Windows machine (option 3)"
            exit 1
        fi

        # Create python-dist directory and copy entire ARGUS_core folder (onedir build)
        echo ""
        echo "[3/3] Preparing for Electron bundling..."
        rm -rf python-dist
        mkdir -p python-dist
        cp -r python/dist/ARGUS_core python-dist/

        echo ""
        echo "========================================="
        echo "  Windows .exe Built Successfully!"
        echo "========================================="
        echo ""
        echo "Location: python-dist/ARGUS_core/ (onedir build)"
        echo "Structure:"
        echo "  ARGUS_core/"
        echo "  ├── ARGUS_core.exe"
        echo "  └── _internal/ (all DLLs)"
        echo ""
        echo "Directory contents:"
        ls -1 python-dist/ARGUS_core
        echo ""
        echo "Next steps:"
        echo "  1. Run: npm run dist-win-from-mac"
        echo "  2. Your installer will be in dist/"
        echo ""
        echo "⚠️  Note: Wine-built executables may have compatibility issues."
        echo "    For production builds, use GitHub Actions or native Windows."
        echo ""
        ;;
esac
