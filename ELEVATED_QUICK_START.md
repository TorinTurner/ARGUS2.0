# ELEVATED Quick Start Guide

## For End Users

### First Time Setup
1. Download and install ELEVATED for your platform
2. Launch ELEVATED
3. On first run, choose where to store files (recommended: User Data Folder)
4. Select which application you want to use from the launcher

### Using ARGUS 2.0
1. Click "Launch ARGUS" in the ELEVATED launcher
2. **To Compress** (Shore Mode):
   - Drag & drop or browse for a weather image
   - Select a template
   - Enter DTG (or click "Now" for current time)
   - Click "Generate VLF Message"
   - Find output in your output folder

3. **To Decompress** (Submarine Mode):
   - Switch to Submarine mode
   - Load message file or paste message text
   - Select matching template
   - Click "Decode & Display Image"

### Using VLF Message Compressor
1. Click "Launch VLF Compressor" in the ELEVATED launcher
2. **To Compress**:
   - Load a text file or paste/type your message
   - Click "Compress & Encode Message"
   - Save or copy the result

3. **To Decompress**:
   - Switch to Decompress mode
   - Load or paste the encoded message
   - Click "Decode & Decompress Message"
   - Save or copy the original text

---

## For Developers

### Build Complete Application (All Platforms)

#### Prerequisites
```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install pyinstaller opencv-python numpy Pillow imageio pyyaml brotli
```

#### Windows Build
```bash
# Build both Python executables
build-python.bat
build-vlf.bat

# Build Electron application
npm run dist-win-x64

# Output: dist/ELEVATED-Setup-2.0.0-x64.exe
```

#### macOS Build
```bash
# Build both Python executables
bash build-python.sh
bash build-vlf.sh

# Build Electron application
npm run dist-mac

# Output: dist/ELEVATED-2.0.0.dmg
```

#### Linux Build
```bash
# Build both Python executables
bash build-python.sh
bash build-vlf.sh

# Build Electron application
npm run dist-linux-x64

# Output: dist/ELEVATED-2.0.0-x64.AppImage
```

### Development Mode (No Build Required)
```bash
# Ensure package.json main points to elevated-main.js
# Run directly with:
npm start
```

**Note**: In development mode, system Python is used instead of bundled executables.

### Project Structure After Build

```
dist/
├── ELEVATED-Setup-2.0.0-x64.exe  (Windows installer)
├── ELEVATED-2.0.0.dmg             (macOS disk image)
└── ELEVATED-2.0.0-x64.AppImage    (Linux AppImage)
```

### Distribution Checklist

Before distributing, ensure:
- [ ] Both Python executables built successfully
  - Check: `python-dist/ARGUS_core/` exists with executable
  - Check: `python-dist/VLF_core/` exists with executable
- [ ] Templates folder populated
- [ ] Electron app builds without errors
- [ ] Test on target platform:
  - [ ] Launcher opens
  - [ ] ARGUS opens and can compress/decompress
  - [ ] VLF Compressor opens and can compress/decompress
  - [ ] Files save correctly to output folder

### Folder Requirements Before Building

Make sure these folders exist and are populated:
```
python-dist/
├── ARGUS_core/
│   ├── ARGUS_core (or ARGUS_core.exe)
│   └── _internal/
└── VLF_core/
    ├── VLF_core (or VLF_core.exe)
    └── _internal/

templates/
└── [Your template folders]
```

If `python-dist/` is empty, run the build scripts first!

### Common Build Issues

#### "Python executable not found" during runtime
- **Cause**: Python executables not built before Electron build
- **Fix**: Run `build-python.sh/bat` and `build-vlf.sh/bat` first

#### "Module not found" errors in Python
- **Cause**: Missing dependencies in PyInstaller spec
- **Fix**: Add to `hiddenimports` in `python/ARGUS_core.spec` or `python/VLF_core.spec`

#### Electron build fails with "file not found"
- **Cause**: Missing directories in `package-elevated.json` files list
- **Fix**: Check that all directories in `files:[]` exist

#### App crashes on startup
- **Check**:
  1. Console output for error messages (run from terminal)
  2. `elevated-main.js` file exists and is set as main in package.json
  3. All preload.js files exist in correct locations

### Testing Without Full Build

```bash
# Test Python executables directly
./python-dist/ARGUS_core/ARGUS_core list-templates
./python-dist/VLF_core/VLF_core compress "test message"

# Test Electron app (uses system Python)
npm start
```

### Environment Variables for Testing

```bash
# Override template/output directories
export ARGUS_USER_TEMPLATES="/path/to/test/templates"
export ARGUS_OUTPUT_DIR="/path/to/test/output"
```

### Updating the Version Number

Edit `package-elevated.json`:
```json
{
  "version": "2.0.1",  // Update this
  ...
}
```

Rebuild and the version will appear in the installer filename.

---

## Troubleshooting

### Build fails with "command not found"
- **Windows**: Make sure Python and npm are in PATH
- **macOS/Linux**: Use `python3` instead of `python` if needed

### "Module cv2 has no attribute..." during build
- Clear build cache: `rm -rf python/build python/dist`
- Reinstall dependencies: `pip install --force-reinstall opencv-python`
- Rebuild

### Installer is huge (>500MB)
- This is expected! It includes:
  - Python runtime
  - OpenCV libraries
  - NumPy libraries
  - All dependencies
- Size breakdown:
  - ARGUS_core: ~200-300MB
  - VLF_core: ~30-50MB
  - Electron: ~150MB

### Cannot write to output folder
- Run installer with appropriate permissions
- Choose a different output folder on first run
- Check antivirus isn't blocking writes

---

## Quick Reference

### File Locations (After Install)
- **Executable**: System dependent (Program Files, Applications, /opt)
- **Templates**: `~/Documents/ELEVATED/templates`
- **Output**: `~/Documents/ELEVATED/output`
- **Settings**: System app data directory

### Python Entry Points
- ARGUS: `python-dist/ARGUS_core/ARGUS_core [command] [args...]`
- VLF: `python-dist/VLF_core/VLF_core [command] [args...]`

### Commands
**ARGUS_core**:
- `list-templates` - List available templates
- `compress <image> <template> <dtg> <output>` - Compress image
- `decompress <message> <output> <template>` - Decompress message
- `create-template <image> <name> <coords...>` - Create new template

**VLF_core**:
- `compress <text>` - Compress text
- `decompress <encoded>` - Decompress text

### Build Time Estimates
- Python executables: 2-5 minutes each
- Electron app: 5-10 minutes
- Total: ~15-25 minutes for full build

---

**Questions?** Check ELEVATED_README.md for detailed documentation.
