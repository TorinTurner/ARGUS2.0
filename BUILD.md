# Building ARGUS Portable Executable

This guide explains how to build **truly portable** ARGUS executables for **Windows, macOS, and Linux**.

## Overview

ARGUS can be built as a self-contained application that bundles:
- ✅ Electron runtime
- ✅ Python interpreter (embedded)
- ✅ All Python packages (opencv, numpy, imageio, etc.)
- ✅ All application code
- ✅ Templates

**Results:**
- **Windows:** Single .exe file (~150-200MB) that runs on any Windows 7/10/11 machine
- **macOS:** .dmg installer (~150-200MB) that runs on macOS 10.13+ (Intel & Apple Silicon)
- **Linux:** AppImage (~150-200MB) that runs on most modern Linux distributions

---

## Prerequisites (For Building Only)

You need these tools **only to BUILD** the application. The final package will run with NO dependencies installed.

### Required:
1. **Node.js 18+** - https://nodejs.org/
2. **Python 3.8-3.11** - https://python.org/
   - ⚠️ Use Python 3.11 or earlier (PyInstaller works best with these)
   - **Windows:** Check "Add Python to PATH" during installation
   - **macOS/Linux:** Use `python3` command

### Verify Installation:

**Windows:**
```bash
node --version    # Should show v18 or higher
python --version  # Should show 3.8-3.11
npm --version     # Should be installed with Node.js
```

**macOS/Linux:**
```bash
node --version     # Should show v18 or higher
python3 --version  # Should show 3.8-3.11
npm --version      # Should be installed with Node.js
```

---

## Build Steps

### 1. Install Node Dependencies
```bash
npm install
```

This installs Electron and electron-builder.

### 2. Install Python Dependencies

**Windows:**
```bash
cd python
pip install -r requirements.txt
cd ..
```

**macOS/Linux:**
```bash
cd python
pip3 install -r requirements.txt
cd ..
```

This installs:
- opencv-python, numpy, Pillow, imageio, PyYAML (for the app)
- pyinstaller (to create the standalone executable)

### 3. Build for Your Platform

Choose the appropriate command for your target platform:

#### 🪟 Windows

**Build Python executable:**
```bash
build-python.bat
```

**Build portable .exe:**
```bash
npm run dist-win-portable
```

**Output:** `dist/ARGUS-2.0.0-x64-portable.exe` (~150-200MB)

---

#### 🍎 macOS

**Build Python executable:**
```bash
bash build-python.sh
# or
npm run build-python:unix
```

**Build .dmg installer:**
```bash
npm run dist-mac
```

**For Universal Binary (Intel + Apple Silicon):**
```bash
npm run dist-mac-universal
```

**Output:** `dist/ARGUS-2.0.0.dmg` (~150-200MB)

**Note:** The Python executable is built for your current architecture. For Universal builds, you may need to build on both architectures and combine them.

---

#### 🐧 Linux

**Build Python executable:**
```bash
bash build-python.sh
# or
npm run build-python:unix
```

**Build AppImage:**
```bash
npm run dist-linux
```

**Output:** `dist/ARGUS-2.0.0.AppImage` (~150-200MB)

---

## Quick Build (All-in-One)

**Windows:**
```bash
npm install
cd python && pip install -r requirements.txt && cd ..
npm run dist-win-portable
```

**macOS:**
```bash
npm install
cd python && pip3 install -r requirements.txt && cd ..
npm run dist-mac
```

**Linux:**
```bash
npm install
cd python && pip3 install -r requirements.txt && cd ..
npm run dist-linux
```

Your build will be in `dist/`

---

## Testing the Portable Build

### Test on Clean Windows VM:
1. Copy the .exe to a VM with **NO Python, NO Node.js**
2. Double-click the .exe
3. It should launch immediately
4. Try creating a template or compressing an image

If it works on a bare VM, it will work anywhere.

---

## Build Variants

