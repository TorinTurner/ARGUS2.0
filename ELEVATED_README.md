# ELEVATED Platform

**Unified Communications Platform - Version 2.0**

ELEVATED is a comprehensive desktop application that combines two powerful communication tools in a single, portable package:

1. **ARGUS 2.0** - Advanced Radio-Graphical Undersea System for weather image compression
2. **VLF Message Compressor** - Text message compression tool using Brotli + Base32 encoding

## Features

### ARGUS 2.0
- **Weather Image Compression**: Compress weather GIF/JPG images for VLF transmission
- **Decompression**: Decode received VLF messages back to images
- **Template Management**: Create and manage custom templates for different Areas of Responsibility (AORs)
- **Compression Ratio**: Achieves 1:4500 compression using Discrete Fourier Transform (DFT)
- **File Size**: Compressed messages < 1KB

### VLF Message Compressor
- **Text Compression**: Compress text messages using Brotli algorithm
- **Base32 Encoding**: ASCII-safe encoding for transmission-friendly output
- **Bidirectional**: Both compress and decompress functionality
- **User-Friendly**: Simple drag-and-drop interface or text input
- **Statistics**: View compression ratios and size comparisons
- **Clipboard Support**: Copy results directly to clipboard

## System Requirements

- **Windows**: Windows 10 or later (x64/ARM64)
- **macOS**: macOS 10.13 or later (Intel/Apple Silicon)
- **Linux**: Ubuntu 18.04+ or equivalent (x64)

## Installation

### Option 1: Pre-built Binaries (Recommended)
1. Download the appropriate installer for your platform from the Releases page
2. Run the installer and follow the prompts
3. Launch ELEVATED from your applications menu or desktop shortcut

