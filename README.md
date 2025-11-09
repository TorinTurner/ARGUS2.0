# ARGUS 2.0 - Weather Image Compression System

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/TorinTurner/ARGUS2.0)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/TorinTurner/ARGUS2.0)
[![License](https://img.shields.io/badge/license-Public%20Domain-green.svg)](https://github.com/TorinTurner/ARGUS2.0)

**ARGUS** (Automated Responsive Graphical Update System) is a sophisticated weather image compression system designed for Very Low Frequency (VLF) radio transmission to submarines. It enables shore-side meteorological centers to compress large weather map GIF files (70-100KB) into compact text messages (~1KB) that can be transmitted over ultra-low bandwidth VLF channels and reconstructed aboard submarines.

**Original Algorithm:** LCDR Sean Peneyra, U.S. Navy / Aevix LLC
**Modern UI Wrapper:** Electron-based desktop application with cross-platform support

---

## Table of Contents

- [Overview](#overview)
- [How ARGUS Works](#how-argus-works)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Architecture](#architecture)
- [Building for Distribution](#building-for-distribution)
- [Templates](#templates)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License & Attribution](#license--attribution)

---

## Overview

### The Problem

Submarines operating underwater rely on VLF radio for communication, which operates at extremely low bandwidth (~10-50 bits per second). Traditional weather maps are 70-100KB GIF files - far too large to transmit over VLF. A typical weather GIF would take hours or days to transmit at VLF speeds.

### The Solution

ARGUS uses advanced image processing and compression to reduce weather maps to ~1KB of text, achieving **99% compression**:

- **Input:** 70-100KB weather GIF image
- **Output:** ~1KB text message (Base62 encoded)
- **Transmission Time:** Minutes instead of hours
- **Accuracy:** Visually indistinguishable reconstruction

### Key Features

- **Dual Mode Operation:**
  - **Shore Mode:** Compress weather GIFs into VLF messages
  - **Submarine Mode:** Decode VLF messages back into weather images

- **Cross-Platform:**
  - Windows 7, 10, 11
  - macOS 10.13+ (Intel & Apple Silicon)
  - Linux (AppImage)

- **Self-Contained:**
  - Portable executables bundle everything needed
  - No installation required on target machines
  - 100% offline operation (no network access)

- **Modern UI:**
  - Drag-and-drop file handling
  - Real-time progress indicators
  - Auto-detection of templates and DTG
  - Dark mode interface

---

## How ARGUS Works

ARGUS achieves extreme compression through a multi-stage process that exploits the specific characteristics of meteorological data visualization.

### Compression Pipeline (Shore Mode)

#### 1. Template Matching & Image Preprocessing

Weather maps follow standardized templates with known geographic regions and color scales. ARGUS uses templates to:

- **Isolate the data region:** Remove static map elements (coastlines, borders, labels)
- **Extract the color scale:** Identify RGB values that correspond to data values (wave heights, temperatures, etc.)
- **Crop to relevant area:** Focus only on the region containing meteorological data

**Template Structure:**
```yaml
name: EUCOM
cr: [80, 648, 8, 990]  # Crop boundaries [top, bottom, left, right]
scale:                  # RGB color scale (blue → red for wave heights)
  - [0, 12, 112]        # Low values (blue)
  - [0, 42, 217]
  - [0, 110, 217]
  ...
  - [217, 0, 0]         # High values (red)
  - [140, 0, 0]
```

#### 2. Color Quantization

The cropped weather image uses a gradient color scale to represent scalar values (e.g., wave height from 0-30 feet). ARGUS:

- Maps each pixel's RGB value to the nearest color in the template scale
- Converts the full-color image into an indexed color image (e.g., 19 discrete values)
- **Result:** RGB image → single-channel scalar field

**File:** `python/plot.py:build_scale()`

#### 3. Discrete Fourier Transform (DFT)

Weather patterns exhibit spatial continuity - nearby ocean regions have similar wave heights. ARGUS exploits this via 2D DFT:

- Applies 2D Discrete Fourier Transform to the scalar field
- Weather data is smooth → most energy concentrates in **low-frequency coefficients**
- High-frequency coefficients (fine details) are negligible

**Mathematical Foundation:**
```
F(u,v) = Σ Σ f(x,y) * e^(-2πi(ux/M + vy/N))

Where:
- f(x,y) = spatial domain (pixel values)
- F(u,v) = frequency domain (DFT coefficients)
- Low frequencies (small u,v) = gradual changes
- High frequencies (large u,v) = rapid changes ≈ 0 for weather
```

**File:** `python/ARGUS_core.py` using NumPy FFT

#### 4. Coefficient Selection & Ordering

Only the most significant DFT coefficients are kept:

- Coefficients ordered by frequency magnitude (lowest first)
- Typical: Keep ~600-800 coefficients out of 200,000+ pixels
- **Compression ratio at this stage: 99.6%**

**Ordering Strategy (file:** `python/textCompression.py:dft_mapping()`):
```python
# Store coefficients in order of increasing frequency
# Pattern: DC component → low freq → medium freq
# Each complex coefficient = real + imaginary parts
[DC_real, DC_imag, F(0,1)_real, F(0,1)_imag, ...]
```

#### 5. Logarithmic Quantization

DFT coefficients span a wide dynamic range. ARGUS uses logarithmic quantization:

```python
def coeff_round(x):  # Range: [-1000, 1000] → [0, 35]
    # Logarithmic mapping preserves precision for small values
    # Base62 character set = 36 chars (0-9, A-Z)
    x_log = log10(abs(x))
    index = floor(x_log / step_size) * 2 + sign_bit
    return index
```

**Advantages:**
- Small coefficients (important!) get high precision
- Large coefficients (less important) get lower precision
- Efficient use of the 36-character Base62 alphabet

**File:** `python/textCompression.py:coeff_round()`

#### 6. Base62 Encoding

Quantized coefficients are encoded as alphanumeric characters:

- Character set: `0-9A-Z` (36 characters)
- Each coefficient → 1 character
- 600 coefficients → 600 characters
- **Final output:** ~1KB text message

**Message Format:**
```
[Height]/[Width]/[Depth]/[Scale_Length]/[DTG]/[Template]/[Magic]/
[Base62_Coefficients]/
```

Example:
```
638/1027/16/12/160200Z APR 2025/EUCOM/A1R1G2U3S5/
X3DYAINGR2CA9V4C6JO4F8M... (600+ chars)
```

**File:** `python/textCompression.py`

### Decompression Pipeline (Submarine Mode)

The submarine reverses the process:

1. **Parse Message:** Extract metadata (dimensions, template, DTG) and Base62 data
2. **Base62 Decode:** Convert characters back to quantized coefficients
3. **Logarithmic Dequantization:** Restore coefficient magnitudes
4. **Inverse DFT:** Reconstruct the scalar field from frequency domain
5. **Recolorize:** Apply template color scale to scalar values
6. **Overlay Template:** Composite the reconstructed data onto the template map
7. **Save Image:** Generate GIF file

**File:** `python/ARGUS_core.py:decode_message()`

### Compression Performance

**Typical Results:**
- **Input Size:** 72,849 bytes (EUCOM example)
- **Output Size:** 1,056 bytes (text message)
- **Compression Ratio:** 98.6%
- **Processing Time:** 3-5 seconds (compression), 2-3 seconds (decompression)
- **Visual Quality:** Near-identical to original

---

## Requirements

### System Requirements

- **Operating System:**
  - Windows 7, 10, or 11 (x64 or ARM64)
  - macOS 10.13+ (Intel or Apple Silicon)
  - Linux (glibc 2.17+, tested on Ubuntu 18.04+)

- **Hardware:**
  - CPU: Any modern processor (Intel, AMD, Apple Silicon)
  - RAM: 4 GB minimum, 8 GB recommended
  - Disk Space: 500 MB for development, 200 MB for portable build

### Software Dependencies

#### For Using Portable Builds (Recommended)

**No dependencies required!** Portable builds are completely self-contained:

- ✅ Bundled Python interpreter
- ✅ Bundled Electron runtime
- ✅ All Python packages included
- ✅ No installation needed

Just download and run.

#### For Development / Running from Source

**Node.js (Required):**
- Version: 18.x or newer
- Download: https://nodejs.org/
- Used for: Electron runtime

**Python (Required):**
- Version: 3.8 or newer (3.11 recommended)
- Download: https://python.org/
- Used for: Image processing algorithms

**Python Packages:**
```bash
opencv-python >= 4.8.0   # Image processing
numpy >= 1.24.0          # Numerical operations & FFT
Pillow >= 10.0.0         # Image I/O
imageio >= 2.31.0        # GIF handling
PyYAML >= 6.0            # Template configuration
```

**Build Tools (Optional - for creating distributables):**
```bash
electron-builder >= 24.6.4  # Package Electron apps
pyinstaller >= 6.0.0        # Bundle Python interpreter
```

---

## Installation

### Option 1: Portable Executable (Recommended for End Users)

Download the pre-built portable executable for your platform:

**Windows:**
```
Download: ARGUS-Setup-2.0.0-x64.exe
Size: ~200 MB
Run: Double-click to install
```

**macOS:**
```
Download: ARGUS-2.0.0.dmg
Size: ~200 MB
Install: Open DMG and drag to Applications
```

**Linux:**
```
Download: ARGUS-2.0.0.AppImage
Size: ~200 MB
Run: chmod +x ARGUS-2.0.0.AppImage && ./ARGUS-2.0.0.AppImage
```

**No setup required!** Everything is bundled.

### Option 2: Quick Setup (Run from Source)

For development or testing:

#### Windows:
```bash
# 1. Install dependencies
setup.bat

# 2. Run ARGUS
npm start
```

#### macOS / Linux:
```bash
# 1. Make setup script executable
chmod +x setup.sh

# 2. Install dependencies
./setup.sh

# 3. Run ARGUS
npm start
```

**What `setup.bat` / `setup.sh` does:**
1. Installs Node.js dependencies (`npm install`)
2. Installs Python packages (`pip install opencv-python numpy Pillow imageio pyyaml`)
3. Creates necessary directories (`output/`, `templates/`)
4. Verifies installation

### Option 3: Manual Installation (Advanced)

```bash
# 1. Clone repository
git clone https://github.com/TorinTurner/ARGUS2.0.git
cd ARGUS2.0

# 2. Install Node.js dependencies
npm install

# 3. Install Python dependencies
pip install -r python/requirements.txt
# or
pip3 install opencv-python numpy Pillow imageio pyyaml

# 4. Run ARGUS
npm start
```

---

## Usage

### Shore Mode (Compress Weather GIF → VLF Message)

**Purpose:** Convert weather maps into compact text messages for VLF transmission.

#### Step-by-Step:

1. **Launch ARGUS:**
   ```bash
   npm start
   # or double-click portable executable
   ```

2. **Ensure Shore Mode is selected** (default mode, 🏖️ Shore button)

3. **Load Weather Image:**
   - **Drag and drop** a GIF file into the drop zone
   - **Or click** "Choose File" to browse

   Supported formats: `.gif`, `.jpg`, `.png`

4. **Select Template:**
   - ARGUS auto-detects template from filename (e.g., `EUCOM_source.gif` → `EUCOM`)
   - Or manually select from dropdown
   - Available templates: `EUCOM`, `LANT`, custom templates

5. **Set Date-Time-Group (DTG):**
   - Click **"📅 Now"** to auto-fill current date/time
   - Or manually enter in format: `DDHHMMZ MMM YYYY` (e.g., `160200Z APR 2025`)

6. **Generate Message:**
   - Click **"Generate VLF Message"**
   - Progress bar shows compression status
   - Processing time: 3-5 seconds

7. **View Results:**
   - Compressed message displays in output area
   - Statistics shown: original size, compressed size, ratio
   - Message saved to `output/[template]_[dtg].txt`
   - Click **"Open Output Folder"** to view file

#### Example Output:
```
R XXXXXXZ MMM YY
FM COMSUBPAC PEARL HARBOR HI
TO SSBN PAC
BT
UNCLAS
SUBJ/VLF WEATHER GIF//
RMKS/REACH OUT TO ISIC FOR INSTRUCTIONS ON HOW TO USE THIS MESSAGE.
638/1027/16/12/160200Z APR 2025/EUCOM/A1R1G2U3S5/
X3DYAINGR2CA9V4C6JO4F8MDN0IZDLCDNFDY3KTDPOSZ31STEQ4IX1QPICQVFYKA496Y...
BT
#0001
NNNN
```

### Submarine Mode (Decode VLF Message → Weather Image)

**Purpose:** Reconstruct weather maps from received VLF messages.

#### Step-by-Step:

1. **Switch to Submarine Mode:**
   - Click **🚢 Submarine** button

2. **Input VLF Message:**

   **Option A - File Drop:**
   - Drag and drop `.txt` file containing the VLF message
   - Example: `examples/EUCOM.txt`

   **Option B - Paste Text:**
   - Copy entire VLF message
   - Paste into text area
   - ARGUS validates the message format

3. **Decode Message:**
   - Click **"Decode & Display Image"**
   - ARGUS extracts metadata and decompresses
   - Processing time: 2-3 seconds

4. **View Reconstructed Image:**
   - Weather map displays in preview area
   - Image saved to `output/[template]_[dtg]_decoded.gif`
   - Click **"Open Output Folder"** to view file

#### Message Validation:

ARGUS checks for:
- ✅ ARGUS magic marker (`A1R1G2U3S5` or custom)
- ✅ Valid dimensions and metadata
- ✅ Base62 encoding integrity
- ✅ Template availability

### Testing with Example Files

ARGUS includes example files for testing:

```bash
examples/
├── EUCOM_source.gif    # Input: Original weather map (72KB)
├── EUCOM.txt           # Output: Compressed message (1KB)
├── LANT_source.gif     # Input: Atlantic weather map (98KB)
└── LANT.txt            # Output: Compressed message (1KB)
```

**Test Shore Mode:**
1. Drop `examples/EUCOM_source.gif` into Shore Mode
2. Template auto-selects "EUCOM"
3. Click "📅 Now" for DTG
4. Click "Generate VLF Message"
5. Compare output with `examples/EUCOM.txt`

**Test Submarine Mode:**
1. Switch to Submarine Mode
2. Drop `examples/EUCOM.txt`
3. Click "Decode & Display Image"
4. View reconstructed weather map
5. Compare with `examples/EUCOM_source.gif`

---

## Architecture

ARGUS uses a **multi-process architecture** with strict security boundaries:

### System Components

```
┌─────────────────────────────────────────────────────┐
│                 ARGUS Desktop App                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────┐         ┌────────────────────┐   │
│  │   Electron   │   IPC   │   Python Process   │   │
│  │  Main Process│◄───────►│  (ARGUS_core.py)   │   │
│  │   (main.js)  │         │                    │   │
│  └──────┬───────┘         └────────────────────┘   │
│         │                                            │
│         │ Context Bridge                             │
│         │ (preload.js)                               │
│         ▼                                            │
│  ┌──────────────┐                                   │
│  │   Renderer   │  UI Thread (Sandboxed)            │
│  │  (app.js)    │                                    │
│  └──────────────┘                                   │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Component Details

#### 1. Electron Main Process (`main.js`)

**Responsibilities:**
- Window management
- Inter-Process Communication (IPC) handler
- Python subprocess management
- File system operations
- Settings persistence

**Key Functions:**
```javascript
getPythonPath()        // Locate Python executable
runPythonCommand()     // Spawn Python subprocess
handleCompressImage()  // IPC: Compress workflow
handleDecodeMessage()  // IPC: Decompress workflow
```

**Security:**
- No direct renderer access to Node.js
- All file operations validated
- Python executed with minimal permissions

#### 2. Preload Script (`preload.js`)

**Responsibilities:**
- Expose safe IPC API to renderer
- Context isolation bridge
- Sanitize inputs/outputs

**Exposed API:**
```javascript
window.argus = {
  compressImage(filePath, template, dtg),
  decodeMessage(messageText),
  listTemplates(),
  openOutputFolder(),
  checkPythonDependencies()
}
```

#### 3. Renderer Process (`renderer/app.js`)

**Responsibilities:**
- User interface rendering
- Event handling (drag-drop, clicks)
- Display results
- Mode switching (Shore ↔ Submarine)

**Security:**
- **Sandboxed:** No file system access
- **Context Isolation:** No Node.js access
- **Communication:** IPC only via exposed API

#### 4. Python Core (`python/ARGUS_core.py`)

**Responsibilities:**
- Image compression algorithm
- Message decompression
- Template management
- Image processing

**Modules:**
- `ARGUS_core.py`: Main CLI interface and workflows
- `plot.py`: Color scale extraction, image preprocessing
- `textCompression.py`: DFT, quantization, Base62 encoding
- `buildConfig.py`: Template builder

**Interface:**
```bash
# Compression
python ARGUS_core.py compress \
  --input "weather.gif" \
  --template "EUCOM" \
  --dtg "160200Z APR 2025" \
  --output "message.txt"

# Decompression
python ARGUS_core.py decode \
  --input "message.txt" \
  --output "weather_decoded.gif"
```

**Python Process Lifecycle:**
1. Main process spawns Python subprocess
2. Arguments passed via command line
3. Python writes output to file
4. Python returns JSON result to stdout
5. Main process reads result and notifies renderer
6. Subprocess exits

### Data Flow Example (Shore Mode)

```
User drops GIF
       ↓
renderer/app.js detects file
       ↓
Call: window.argus.compressImage(path, template, dtg)
       ↓
preload.js → ipcRenderer.invoke('compress-image', ...)
       ↓
main.js receives IPC call
       ↓
main.js spawns Python:
  python ARGUS_core.py compress --input ... --template ... --dtg ...
       ↓
Python processes:
  1. Load GIF with imageio
  2. Load template YAML
  3. Crop image using template bounds
  4. Quantize colors to scale
  5. Apply 2D FFT
  6. Select low-frequency coefficients
  7. Quantize logarithmically
  8. Encode as Base62
  9. Format VLF message
  10. Write to output/message.txt
       ↓
Python returns JSON: { success: true, file: "output/message.txt", stats: {...} }
       ↓
main.js reads JSON from stdout
       ↓
main.js sends IPC response to renderer
       ↓
renderer displays result and statistics
```

### Template Management

Templates stored in directory structure:

```
templates/
├── EUCOM/
│   ├── EUCOM.yaml              # Configuration
│   └── EUCOM_template.gif      # Map template
├── LANT/
│   ├── LANT.yaml
│   └── LANT_template.gif
└── [Custom]/
    ├── [Custom].yaml
    └── [Custom]_template.gif
```

**Template Locations (Packaged App):**
- **Bundled Templates:** `resources/app.asar.unpacked/templates/` (read-only)
- **User Templates:** `[exe_directory]/templates/` (read-write)

ARGUS searches user templates first, then falls back to bundled templates.

---

## Building for Distribution

Create portable executables that bundle everything needed to run ARGUS.

### Prerequisites

**Install Build Tools (One-Time Setup):**

```bash
# Install Node.js dependencies
npm install

# Install Python packages
cd python
pip install -r requirements.txt
cd ..

# Install build dependencies
npm install electron-builder --save-dev
pip install pyinstaller
```

### Build Commands

#### Windows (x64)

```bash
npm run dist-win-x64
```

**Output:** `dist/ARGUS-Setup-2.0.0-x64.exe` (~200 MB)

**Process:**
1. Runs `build-python.bat` → Bundles Python with PyInstaller
2. Runs `electron-builder --win --x64` → Creates NSIS installer
3. Bundles Python executable into `resources/python/`
4. Creates single-file installer

#### Windows (ARM64)

```bash
npm run dist-win-arm64
```

**Output:** `dist/ARGUS-Setup-2.0.0-arm64.exe`

#### macOS (Universal - Intel + Apple Silicon)

```bash
npm run dist-mac-universal
```

**Output:** `dist/ARGUS-2.0.0.dmg` (~200 MB)

**Process:**
1. Runs `build-python.sh` → Bundles Python with PyInstaller (both architectures)
2. Runs `electron-builder --mac --universal`
3. Creates .dmg installer with universal binary

#### Linux (AppImage)

```bash
npm run dist-linux
```

**Output:** `dist/ARGUS-2.0.0.AppImage` (~200 MB)

**Process:**
1. Runs `build-python.sh` → Bundles Python
2. Runs `electron-builder --linux`
3. Creates AppImage (portable, no installation)

### Cross-Platform Building

**Build Windows from macOS (GitHub Actions):**

```bash
npm run dist-win-from-mac
```

Uses Docker or GitHub Actions to build Windows executable on macOS.

See [BUILD.md](BUILD.md) for detailed cross-platform build instructions.

### What Gets Bundled

**Electron Bundle:**
- Electron runtime (~150 MB)
- Application code (JavaScript, HTML, CSS)
- Templates directory
- Settings

**Python Bundle (PyInstaller):**
- Python 3.11 interpreter (~40 MB)
- All Python packages:
  - OpenCV (~30 MB)
  - NumPy (~20 MB)
  - Pillow, imageio, PyYAML (~10 MB)
- ARGUS Python scripts
- All dependencies (DLLs on Windows, dylibs on macOS, .so on Linux)

**Total Size:** ~200 MB compressed, ~400 MB installed

### Distribution

Portable executables can be:
- ✅ Copied to USB drive
- ✅ Burned to CD/DVD
- ✅ Shared via network
- ✅ Run on any compatible machine **without installation**
- ✅ No internet required
- ✅ No Python/Node.js required

**Perfect for:**
- Air-gapped / classified networks
- Shore-based meteorological centers
- Submarine deployment systems
- Offline field operations

---

## Templates

Templates define the geographic region, color scale, and metadata for specific weather map types.

### Template Structure

Each template is a directory containing:

```
templates/[TEMPLATE_NAME]/
├── [TEMPLATE_NAME].yaml           # Configuration
└── [TEMPLATE_NAME]_template.gif   # Map image with overlay
```

### Configuration File (YAML)

```yaml
name: EUCOM                # Template identifier

cr:                        # Crop bounds [top, bottom, left, right]
  - 80                     # Top edge of data region
  - 648                    # Bottom edge
  - 8                      # Left edge
  - 990                    # Right edge

scale:                     # RGB color scale (ordered low→high)
  - [0, 12, 112]           # Color 0: Dark blue (low wave height)
  - [0, 42, 217]           # Color 1: Blue
  - [0, 110, 217]          # Color 2: Cyan
  - [0, 178, 217]          # Color 3: Light cyan
  - [0, 217, 166]          # Color 4: Teal
  - [0, 217, 0]            # Color 5: Green
  - [149, 217, 0]          # Color 6: Yellow-green
  - [217, 217, 0]          # Color 7: Yellow
  - [217, 174, 0]          # Color 8: Orange-yellow
  - [217, 131, 0]          # Color 9: Orange
  - [217, 87, 0]           # Color 10: Red-orange
  - [217, 0, 0]            # Color 11: Red (high wave height)
  - [174, 0, 0]            # Color 12: Dark red
  - [140, 0, 0]            # Color 13: Very dark red

b: null                    # Optional: Scale bar bounds (auto-detected if null)
```

### Template Image

The template GIF should contain:
- **Base map:** Coastlines, borders, grid lines (static elements)
- **Data region:** Marked with a red/colored overlay where weather data appears
- **Scale bar:** (Optional) Color scale legend

The template is used to:
1. Identify the data region to extract from source images
2. Overlay reconstructed data during decompression
3. Ensure consistent geographic registration

### Creating New Templates

#### Option 1: Using ARGUS Template Builder (Recommended)

*(Feature in development - coming soon)*

#### Option 2: Manual Creation

**Requirements:**
- Source weather GIF for the region
- Image editor (Photoshop, GIMP, etc.)
- Text editor for YAML

**Steps:**

1. **Prepare Template Image:**
   ```
   - Open source weather GIF
   - Create new layer
   - Fill data region with semi-transparent red (#FF0000, 50% opacity)
   - Save as [TEMPLATE_NAME]_template.gif
   ```

2. **Determine Crop Bounds:**
   ```
   - Note pixel coordinates of data region:
     cr: [top_y, bottom_y, left_x, right_x]
   - Example: cr: [80, 648, 8, 990]
   ```

3. **Extract Color Scale:**
   ```
   - Identify all colors used in the data region
   - List RGB values in order from low→high data values
   - For wave height: blue (low) → red (high)
   ```

4. **Create YAML Configuration:**
   ```yaml
   name: MY_REGION
   cr: [80, 648, 8, 990]
   scale:
     - [0, 50, 255]    # Blue (low)
     - [0, 150, 255]
     - [255, 255, 0]   # Yellow (mid)
     - [255, 100, 0]
     - [255, 0, 0]     # Red (high)
   b: null
   ```

5. **Create Template Directory:**
   ```bash
   mkdir templates/MY_REGION
   cp my_template.gif templates/MY_REGION/MY_REGION_template.gif
   cp my_config.yaml templates/MY_REGION/MY_REGION.yaml
   ```

6. **Test Template:**
   ```
   - Restart ARGUS
   - Load a weather GIF for the region
   - Select "MY_REGION" template
   - Compress and verify output
   ```

### Built-In Templates

ARGUS includes templates for:

- **EUCOM:** European Command area of responsibility
- **LANT:** Atlantic Ocean region

Additional templates can be added by placing them in the `templates/` directory.

---

## Security

ARGUS implements defense-in-depth security for use in sensitive environments:

### Electron Security

**Context Isolation:**
```javascript
webPreferences: {
  nodeIntegration: false,        // No Node.js in renderer
  contextIsolation: true,        // Separate JS contexts
  sandbox: true,                 // OS-level sandboxing
  webSecurity: true,             // Enforce same-origin
  allowRunningInsecureContent: false,
  experimentalFeatures: false
}
```

**No Remote Code:**
- ✅ All code bundled locally
- ✅ No external script loading
- ✅ No CDN dependencies
- ✅ No web fonts from external sources

**IPC Validation:**
- All IPC messages validated
- File paths sanitized (no directory traversal)
- Inputs bounds-checked

### Network Isolation

**Zero Network Activity:**
```javascript
// Navigation blocked
webContents.on('will-navigate', (event) => event.preventDefault());

// New windows blocked
webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

// No external resources
```

ARGUS operates **100% offline:**
- ✅ No internet connection required
- ✅ No telemetry or analytics
- ✅ No update checks
- ✅ No external API calls

Perfect for:
- Air-gapped systems
- Classified networks
- Submarines (obviously!)

### Python Security

**Subprocess Isolation:**
- Python runs in separate process
- Limited to stdio communication
- No shared memory
- Minimal permissions

**File System Access:**
- Read: Input files, templates (validated paths)
- Write: Output directory only
- No system directory access
- Path traversal prevented

### Code Integrity

**No Dynamic Code Execution:**
- ✅ No `eval()` or `Function()` constructor
- ✅ No dynamic module loading
- ✅ No runtime code generation
- ✅ Static analysis friendly

**Dependencies:**
- Minimal dependency tree
- No packages with known vulnerabilities
- Regular security audits (`npm audit`)

### Data Security

**No Data Leakage:**
- Weather data processed locally
- No cloud storage
- No logging to external services
- Temporary files cleaned up

**Input Validation:**
- Image files: Magic number verification
- VLF messages: Format validation
- Templates: Schema validation
- User inputs: Sanitized

### Audit Trail

ARGUS logs operations to console (development mode):
```
[ARGUS] Compressing: EUCOM_source.gif
[ARGUS] Template: EUCOM
[ARGUS] DTG: 160200Z APR 2025
[ARGUS] Output: output/EUCOM_160200Z_APR_2025.txt
[ARGUS] Compression: 72849 → 1056 bytes (98.6%)
```

Logs include:
- File operations
- Python subprocess execution
- Errors and exceptions

No sensitive data logged.

---

## Troubleshooting

### Python Errors

#### "Python not found" or "python3: command not found"

**Solution:**

1. **Install Python 3.8+:**
   - Windows: https://python.org/ (check "Add Python to PATH")
   - macOS: `brew install python3`
   - Linux: `sudo apt install python3 python3-pip`

2. **Verify installation:**
   ```bash
   python --version   # Windows
   python3 --version  # macOS/Linux
   ```

3. **Restart terminal/ARGUS**

#### "ModuleNotFoundError: No module named 'cv2'" (or numpy, PIL, etc.)

**Solution:**

```bash
# Run setup script again
setup.bat         # Windows
./setup.sh        # macOS/Linux

# Or manually install
pip install opencv-python numpy Pillow imageio pyyaml
```

**Verify packages:**
```bash
python -c "import cv2; import numpy; import PIL; import imageio; import yaml; print('All packages OK')"
```

#### "Failed to verify Python dependencies"

**Packaged App Issues:**

If using portable executable and Python fails:

1. **Check bundled Python:**
   ```
   - Navigate to install directory
   - Check: resources/python/ARGUS_core.exe (Windows)
   - Check: resources/python/ARGUS_core (macOS/Linux)
   ```

2. **Missing DLLs (Windows):**
   ```
   Install Visual C++ Redistributable 2015-2022:
   https://aka.ms/vs/17/release/vc_redist.x64.exe
   ```

3. **Permissions:**
   ```
   - Ensure ARGUS.exe has execute permissions
   - Run as administrator (Windows) if needed
   - Check antivirus isn't blocking Python subprocess
   ```

### Electron Errors

#### "Electron failed to start"

**Solution:**

```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json  # macOS/Linux
rmdir /s node_modules                   # Windows

npm install
npm start
```

#### "A JavaScript error occurred in the main process"

**Solution:**

1. **Check console output:**
   ```
   Run with: npm start
   Look for error stack trace
   ```

2. **Common causes:**
   - Missing preload.js: Check `preload: path.join(__dirname, 'preload.js')`
   - Template directory missing: Create `templates/` directory
   - Output directory missing: Create `output/` directory

3. **Reset settings:**
   ```bash
   # Delete settings file
   # Windows: %APPDATA%/ARGUS/settings.json
   # macOS: ~/Library/Application Support/ARGUS/settings.json
   # Linux: ~/.config/ARGUS/settings.json
   ```

### Compression Errors

#### "Template not found: EUCOM"

**Solution:**

1. **Check templates directory:**
   ```bash
   ls templates/EUCOM/
   # Should show: EUCOM.yaml, EUCOM_template.gif
   ```

2. **Restore missing templates:**
   ```bash
   # Re-clone repository or download templates
   git checkout templates/
   ```

3. **Check YAML syntax:**
   ```bash
   python -c "import yaml; yaml.safe_load(open('templates/EUCOM/EUCOM.yaml'))"
   ```

#### "Compression failed: Image dimensions invalid"

**Solution:**

1. **Verify input image:**
   - File must be GIF, JPG, or PNG
   - Image must be readable
   - Check file isn't corrupted

2. **Try a different image:**
   ```bash
   # Test with example files
   npm start
   # Drop: examples/EUCOM_source.gif
   ```

3. **Check console for details:**
   ```
   Look for: [ARGUS] Error: ...
   ```

#### "DFT coefficients out of range"

**Solution:**

This indicates the image doesn't match the template. Check:

1. **Correct template selected:**
   - EUCOM images need EUCOM template
   - LANT images need LANT template

2. **Image dimensions match template crop bounds:**
   ```
   Template cr: [80, 648, 8, 990]
   Image must be larger than these bounds
   ```

### Decompression Errors

#### "Invalid message format"

**Solution:**

1. **Check message structure:**
   ```
   Message must contain:
   [dimensions]/[dtg]/[template]/[magic]/
   [base62_data]/
   ```

2. **Verify ARGUS magic marker:**
   ```
   Look for: A1R1G2U3S5
   ```

3. **Paste entire message:**
   - Include header (R XXXXXXZ MMM YY...)
   - Include body (dimensions and data)
   - Include footer (BT, #0001, NNNN)

#### "Template 'XYZ' required but not found"

**Solution:**

1. **Install missing template:**
   ```
   - Message requires specific template
   - Download/create template
   - Place in templates/XYZ/ directory
   ```

2. **Use bundled templates:**
   ```
   - EUCOM: examples/EUCOM.txt
   - LANT: examples/LANT.txt
   ```

### UI Errors

#### Drag-and-drop not working

**Solution:**

1. **Check file type:**
   - Shore mode: GIF, JPG, PNG only
   - Submarine mode: TXT files only

2. **Try "Choose File" button instead**

3. **Restart ARGUS**

#### Output folder won't open

**Solution:**

1. **Manually navigate:**
   ```
   Windows: [install_dir]/output/
   macOS: [app_dir]/output/
   Linux: [app_dir]/output/
   ```

2. **Check folder exists:**
   ```bash
   mkdir output  # Create if missing
   ```

### Performance Issues

#### Compression takes too long (>10 seconds)

**Possible Causes:**
- Very large images (>500KB)
- Slow disk I/O
- Low-end CPU

**Solutions:**
1. Resize images to ~1000x700 pixels before compression
2. Close other applications
3. Use SSD instead of HDD

#### High memory usage

**Normal:** ~200-400 MB during compression

**Excessive:** >1 GB indicates problem

**Solutions:**
1. Restart ARGUS
2. Process one image at a time
3. Check for memory leaks (long-running sessions)

---

## Development

### Project Structure

```
ARGUS2.0/
├── main.js                   # Electron main process
├── preload.js                # IPC bridge
├── settings.js               # Settings management
├── package.json              # Node.js config
│
├── renderer/                 # UI code
│   ├── index.html            # Main UI
│   ├── styles.css            # Styling
│   └── app.js                # Frontend logic
│
├── python/                   # Python algorithms
│   ├── ARGUS_core.py         # Main CLI
│   ├── plot.py               # Image processing
│   ├── textCompression.py    # DFT & encoding
│   ├── buildConfig.py        # Template builder
│   ├── requirements.txt      # Python deps
│   └── ARGUS_core.spec       # PyInstaller config
│
├── templates/                # Weather map templates
│   ├── EUCOM/
│   ├── LANT/
│   └── [custom]/
│
├── examples/                 # Test files
│   ├── EUCOM_source.gif
│   ├── EUCOM.txt
│   ├── LANT_source.gif
│   └── LANT.txt
│
├── output/                   # Generated files
│
├── build/                    # Build scripts
│   └── installer.nsh         # NSIS config
│
├── setup.bat                 # Windows setup
├── setup.sh                  # macOS/Linux setup
├── build-python.bat          # Windows Python bundler
├── build-python.sh           # macOS/Linux Python bundler
└── build-python-win.sh       # Cross-platform Windows build
```

### Development Workflow

**1. Set up development environment:**
```bash
git clone https://github.com/TorinTurner/ARGUS2.0.git
cd ARGUS2.0
npm install
pip install -r python/requirements.txt
```

**2. Run in development mode:**
```bash
npm start
```

**3. Enable DevTools:**
```bash
# Windows
set NODE_ENV=development
npm start

# macOS/Linux
NODE_ENV=development npm start
```

**4. Test Python directly:**
```bash
cd python
python ARGUS_core.py compress \
  --input ../examples/EUCOM_source.gif \
  --template EUCOM \
  --dtg "160200Z APR 2025" \
  --output ../output/test.txt
```

**5. Lint and format:**
```bash
# JavaScript (if using ESLint)
npm run lint

# Python (if using flake8/black)
pip install flake8 black
flake8 python/
black python/
```

**6. Build for testing:**
```bash
# Test packaging without distribution
npm run pack
```

### Adding Features

**New Template Support:**
1. Create template directory: `templates/[NAME]/`
2. Add YAML config: `[NAME].yaml`
3. Add template image: `[NAME]_template.gif`
4. Test with Shore Mode

**New UI Features:**
1. Edit `renderer/index.html` (structure)
2. Edit `renderer/styles.css` (styling)
3. Edit `renderer/app.js` (logic)
4. Add IPC handler in `main.js` if needed
5. Test in both modes

**Python Algorithm Changes:**
1. Edit `python/ARGUS_core.py` (main logic)
2. Edit `python/plot.py` (image processing)
3. Edit `python/textCompression.py` (compression)
4. Test with example files
5. Update tests

### Testing

**Manual Testing:**
```bash
# Test compression
npm start
# Drop: examples/EUCOM_source.gif
# Verify output matches examples/EUCOM.txt

# Test decompression
# Switch to Submarine Mode
# Drop: examples/EUCOM.txt
# Verify reconstructed image
```

**Automated Testing (Future):**
```bash
# Unit tests
npm test                  # JavaScript tests
python -m pytest python/  # Python tests

# Integration tests
npm run test:integration
```

### Debugging

**Electron Main Process:**
```bash
# Console logs appear in terminal where you ran `npm start`
console.log('[ARGUS] Debug message');
```

**Renderer Process:**
```bash
# Open DevTools: Ctrl+Shift+I (Windows/Linux) or Cmd+Option+I (macOS)
console.log('Renderer debug message');
```

**Python Subprocess:**
```python
# Logs go to stdout/stderr, captured by main.js
import sys
print('[Python] Debug message', file=sys.stderr)
```

### Contributing

**Guidelines:**
1. **Fork the repository**
2. **Create feature branch:** `git checkout -b feature/my-feature`
3. **Commit changes:** `git commit -m "Add my feature"`
4. **Push to branch:** `git push origin feature/my-feature`
5. **Open Pull Request**

**Code Style:**
- JavaScript: Follow Airbnb style guide
- Python: Follow PEP 8
- Indentation: 2 spaces (JS), 4 spaces (Python)

---

## License & Attribution

### Original ARGUS Algorithm

**Author:** LCDR Sean Peneyra, U.S. Navy
**Organization:** Aevix LLC
**Purpose:** U.S. Navy Submarine Force weather dissemination
**Status:** Product of the United States Government
**Copyright:** Not subject to copyright protection in the United States (17 USC § 105)
**Contact:** peneyra.s@gmail.com
**Original Repository:** https://github.com/Peneyra/Gif_Builder

### Modern UI Wrapper

**Version:** 2.0.0
**Copyright:** 2025 [Your LLC Name]
**License:** [Your License - TBD]
**Repository:** https://github.com/TorinTurner/ARGUS2.0

### Third-Party Dependencies

**Electron:**
- License: MIT License
- Copyright: OpenJS Foundation and contributors
- Website: https://electronjs.org/

**Python Packages:**
- **OpenCV:** Apache 2.0 License
- **NumPy:** BSD License
- **Pillow:** HPND License
- **imageio:** BSD License
- **PyYAML:** MIT License

All dependencies are open source and compatible with government use.

---

## Acknowledgments

- **U.S. Navy Submarine Force** for operational requirements and testing
- **LCDR Sean Peneyra** for the original ARGUS algorithm and Python implementation
- **Aevix LLC** for supporting development
- **Electron community** for the cross-platform framework
- **OpenCV contributors** for image processing libraries

---

## Support & Contact

### Issues & Bug Reports

**GitHub Issues:**
https://github.com/TorinTurner/ARGUS2.0/issues

**Before submitting:**
1. Check existing issues
2. Include ARGUS version
3. Include OS and version
4. Include steps to reproduce
5. Include error messages and logs

### Feature Requests

Open an issue with:
- Clear description of feature
- Use case / motivation
- Proposed implementation (optional)

### Original ARGUS

**Contact:** LCDR Sean Peneyra
**Email:** peneyra.s@gmail.com
**GitHub:** https://github.com/Peneyra/Gif_Builder

For questions about the compression algorithm, VLF operations, or Navy-specific use cases.

### Security Vulnerabilities

**DO NOT** open public issues for security vulnerabilities.

**Contact privately:**
- Email: [security-email]
- Include: Description, impact, steps to reproduce

---

## Changelog

### Version 2.0.0 (2025-04-16)

**New Features:**
- Electron-based desktop application
- Drag-and-drop file handling
- Dual-mode UI (Shore ↔ Submarine)
- Portable executables (Windows, macOS, Linux)
- Bundled Python interpreter (no installation required)
- Auto-detection of templates and DTG
- Real-time progress indicators
- Settings persistence

**Improvements:**
- Modern, dark-themed interface
- Better error messages
- Validation of inputs
- Cross-platform compatibility
- Improved security (sandboxing, context isolation)

**Bug Fixes:**
- Python path detection on packaged apps
- Template loading from bundled resources
- Output directory creation
- Message format validation

---

## Roadmap

### Short Term (v2.1)
- [ ] Template builder UI
- [ ] Batch processing mode
- [ ] Message history / favorites
- [ ] Enhanced error recovery
- [ ] Automated testing suite

### Medium Term (v2.2)
- [ ] Auto-watch folder for new images
- [ ] Scheduled compression jobs
- [ ] Message library / database
- [ ] Statistics and analytics
- [ ] Custom color scale editor

### Long Term (v3.0)
- [ ] Real-time image streaming
- [ ] Multi-template compression
- [ ] AI-enhanced compression
- [ ] Mobile app (iOS/Android)
- [ ] Navy security certification

---

**Version:** 2.0.0
**Last Updated:** November 9, 2025
**Status:** Production Ready

**🚀 Ready to compress the seas! 🌊**