### Portable EXE (Recommended for distribution)
```bash
npm run dist-win-portable
```
- Single .exe file
- No installation required
- Can run from USB drive

### NSIS Installer
```bash
npm run dist-win
```
- Traditional Windows installer
- Installs to Program Files
- Creates Start Menu shortcuts
- Larger download (~200MB)

### Architecture-Specific Builds
```bash
npm run dist-win-x64        # 64-bit Windows
npm run dist-win-arm64      # ARM64 Windows (Surface Pro X, etc.)
```

---

## Troubleshooting

### "PyInstaller not found"
```bash
pip install pyinstaller
```

### "opencv-python installation failed"
Try installing Visual C++ Redistributable:
https://aka.ms/vs/17/release/vc_redist.x64.exe

### "Python not found" during build
Make sure Python is in your PATH:
```bash
python --version    # Should work from any directory
```

### Build is huge (>300MB)
This is normal with opencv and numpy bundled. Typical sizes:
- Python executable: 100-120MB
- Electron app: 150-200MB total

### "Module not found" errors when running portable .exe
The Python .exe wasn't built correctly. Rebuild:
```bash
rmdir /s python\build
rmdir /s python\dist
build-python.bat
```

### Testing in development (without building)
```bash
npm start
```
This uses system Python for faster iteration during development.

---

## Distribution

The portable .exe can be distributed via:
- ✅ USB drives
- ✅ Network shares
- ✅ CD/DVD
- ✅ Email (if under attachment limits)
- ✅ Internal file servers

**No installation required. No dependencies required.**

---

## Architecture

### How It Works

**Development Mode** (`npm start`):
```
Electron → Calls system Python → Runs ARGUS_core.py
```

**Production Mode** (portable .exe):
```
Electron → Calls bundled ARGUS_core.exe → Everything runs internally
```

The app automatically detects which mode it's in and uses the appropriate Python source.

### File Structure in Portable .exe

```
ARGUS-portable.exe (unpacks to temp at runtime)
├── electron.exe          # Electron runtime
├── resources/
│   └── app.asar.unpacked/
│       ├── python-dist/
│       │   └── ARGUS_core.exe    # Standalone Python with all deps
│       ├── templates/             # Weather map templates
│       ├── renderer/              # UI files
│       └── main.js               # Electron main process
└── output/                       # Created on first run
```

---

## Build Environment Recommendations

### For Official Releases:
- Use Windows 10/11 (native, not WSL)
- Use Python 3.10 or 3.11
- Run `build-python.bat` on the same architecture as target deployment
- Test on multiple Windows versions before distribution

### For Development:
- Any OS (Windows/Mac/Linux)
- Use `npm start` for faster iteration
- Only build portable .exe when ready to test full deployment

---

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Build ARGUS Portable

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          npm install
          cd python
          pip install -r requirements.txt

      - name: Build Python executable
        run: build-python.bat

      - name: Build Electron app
        run: npm run dist-win-portable

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ARGUS-portable
          path: dist/*.exe
```

---

## Version Control

### Files to commit:
- ✅ All source code
- ✅ `ARGUS_core.spec` (PyInstaller config)
- ✅ `build-python.bat` (build script)
- ✅ `python/requirements.txt`

### Files to ignore:
- ❌ `python/build/`
- ❌ `python/dist/`
- ❌ `python-dist/` (generated)
- ❌ `dist/` (final builds)
- ❌ `node_modules/`

See `.gitignore` for complete list.

---

## Support

**Build issues?** Check:
1. Python version (3.8-3.11 recommended)
2. PyInstaller is installed: `pip show pyinstaller`
3. Build logs in `python/build/ARGUS_core/warn-ARGUS_core.txt`

**Runtime issues with portable .exe?**
1. Test on the same system you built on first
2. Check Windows Defender / antivirus isn't blocking
3. Run from a folder with write permissions (not Program Files)

---

**Version:** 2.0.0
**Last Updated:** November 2025