### Option 2: Build from Source
See [Building from Source](#building-from-source) section below.

## Usage

### Launcher
When you start ELEVATED, you'll see a launcher window with two options:
- **Launch ARGUS** - Opens the ARGUS 2.0 weather image compression tool
- **Launch VLF Compressor** - Opens the VLF Message Compressor

### ARGUS 2.0 Usage

#### Shore Mode (Compress)
1. Select or drag a weather GIF/JPG image
2. Choose the appropriate template (AOR)
3. Enter the DTG (Date-Time-Group)
4. Click "Generate VLF Message"
5. Message file will be saved to the output folder

#### Submarine Mode (Decompress)
1. Load the VLF message file or paste the message text
2. Select the template that matches the message
3. Click "Decode & Display Image"
4. Weather image will be displayed and saved

### VLF Message Compressor Usage

#### Compress Mode
1. Load a text file or enter/paste your message
2. Click "Compress & Encode Message"
3. View compression statistics
4. Save the compressed message or copy to clipboard

#### Decompress Mode
1. Load a file or paste the encoded message
2. Click "Decode & Decompress Message"
3. View the original message
4. Save or copy the decompressed text

## File Locations

### First Run
On first launch, you'll be asked to choose where to store files:
- **User Data Folder** (Recommended): Stores files in your user profile
- **Custom Location**: Choose your own folders

### Default Locations
- **Templates**: `~/Documents/ELEVATED/templates` (or `%USERPROFILE%\Documents\ELEVATED\templates` on Windows)
- **Output**: `~/Documents/ELEVATED/output` (or `%USERPROFILE%\Documents\ELEVATED\output` on Windows)

## Building from Source

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+
- Git

### Install Dependencies
```bash
npm install
pip install pyinstaller opencv-python numpy Pillow imageio pyyaml brotli
```

### Build Python Executables

#### Windows
```bash
npm run build-python:win
```

#### macOS/Linux
```bash
npm run build-python:unix
```

This will build both ARGUS_core and VLF_core Python executables.

### Build Electron App

#### Windows
```bash
npm run dist-win-x64
```

#### macOS
```bash
npm run dist-mac
```

#### Linux
```bash
npm run dist-linux-x64
```

The built application will be in the `dist/` folder.

### Development Mode
To run the app in development mode without building:
```bash
# Make sure package.json "main" points to "elevated-main.js"
npm start
```

## Project Structure

```
ARGUS2.0/
├── elevated-main.js          # Main Electron process
├── elevated-preload.js       # Preload script for launcher
├── elevated-renderer/        # Launcher UI
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── argus/                    # ARGUS 2.0 application
│   ├── argus-main.js        # (reference only)
│   ├── argus-preload.js     # Preload script
│   ├── settings.js
│   └── renderer/            # ARGUS UI
│       ├── index.html
│       ├── app.js
│       └── styles.css
├── vlf/                      # VLF Message Compressor
│   ├── vlf-preload.js       # Preload script
│   └── renderer/            # VLF UI
│       ├── index.html
│       ├── app.js
│       └── styles.css
├── python/                   # Python backends
│   ├── ARGUS_core.py        # ARGUS compression engine
│   ├── ARGUS_core.spec      # PyInstaller config for ARGUS
│   ├── VLF_core.py          # VLF compression engine
│   ├── VLF_core.spec        # PyInstaller config for VLF
│   ├── plot.py              # ARGUS plotting module
│   ├── textCompression.py   # ARGUS text compression
│   └── buildConfig.py       # ARGUS configuration
├── templates/                # Bundled ARGUS templates
├── python-dist/              # Built Python executables (generated)
│   ├── ARGUS_core/
│   └── VLF_core/
├── build-python.sh/bat       # Build script for ARGUS Python
├── build-vlf.sh/bat          # Build script for VLF Python
├── package-elevated.json     # Electron package config for ELEVATED
└── settings.js               # Settings management
```

## Technical Details

### ARGUS Compression
- **Algorithm**: Discrete Fourier Transform (DFT)
- **Input**: Weather GIF/JPG images
- **Output**: Compressed text message < 1KB
- **Compression Ratio**: ~1:4500

### VLF Message Compression
- **Algorithm**: Brotli compression + Base32 encoding
- **Input**: Plain text
- **Output**: ASCII-safe Base32 encoded string
- **Compression Ratio**: Varies based on input (typical 2:1 to 5:1)

### Security
- Context isolation enabled
- Sandboxed renderer processes
- No remote code execution
- All processing done locally

## Dependencies

### Node.js Dependencies
- electron ^27.0.0
- electron-builder ^24.6.4

### Python Dependencies (Bundled)
- opencv-python
- numpy
- Pillow
- imageio
- pyyaml
- brotli

**Note**: All dependencies are bundled in the distributable package. No additional installations required after installation.

## Credits

### ARGUS 2.0
- **Original Algorithm & Design**: LCDR Sean Peneyra / Aevix LLC
- **Electron Implementation**: ITN1 Torin Turner / Elevated Engineering LLC

### VLF Message Compressor
- **Design & Implementation**: ITN1 Torin Turner / Elevated Engineering LLC

### ELEVATED Platform
- **Integration & Platform Development**: ITN1 Torin Turner / Elevated Engineering LLC

## License

See individual component licenses.

## Support

For issues, questions, or feature requests, please open an issue on the GitHub repository.

## Version History

### Version 2.0.0 (Current)
- Initial release of ELEVATED platform
- Integrated ARGUS 2.0
- Added VLF Message Compressor
- Unified launcher interface
- Full portability (all dependencies bundled)
- Cross-platform support (Windows, macOS, Linux)

## Troubleshooting

### Windows: "Python executable not found" Error
- Install Visual C++ Redistributable 2015-2022 from: https://aka.ms/vs/17/release/vc_redist.x64.exe
- Try running as administrator
- Check antivirus/firewall settings

### macOS: "App is damaged" Message
- Right-click the app and select "Open" to bypass Gatekeeper
- Check Security & Privacy settings in System Preferences

### Linux: AppImage Won't Run
- Make sure FUSE is installed: `sudo apt install fuse libfuse2`
- Make the AppImage executable: `chmod +x ELEVATED-*.AppImage`
- Extract and run directly if needed: `./ELEVATED-*.AppImage --appimage-extract`

### VLF Decompression Fails
- Ensure the encoded message is copied completely (no truncation)
- Check for special characters that may have been modified
- The message must be valid Base32 encoded Brotli compressed data

## Development Notes

### Adding New Features
1. For ARGUS features: Modify files in `argus/` and `python/ARGUS_core.py`
2. For VLF features: Modify files in `vlf/` and `python/VLF_core.py`
3. For launcher features: Modify files in `elevated-renderer/` and `elevated-main.js`

### Testing
```bash
# Test in development mode
npm start

# Build and test production version
npm run build-python:unix  # or build-python:win
npm run pack  # Creates unpacked version in dist/
```

### IPC Channels
See `elevated-main.js` for all available IPC handlers:
- ARGUS: `list-templates`, `compress-image`, `decompress-message`, `create-template`, etc.
- VLF: `vlf-compress`, `vlf-decompress`, `read-file`, `save-vlf-file`, `copy-to-clipboard`
- Common: `select-file`, `show-item-in-folder`, `get-user-data-path`

## Roadmap

Potential future enhancements:
- Additional compression algorithms
- Batch processing support
- Network transmission utilities
- Enhanced template editor
- Message encryption options
- Command-line interface

---

**ELEVATED** - Unified Communications Platform
Version 2.0 | Elevated Engineering LLC
