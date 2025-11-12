const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const settings = require('./settings');

let launcherWindow = null;
let argusWindow = null;
let vlfWindow = null;
let userSettings = null;

// Get app root directory (where the executable/app is located)
function getAppRootDir() {
  if (app.isPackaged) {
    // In production, use the directory where the app is installed
    if (process.platform === 'darwin') {
      // macOS: Navigate to Resources/app where unpacked files are
      return path.join(path.dirname(app.getPath('exe')), '..', 'Resources', 'app.asar.unpacked');
    } else {
      // Windows/Linux: Use resources/app.asar.unpacked
      return path.join(path.dirname(app.getPath('exe')), 'resources', 'app.asar.unpacked');
    }
  } else {
    // In development, use the project directory
    return __dirname;
  }
}

// Get executable directory (where the .exe lives, for user-accessible files like templates)
function getExeDir() {
  if (app.isPackaged) {
    // Return the directory containing the executable
    if (process.platform === 'darwin') {
      // macOS: app is in Contents/MacOS, go up to .app parent
      return path.join(path.dirname(app.getPath('exe')), '..', '..');
    } else {
      // Windows/Linux: directory where exe lives
      return path.dirname(app.getPath('exe'));
    }
  } else {
    // In development, use the project directory
    return __dirname;
  }
}

// Python executable path for ARGUS
function getPythonPath() {
  // In production (packaged app), use installed Python executable
  if (app.isPackaged) {
    // Check for platform-specific executable names
    // Windows: ARGUS_core.exe, Mac/Linux: ARGUS_core
    const exeName = process.platform === 'win32' ? 'ARGUS_core.exe' : 'ARGUS_core';

    // Python is installed in resources/python/ARGUS_core/ directory
    // The PyInstaller build creates a onedir bundle:
    //   resources/python/ARGUS_core/ARGUS_core (executable)
    //   resources/python/ARGUS_core/_internal/ (dependencies)
    const resourcesPath = process.resourcesPath;
    const pythonPath = path.join(resourcesPath, 'python', 'ARGUS_core', exeName);

    console.log('[ARGUS] Looking for installed Python executable');
    console.log('[ARGUS] Resources path:', resourcesPath);
    console.log('[ARGUS] Python path:', pythonPath);

    if (fs.existsSync(pythonPath)) {
      console.log('[ARGUS] ✓ Found Python executable at:', pythonPath);
      console.log('[ARGUS] Process architecture:', process.arch);
      console.log('[ARGUS] Install directory:', path.dirname(resourcesPath));

      // Verify the _internal directory exists (contains all DLLs on Windows, .so files on Linux)
      const internalDir = path.join(resourcesPath, 'python', 'ARGUS_core', '_internal');
      if (fs.existsSync(internalDir)) {
        console.log('[ARGUS] ✓ Python _internal directory found');
        const files = fs.readdirSync(internalDir);
        console.log('[ARGUS] ✓ Found', files.length, 'files in _internal directory');

        // Check for critical files (Windows only)
        if (process.platform === 'win32') {
          const python311dll = path.join(internalDir, 'python311.dll');
          const vcruntime = path.join(internalDir, 'vcruntime140.dll');

          if (fs.existsSync(python311dll)) {
            const stats = fs.statSync(python311dll);
            console.log('[ARGUS] ✓ python311.dll found, size:', stats.size, 'bytes');
          } else {
            console.error('[ARGUS] ✗ python311.dll NOT FOUND at:', python311dll);
          }

          if (fs.existsSync(vcruntime)) {
            console.log('[ARGUS] ✓ vcruntime140.dll found');
          } else {
            console.warn('[ARGUS] ✗ vcruntime140.dll NOT FOUND - VC++ Redistributable may be missing');
          }
        }
      } else {
        console.warn('[ARGUS] WARNING: Python _internal directory not found');
        console.warn('[ARGUS] Expected at:', internalDir);
      }

      return pythonPath;
    } else {
      console.error('[ARGUS] CRITICAL ERROR: Python executable not found!');
      console.error('[ARGUS] Expected at:', pythonPath);
      console.error('[ARGUS] Resources path:', resourcesPath);
      console.error('[ARGUS] This indicates the installer did not install Python correctly');
      return null;
    }
  }

  // In development, use system Python
  console.log('[ARGUS] Development mode - using system Python');
  if (process.platform === 'darwin' || process.platform === 'linux') {
    return 'python3';
  }
  return 'python'; // Windows
}

// Python executable path for VLF
function getVLFPythonPath() {
  // In production (packaged app), use installed Python executable
  if (app.isPackaged) {
    // Check for platform-specific executable names
    // Windows: VLF_core.exe, Mac/Linux: VLF_core
    const exeName = process.platform === 'win32' ? 'VLF_core.exe' : 'VLF_core';

    // Python is installed in resources/python/VLF_core/ directory
    // The PyInstaller build creates a onedir bundle:
    //   resources/python/VLF_core/VLF_core (executable)
    //   resources/python/VLF_core/_internal/ (dependencies)
    const resourcesPath = process.resourcesPath;
    const pythonPath = path.join(resourcesPath, 'python', 'VLF_core', exeName);

    console.log('[VLF] Looking for installed Python executable');
    console.log('[VLF] Resources path:', resourcesPath);
    console.log('[VLF] Python path:', pythonPath);

    if (fs.existsSync(pythonPath)) {
      console.log('[VLF] ✓ Found Python executable at:', pythonPath);
      console.log('[VLF] Process architecture:', process.arch);
      console.log('[VLF] Install directory:', path.dirname(resourcesPath));

      // Verify the _internal directory exists
      const internalDir = path.join(resourcesPath, 'python', 'VLF_core', '_internal');
      if (fs.existsSync(internalDir)) {
        console.log('[VLF] ✓ Python _internal directory found');
        const files = fs.readdirSync(internalDir);
        console.log('[VLF] ✓ Found', files.length, 'files in _internal directory');
      } else {
        console.warn('[VLF] WARNING: Python _internal directory not found');
        console.warn('[VLF] Expected at:', internalDir);
      }

      return pythonPath;
    } else {
      console.error('[VLF] CRITICAL ERROR: Python executable not found!');
      console.error('[VLF] Expected at:', pythonPath);
      console.error('[VLF] Resources path:', resourcesPath);
      console.error('[VLF] This indicates the installer did not install Python correctly');
      return null;
    }
  }

  // In development, use system Python
  console.log('[VLF] Development mode - using system Python');
  if (process.platform === 'darwin' || process.platform === 'linux') {
    return 'python3';
  }
  return 'python'; // Windows
}

// Show first-run setup dialog
async function showSetupDialog() {
  const exeDir = getExeDir();
  const defaultSettings = settings.getDefaultSettings(exeDir);

  return new Promise((resolve) => {
    const setupWindow = new BrowserWindow({
      width: 600,
      height: 400,
      modal: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    // Create a simple HTML for the setup dialog
    const setupHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>ARGUS Setup</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 30px;
      background: #f5f5f5;
    }
    h1 { color: #333; font-size: 24px; margin-bottom: 10px; }
    p { color: #666; margin-bottom: 30px; }
    .option {
      background: white;
      padding: 20px;
      margin-bottom: 15px;
      border-radius: 8px;
      border: 2px solid #ddd;
      cursor: pointer;
      transition: all 0.2s;
    }
    .option:hover { border-color: #4CAF50; }
    .option.selected { border-color: #4CAF50; background: #f0f8f0; }
    .option h3 { margin: 0 0 8px 0; color: #333; }
    .option p { margin: 0; font-size: 14px; color: #666; }
    .path {
      font-family: monospace;
      background: #f5f5f5;
      padding: 4px 8px;
      border-radius: 4px;
      margin-top: 8px;
      display: block;
      font-size: 12px;
    }
    button {
      background: #4CAF50;
      color: white;
      border: none;
      padding: 12px 30px;
      font-size: 16px;
      border-radius: 6px;
      cursor: pointer;
      width: 100%;
      margin-top: 20px;
    }
    button:hover { background: #45a049; }
    button:disabled { background: #ccc; cursor: not-allowed; }
  </style>
</head>
<body>
  <h1>Welcome to ARGUS</h1>
  <p>Choose where to store your templates and output files:</p>

  <div class="option selected" id="default" onclick="selectOption('default')">
    <h3>📁 User Data Folder (Recommended)</h3>
    <p>Store files in your user profile folder (no admin permissions needed)</p>
    <span class="path">Templates: ${defaultSettings.templatesDir}</span>
    <span class="path">Output: ${defaultSettings.outputDir}</span>
  </div>

  <div class="option" id="custom" onclick="selectOption('custom')">
    <h3>🗂️ Custom Location</h3>
    <p>Choose your own folders for templates and output</p>
  </div>

  <button id="continue" onclick="continueSetup()">Continue</button>

  <script>
    let selectedOption = 'default';

    function selectOption(option) {
      selectedOption = option;
      document.querySelectorAll('.option').forEach(el => el.classList.remove('selected'));
      document.getElementById(option).classList.add('selected');
    }

    async function continueSetup() {
      if (selectedOption === 'default') {
        window.electron.send('setup-complete', { useDefaults: true });
      } else {
        window.electron.send('setup-choose-folders');
      }
    }
  </script>
</body>
</html>`;

    // Write HTML to temp file and load it
    const tmpPath = path.join(app.getPath('temp'), 'argus-setup.html');
    fs.writeFileSync(tmpPath, setupHTML);
    setupWindow.loadFile(tmpPath);

    // Handle setup completion
    ipcMain.once('setup-complete', (event, choice) => {
      let finalSettings;

      if (choice.useDefaults) {
        finalSettings = defaultSettings;
      } else {
        finalSettings = choice.settings;
      }

      settings.saveSettings(finalSettings);
      setupWindow.close();
      resolve(finalSettings);
    });

    // Handle custom folder selection
    ipcMain.once('setup-choose-folders', async () => {
      const templatesDir = await dialog.showOpenDialog(setupWindow, {
        title: 'Select Templates Folder',
        defaultPath: defaultSettings.templatesDir,
        properties: ['openDirectory', 'createDirectory']
      });

      if (templatesDir.canceled) {
        return;
      }

      const outputDir = await dialog.showOpenDialog(setupWindow, {
        title: 'Select Output Folder',
        defaultPath: defaultSettings.outputDir,
        properties: ['openDirectory', 'createDirectory']
      });

      if (outputDir.canceled) {
        return;
      }

      const customSettings = {
        templatesDir: templatesDir.filePaths[0],
        outputDir: outputDir.filePaths[0],
        firstRun: false
      };

      settings.saveSettings(customSettings);
      setupWindow.close();
      resolve(customSettings);
    });
  });
}

// Ensure directories exist based on user settings
function ensureDirectories() {
  try {
    const appRoot = getAppRootDir();
    const bundledTemplatesDir = path.join(appRoot, 'templates');

    console.log('[ARGUS] App root directory:', appRoot);
    console.log('[ARGUS] Bundled templates directory:', bundledTemplatesDir);
    console.log('[ARGUS] User templates directory:', userSettings.templatesDir);
    console.log('[ARGUS] Output directory:', userSettings.outputDir);

    // Create user directories
    if (!fs.existsSync(userSettings.templatesDir)) {
      console.log('[ARGUS] Creating templates directory...');
      fs.mkdirSync(userSettings.templatesDir, { recursive: true });
    }

    if (!fs.existsSync(userSettings.outputDir)) {
      console.log('[ARGUS] Creating output directory...');
      fs.mkdirSync(userSettings.outputDir, { recursive: true });
    }

    // Check bundled templates exist (these come with the app)
    if (!fs.existsSync(bundledTemplatesDir)) {
      console.warn('[ARGUS] WARNING: Bundled templates directory not found at:', bundledTemplatesDir);
      console.warn('[ARGUS] This likely means the app was not packaged correctly.');
    } else {
      // Copy bundled templates to user directory if user templates is empty
      const userTemplateFiles = fs.readdirSync(userSettings.templatesDir);
      if (userTemplateFiles.length === 0) {
        console.log('[ARGUS] Copying bundled templates to user directory...');
        copyDirectory(bundledTemplatesDir, userSettings.templatesDir);
        console.log('[ARGUS] ✓ Bundled templates copied successfully');
      }
    }

    console.log('[ARGUS] Template search order: 1) User templates, 2) Bundled templates');
  } catch (error) {
    console.error('[ARGUS] Error setting up directories:', error);
  }
}

// Helper function to recursively copy directory
function copyDirectory(src, dest) {
  // Create destination directory
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read all files and subdirectories
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy subdirectory
      copyDirectory(srcPath, destPath);
    } else {
      // Copy file
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Get platform-specific troubleshooting steps for Python verification failures
 * @returns {string} Platform-specific troubleshooting message
 */
function getPlatformTroubleshooting() {
  if (process.platform === 'win32') {
    return 'Troubleshooting:\n' +
      '1. Install Visual C++ Redistributable 2015-2022\n' +
      '   Download from: https://aka.ms/vs/17/release/vc_redist.x64.exe\n' +
      '2. Check antivirus/firewall settings\n' +
      '3. Try running as administrator\n' +
      '4. Reinstall ARGUS to a different location';
  } else if (process.platform === 'darwin') {
    return 'Troubleshooting:\n' +
      '1. Check Security & Privacy settings\n' +
      '2. Right-click ARGUS and select "Open" to bypass Gatekeeper\n' +
      '3. Check antivirus/firewall settings\n' +
      '4. Reinstall ARGUS to your Applications folder';
  } else {
    // Linux
    return 'Troubleshooting:\n' +
      '1. Make sure the AppImage has execute permissions:\n' +
      '   chmod +x ARGUS-*.AppImage\n' +
      '2. Check if FUSE is installed (required for AppImage):\n' +
      '   Ubuntu/Debian: sudo apt install fuse libfuse2\n' +
      '   Fedora: sudo dnf install fuse fuse-libs\n' +
      '3. Try extracting and running directly:\n' +
      '   ./ARGUS-*.AppImage --appimage-extract\n' +
      '   ./squashfs-root/AppRun\n' +
      '4. Check system logs: journalctl -xe';
  }
}

/**
 * Verify Python executable works by testing DLL loading
 * @param {string} pythonPath - Path to Python executable
 * @returns {Promise<boolean>} True if verification succeeded
 */
async function verifyPythonExecutable(pythonPath) {
  return new Promise((resolve) => {
    console.log('[ARGUS] Verifying Python executable...');
    console.log('[ARGUS] Python path:', pythonPath);
    console.log('[ARGUS] Platform:', process.platform);

    // Get the directory containing the Python exe for working directory
    const pythonDir = path.dirname(pythonPath);
    console.log('[ARGUS] Python directory:', pythonDir);

    // Check if this is a bundled executable (ARGUS_core.exe)
    const isBundledExe = pythonPath && (pythonPath.endsWith('ARGUS_core.exe') || pythonPath.endsWith('ARGUS_core'));

    // For bundled executable, use 'list-templates' command which should always work
    // For regular Python, use --version
    const testArgs = isBundledExe ? ['list-templates'] : ['--version'];

    console.log('[ARGUS] Test command:', testArgs[0]);

    const testProcess = spawn(pythonPath, testArgs, {
      cwd: pythonDir,  // Run in Python's directory so DLLs can be found
      timeout: 30000,  // 30 second timeout (increased for slow systems)
      env: {
        ...process.env,
        // For bundled exe, provide minimal env vars for list-templates to work
        ARGUS_USER_TEMPLATES: path.join(app.getPath('userData'), 'templates'),
        ARGUS_BUNDLED_TEMPLATES: path.join(getAppRootDir(), 'templates')
      }
    });

    let stdout = '';
    let stderr = '';

    testProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    testProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log('[ARGUS] ✓ Python executable verification successful');
        console.log('[ARGUS] DLLs loaded correctly, Python is ready');
        console.log('[ARGUS] Test output:', stdout.substring(0, 100));
        resolve(true);
      } else {
        console.error('[ARGUS] ✗ Python executable verification failed with code:', code);
        console.error('[ARGUS] stdout:', stdout);
        console.error('[ARGUS] stderr:', stderr);
        console.error('[ARGUS] Python path:', pythonPath);
        console.error('[ARGUS] Python exists:', fs.existsSync(pythonPath));

        // If exit code is null, the process was killed (timeout or crash)
        const wasTimeout = code === null;

        // Build detailed error message
        let errorDetails = '';
        if (wasTimeout) {
          errorDetails = 'Verification timed out (process took longer than 30 seconds)\n' +
            'This might indicate a slow system or DLL loading issues.\n' +
            'However, Python may still work correctly for actual operations.';
        } else if (stderr) {
          errorDetails = stderr;
        } else if (stdout) {
          errorDetails = stdout;
        } else {
          errorDetails = `Exit code: ${code}\nNo error output captured`;
        }

        const response = dialog.showMessageBoxSync({
          type: 'info',
          title: 'Python Verification Warning',
          message: 'Python verification did not complete successfully',
          detail: errorDetails + '\n\n' +
            'Python path: ' + pythonPath + '\n' +
            'File exists: ' + fs.existsSync(pythonPath) + '\n\n' +
            'Note: Even if verification fails, ARGUS operations may still work.\n' +
            'Try using the application - if you encounter issues:\n\n' +
            getPlatformTroubleshooting() + '\n\n' +
            'Continue to use ARGUS?',
          buttons: ['Continue', 'Exit'],
          defaultId: 0,
          cancelId: 1
        });

        if (response === 1) {
          // User chose to exit
          app.quit();
        }
        resolve(false);
      }
    });

    testProcess.on('error', (error) => {
      console.error('[ARGUS] ✗ Failed to start Python process:', error.message);
      console.error('[ARGUS] Error code:', error.code);
      console.error('[ARGUS] Error stack:', error.stack);
      console.error('[ARGUS] Python path:', pythonPath);
      console.error('[ARGUS] Python exists:', fs.existsSync(pythonPath));

      const response = dialog.showMessageBoxSync({
        type: 'info',
        title: 'Python Verification Warning',
        message: 'Could not verify Python executable',
        detail: 'Error: ' + error.message + '\n' +
          'Error code: ' + (error.code || 'unknown') + '\n' +
          'Python path: ' + pythonPath + '\n' +
          'File exists: ' + fs.existsSync(pythonPath) + '\n\n' +
          'Note: Even if verification fails, ARGUS operations may still work.\n' +
          'Try using the application - if you encounter issues:\n\n' +
          getPlatformTroubleshooting() + '\n\n' +
          'Continue to use ARGUS?',
        buttons: ['Continue', 'Exit'],
        defaultId: 0,
        cancelId: 1
      });

      if (response === 1) {
        // User chose to exit
        app.quit();
      }
      resolve(false);
    });
  });
}

// Create launcher window
function createLauncherWindow() {
  // Create the browser window
  launcherWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'elevated-preload.js')
    },
    show: false // Don't show until ready
  });

  // Load the launcher HTML file
  launcherWindow.loadFile(path.join(__dirname, 'elevated-renderer', 'index.html'));

  // Show when ready
  launcherWindow.once('ready-to-show', () => {
    launcherWindow.show();
  });

  // Security: Block navigation
  launcherWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  // Security: Block new windows
  launcherWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Open DevTools only in development
  if (!app.isPackaged) {
    launcherWindow.webContents.openDevTools();
  }

  launcherWindow.on('closed', () => {
    launcherWindow = null;
  });
}

// Create ARGUS window
function createArgusWindow() {
  // Don't create if already exists
  if (argusWindow !== null) {
    argusWindow.focus();
    return;
  }

  // Create the browser window
  argusWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'argus', 'argus-preload.js')
    },
    show: false // Don't show until ready
  });

  // Load the ARGUS HTML file
  argusWindow.loadFile(path.join(__dirname, 'argus', 'renderer', 'index.html'));

  // Show when ready
  argusWindow.once('ready-to-show', () => {
    argusWindow.show();
  });

  // Security: Block navigation
  argusWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  // Security: Block new windows
  argusWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Open DevTools only in development
  if (!app.isPackaged) {
    argusWindow.webContents.openDevTools();
  }

  argusWindow.on('closed', () => {
    argusWindow = null;
  });
}

// Create VLF window
function createVlfWindow() {
  // Don't create if already exists
  if (vlfWindow !== null) {
    vlfWindow.focus();
    return;
  }

  // Create the browser window
  vlfWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'vlf', 'vlf-preload.js')
    },
    show: false // Don't show until ready
  });

  // Load the VLF HTML file
  vlfWindow.loadFile(path.join(__dirname, 'vlf', 'renderer', 'index.html'));

  // Show when ready
  vlfWindow.once('ready-to-show', () => {
    vlfWindow.show();
  });

  // Security: Block navigation
  vlfWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  // Security: Block new windows
  vlfWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Open DevTools only in development
  if (!app.isPackaged) {
    vlfWindow.webContents.openDevTools();
  }

  vlfWindow.on('closed', () => {
    vlfWindow = null;
  });
}

app.whenReady().then(async () => {
  // Load or initialize settings
  userSettings = settings.loadSettings();

  if (!userSettings || settings.isFirstRun()) {
    console.log('[ARGUS] First run detected - showing setup dialog');
    userSettings = await showSetupDialog();
  }

  console.log('[ARGUS] Using settings:', userSettings);

  // Ensure directories exist
  ensureDirectories();

  // Initialize Python executable early (before any IPC calls)
  // This ensures ARGUS_core.exe is copied to root and ready to use
  console.log('[ARGUS] Initializing Python executable...');
  const pythonPath = getPythonPath();

  if (app.isPackaged && !pythonPath) {
    console.error('[ARGUS] CRITICAL: Python executable initialization failed');

    // Check if installed in wrong Program Files folder (architecture mismatch)
    const installDir = app.getPath('exe');
    const isIn32BitFolder = installDir.includes('Program Files (x86)');
    const arch = process.arch;

    let errorMessage = 'Failed to initialize Python runtime.\n\n';

    if (isIn32BitFolder && arch === 'x64') {
      errorMessage += '⚠️ ARCHITECTURE MISMATCH DETECTED ⚠️\n\n' +
        'This 64-bit application is installed in the 32-bit Program Files folder.\n' +
        'Install location: ' + installDir + '\n\n' +
        'Please:\n' +
        '1. Uninstall ARGUS\n' +
        '2. Reinstall to the correct location (C:\\Program Files\\ARGUS)\n' +
        '3. Make sure to download the x64 installer\n\n';
    } else {
      errorMessage += 'Please try:\n' +
        '1. Install Visual C++ Redistributable 2015-2022 (x64)\n' +
        '   Download: https://aka.ms/vs/17/release/vc_redist.x64.exe\n\n' +
        '2. Run ARGUS as administrator\n\n' +
        '3. Reinstall ARGUS\n\n' +
        '4. Check antivirus is not blocking Python DLLs\n\n';
    }

    dialog.showErrorBox('ARGUS Initialization Error', errorMessage);
  } else if (pythonPath) {
    console.log('[ARGUS] ✓ Python executable ready at:', pythonPath);

    // Verify Python exe works by testing DLL loading
    if (app.isPackaged) {
      const verificationSuccess = await verifyPythonExecutable(pythonPath);
      if (!verificationSuccess) {
        console.warn('[ARGUS] Python verification failed, but continuing anyway...');
        console.warn('[ARGUS] Some features may not work correctly.');
      }
    }
  }

  // Initialize VLF Python executable
  console.log('[VLF] Initializing VLF Python executable...');
  const vlfPythonPath = getVLFPythonPath();

  if (vlfPythonPath) {
    console.log('[VLF] ✓ VLF Python executable ready at:', vlfPythonPath);
  } else {
    console.warn('[VLF] VLF Python executable not found, but continuing anyway...');
    console.warn('[VLF] VLF features may not work in production mode.');
  }

  // Create launcher window first (not ARGUS window)
  createLauncherWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (launcherWindow === null && argusWindow === null && vlfWindow === null) {
    createLauncherWindow();
  }
});

// Check Python dependencies
function checkPythonDependencies() {
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath();

    // If using bundled Python executable, skip dependency check (everything is bundled)
    // Check if path ends with ARGUS_core.exe or ARGUS_core (bundled executable name)
    // This works whether it's at root level or in python-dist subdirectory
    if (pythonPath && (pythonPath.endsWith('ARGUS_core.exe') || pythonPath.endsWith('ARGUS_core'))) {
      console.log('[ARGUS] Using bundled Python executable - skipping dependency check');
      resolve({ available: true, version: 'Bundled', bundled: true });
      return;
    }

    // Development mode: Check if Python and dependencies are available
    // First check if Python is available
    const checkPython = spawn(pythonPath, ['--version']);

    let pythonFound = false;
    let pythonVersion = '';

    checkPython.stdout.on('data', (data) => {
      pythonVersion = data.toString().trim();
      pythonFound = true;
    });

    checkPython.stderr.on('data', (data) => {
      pythonVersion = data.toString().trim();
      pythonFound = true;
    });

    checkPython.on('error', () => {
      reject({
        available: false,
        missing: 'python',
        message: 'Python is not installed or not in PATH.\n\nPlease install Python 3.8+ from https://python.org/\n\nMake sure to check "Add Python to PATH" during installation.'
      });
    });

    checkPython.on('close', (code) => {
      if (!pythonFound) {
        reject({
          available: false,
          missing: 'python',
          message: 'Python is not installed or not in PATH.\n\nPlease install Python 3.8+ from https://python.org/\n\nMake sure to check "Add Python to PATH" during installation.'
        });
        return;
      }

      // Now check for required packages
      const checkModules = spawn(pythonPath, [
        '-c',
        'import cv2, numpy, imageio, yaml; print("OK")'
      ]);

      let modulesOk = false;
      let errorOutput = '';

      checkModules.stdout.on('data', (data) => {
        if (data.toString().includes('OK')) {
          modulesOk = true;
        }
      });

      checkModules.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      checkModules.on('close', () => {
        if (modulesOk) {
          resolve({ available: true, version: pythonVersion });
        } else {
          let missingModule = 'unknown';
          if (errorOutput.includes('cv2')) missingModule = 'opencv-python';
          else if (errorOutput.includes('numpy')) missingModule = 'numpy';
          else if (errorOutput.includes('imageio')) missingModule = 'imageio';
          else if (errorOutput.includes('yaml')) missingModule = 'pyyaml';

          reject({
            available: false,
            missing: missingModule,
            message: `Python is installed but required packages are missing.\n\nPlease install dependencies by running:\n\npython -m pip install opencv-python numpy Pillow imageio pyyaml\n\nOr run the setup script:\n  Windows: setup.bat\n  Mac/Linux: ./setup.sh`
          });
        }
      });

      checkModules.on('error', () => {
        reject({
          available: false,
          missing: 'modules',
          message: 'Failed to check Python modules.\n\nPlease install dependencies:\npython -m pip install opencv-python numpy Pillow imageio pyyaml'
        });
      });
    });
  });
}

// Execute Python command for ARGUS
function executePython(command, args) {
  return new Promise((resolve, reject) => {
    // Ensure userSettings is loaded before executing Python
    if (!userSettings) {
      reject(new Error('User settings not initialized. Please restart the application.'));
      return;
    }

    const pythonPath = getPythonPath();
    const appRoot = getAppRootDir();

    let spawnCommand = pythonPath;
    let spawnArgs;

    // Check if using bundled Python executable (production)
    // Check if path ends with ARGUS_core.exe or ARGUS_core (bundled executable name)
    // This works whether it's at root level or in python-dist subdirectory
    const isBundledExe = pythonPath && (pythonPath.endsWith('ARGUS_core.exe') || pythonPath.endsWith('ARGUS_core'));

    if (isBundledExe) {
      // Bundled executable: Python interpreter and script are already compiled in
      // Just pass the command and arguments directly
      spawnArgs = [command, ...args];
      console.log('[ARGUS] Using bundled Python executable');
    } else {
      // Development mode: Call Python interpreter with script
      const scriptPath = path.join(appRoot, 'python', 'ARGUS_core.py');

      // Check if script exists
      if (!fs.existsSync(scriptPath)) {
        console.error('[ARGUS] ERROR: Python script not found at:', scriptPath);
        reject(new Error(`Python script not found at: ${scriptPath}`));
        return;
      }

      // Set working directory to app root so Python finds templates there
      const pythonArgs = [scriptPath, command, ...args];
      spawnArgs = pythonArgs;

      // On macOS, detect hardware architecture and run Python natively
      // This prevents arm64/x86_64 mismatch with Python packages like numpy
      if (process.platform === 'darwin') {
        try {
          const { execSync } = require('child_process');
          const hardwareArch = execSync('uname -m').toString().trim();
          console.log('[ARGUS] Hardware architecture:', hardwareArch);
          console.log('[ARGUS] Electron process architecture:', process.arch);

          // Run Python in native hardware architecture to avoid package conflicts
          // Example: If on Apple Silicon (arm64) but Electron is x86_64, run Python as arm64
          spawnCommand = 'arch';
          spawnArgs = [`-${hardwareArch}`, pythonPath, ...pythonArgs];
          console.log('[ARGUS] Using arch command to run Python natively');
        } catch (error) {
          console.error('[ARGUS] Failed to detect architecture, using default Python:', error.message);
        }
      }
    }

    // Use exe directory as working directory for template and output file access
    const exeDir = getExeDir();
    const workDir = exeDir;

    console.log('[ARGUS] Executing Python command:', command);
    console.log('[ARGUS] Spawn command:', spawnCommand);
    console.log('[ARGUS] Spawn args:', spawnArgs);
    console.log('[ARGUS] Working directory:', workDir);

    const pythonProcess = spawn(spawnCommand, spawnArgs, {
      cwd: workDir,  // Set working directory to exe directory
      env: {
        ...process.env,
        // Pass user-configured directories to Python
        ARGUS_USER_TEMPLATES: userSettings.templatesDir,
        ARGUS_BUNDLED_TEMPLATES: path.join(appRoot, 'templates'),
        ARGUS_OUTPUT_DIR: userSettings.outputDir
      }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('[ARGUS] Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      console.log('[ARGUS] Python process closed with code:', code);

      if (code !== 0) {
        console.error('[ARGUS] Python error:', stderr);
        reject(new Error(`Python error: ${stderr}`));
        return;
      }

      try {
        // Handle empty stdout
        if (!stdout.trim()) {
          reject(new Error('No output from Python script'));
          return;
        }

        const result = JSON.parse(stdout);
        if (result.status === 'error') {
          reject(new Error(result.error));
        } else {
          console.log('[ARGUS] Python command succeeded');
          resolve(result);
        }
      } catch (error) {
        console.error('[ARGUS] Failed to parse Python output:', stdout);
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('[ARGUS] Failed to start Python process:', error);
      reject(new Error(`Failed to start Python: ${error.message}`));
    });
  });
}

// Execute VLF Python command
function executeVLFPython(command, args) {
  return new Promise((resolve, reject) => {
    const pythonPath = getVLFPythonPath();
    const appRoot = getAppRootDir();

    let spawnCommand = pythonPath;
    let spawnArgs;

    // Check if using bundled Python executable (production)
    const isBundledExe = pythonPath && (pythonPath.endsWith('VLF_core.exe') || pythonPath.endsWith('VLF_core'));

    if (isBundledExe) {
      // Bundled executable: Python interpreter and script are already compiled in
      spawnArgs = [command, ...args];
      console.log('[VLF] Using bundled Python executable');
    } else {
      // Development mode: Call Python interpreter with script
      const scriptPath = path.join(appRoot, 'python', 'VLF_core.py');

      // Check if script exists
      if (!fs.existsSync(scriptPath)) {
        console.error('[VLF] ERROR: Python script not found at:', scriptPath);
        reject(new Error(`VLF Python script not found at: ${scriptPath}`));
        return;
      }

      const pythonArgs = [scriptPath, command, ...args];
      spawnArgs = pythonArgs;

      // On macOS, detect hardware architecture and run Python natively
      if (process.platform === 'darwin') {
        try {
          const { execSync } = require('child_process');
          const hardwareArch = execSync('uname -m').toString().trim();
          console.log('[VLF] Hardware architecture:', hardwareArch);
          console.log('[VLF] Electron process architecture:', process.arch);

          spawnCommand = 'arch';
          spawnArgs = [`-${hardwareArch}`, pythonPath, ...pythonArgs];
          console.log('[VLF] Using arch command to run Python natively');
        } catch (error) {
          console.error('[VLF] Failed to detect architecture, using default Python:', error.message);
        }
      }
    }

    const exeDir = getExeDir();
    const workDir = exeDir;

    console.log('[VLF] Executing Python command:', command);
    console.log('[VLF] Spawn command:', spawnCommand);
    console.log('[VLF] Spawn args:', spawnArgs);
    console.log('[VLF] Working directory:', workDir);

    const pythonProcess = spawn(spawnCommand, spawnArgs, {
      cwd: workDir,
      env: {
        ...process.env
      }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('[VLF] Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      console.log('[VLF] Python process closed with code:', code);

      if (code !== 0) {
        console.error('[VLF] Python error:', stderr);
        reject(new Error(`VLF Python error: ${stderr}`));
        return;
      }

      try {
        // Handle empty stdout
        if (!stdout.trim()) {
          reject(new Error('No output from VLF Python script'));
          return;
        }

        const result = JSON.parse(stdout);
        if (result.status === 'error') {
          reject(new Error(result.error));
        } else {
          console.log('[VLF] Python command succeeded');
          resolve(result);
        }
      } catch (error) {
        console.error('[VLF] Failed to parse Python output:', stdout);
        reject(new Error(`Failed to parse VLF Python output: ${stdout}`));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('[VLF] Failed to start Python process:', error);
      reject(new Error(`Failed to start VLF Python: ${error.message}`));
    });
  });
}

// =============================================================================
// IPC HANDLERS
// =============================================================================

// ===== LAUNCHER IPC HANDLERS =====

ipcMain.on('launch-app', (event, appName) => {
  console.log('[LAUNCHER] Launching app:', appName);

  if (appName === 'argus') {
    createArgusWindow();
  } else if (appName === 'vlf') {
    createVlfWindow();
  } else {
    console.error('[LAUNCHER] Unknown app name:', appName);
  }
});

// ===== ARGUS IPC HANDLERS =====

ipcMain.handle('select-file', async (event, options) => {
  // Determine which window to use as parent
  let parentWindow = argusWindow || launcherWindow;
  const result = await dialog.showOpenDialog(parentWindow, options);
  return result.filePaths[0];
});

ipcMain.handle('list-templates', async () => {
  try {
    console.log('[ARGUS] Listing templates...');
    const result = await executePython('list-templates', []);
    console.log('[ARGUS] Found', result.templates?.length || 0, 'templates');

    if (!result.templates || result.templates.length === 0) {
      console.warn('[ARGUS] No templates found');
      console.warn('[ARGUS] User templates dir:', userSettings.templatesDir);
      console.warn('[ARGUS] Bundled templates dir:', path.join(getAppRootDir(), 'templates'));

      // Check if directories exist
      const userTemplatesExist = fs.existsSync(userSettings.templatesDir);
      const bundledTemplatesExist = fs.existsSync(path.join(getAppRootDir(), 'templates'));

      console.warn('[ARGUS] User templates exist:', userTemplatesExist);
      console.warn('[ARGUS] Bundled templates exist:', bundledTemplatesExist);

      if (!bundledTemplatesExist) {
        return {
          success: false,
          error: 'Bundled templates not found. The application may not be packaged correctly.'
        };
      }
    }

    return { success: true, data: result.templates || [] };
  } catch (error) {
    console.error('[ARGUS] List templates error:', error);
    console.error('[ARGUS] This usually indicates Python runtime failed to start');

    // Provide more helpful error message
    let errorMessage = error.message;
    if (error.message.includes('Failed to start Python')) {
      errorMessage = 'Python runtime failed to start. This is usually caused by DLL loading issues.\n\n' +
        'Please ensure:\n' +
        '1. The application is extracted to a folder with write permissions\n' +
        '2. Visual C++ Redistributable is installed\n' +
        '3. Antivirus is not blocking the application';
    }

    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('compress-image', async (event, args) => {
  try {
    const outputPath = path.join(
      userSettings.outputDir,
      `${args.templateName}_${args.dtg}.txt`
    );

    const result = await executePython('compress', [
      args.imagePath,
      args.templateName,
      args.dtg,
      outputPath
    ]);

    return { success: true, data: result };
  } catch (error) {
    console.error('Compress error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('decompress-message', async (event, args) => {
  try {
    const outputPath = path.join(
      userSettings.outputDir,
      `decoded_${Date.now()}.gif`
    );

    // Pass template name as third argument
    const result = await executePython('decompress', [
      args.messagePath,
      outputPath,
      args.templateName
    ]);

    return { success: true, data: result };
  } catch (error) {
    console.error('Decompress error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-user-data-path', async () => {
  return getAppRootDir();
});

ipcMain.handle('save-dialog', async (event, options) => {
  let parentWindow = argusWindow || launcherWindow;
  const result = await dialog.showSaveDialog(parentWindow, options);
  return result.filePath;
});

ipcMain.handle('show-item-in-folder', async (event, filePath) => {
  const { shell } = require('electron');

  // If no specific file path provided, open the output folder
  if (!filePath) {
    shell.openPath(userSettings.outputDir);
  } else {
    shell.showItemInFolder(filePath);
  }
});

ipcMain.handle('create-template', async (event, args) => {
  try {
    const result = await executePython('create-template', [
      args.imagePath,
      args.templateName,
      args.scaleCoords.start_x.toString(),
      args.scaleCoords.start_y.toString(),
      args.scaleCoords.end_x.toString(),
      args.scaleCoords.end_y.toString(),
      args.cropCoords.top.toString(),
      args.cropCoords.bottom.toString(),
      args.cropCoords.left.toString(),
      args.cropCoords.right.toString()
    ]);

    return { success: true, data: result };
  } catch (error) {
    console.error('Create template error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-temp-message', async (event, text) => {
  try {
    const tempPath = path.join(userSettings.outputDir, `temp_message_${Date.now()}.txt`);
    fs.writeFileSync(tempPath, text);
    return tempPath;
  } catch (error) {
    console.error('Save temp message error:', error);
    throw error;
  }
});

ipcMain.handle('check-python-dependencies', async () => {
  try {
    const result = await checkPythonDependencies();
    return { success: true, data: result };
  } catch (error) {
    console.error('Python dependency check failed:', error);
    return { success: false, error: error };
  }
});

ipcMain.handle('get-image-data-url', async (event, filePath) => {
  try {
    // Read the image file
    const imageBuffer = fs.readFileSync(filePath);

    // Determine MIME type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/png'; // default

    if (ext === '.jpg' || ext === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === '.gif') {
      mimeType = 'image/gif';
    } else if (ext === '.bmp') {
      mimeType = 'image/bmp';
    } else if (ext === '.webp') {
      mimeType = 'image/webp';
    }

    // Convert to base64 data URL
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return dataUrl;
  } catch (error) {
    console.error('Failed to convert image to data URL:', error);
    throw error;
  }
});

// ===== VLF IPC HANDLERS =====

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    console.log('[VLF] Reading file:', filePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read the file as text
    const content = fs.readFileSync(filePath, 'utf8');

    console.log('[VLF] File read successfully, length:', content.length);
    return { success: true, data: content };
  } catch (error) {
    console.error('[VLF] Read file error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('vlf-compress', async (event, text) => {
  try {
    console.log('[VLF] Compressing text, length:', text.length);

    const result = await executeVLFPython('compress', [text]);

    console.log('[VLF] Compression successful');
    console.log('[VLF] Original size:', result.originalSize);
    console.log('[VLF] Compressed size:', result.compressedSize);

    return { success: true, data: result };
  } catch (error) {
    console.error('[VLF] Compress error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('vlf-decompress', async (event, encodedText) => {
  try {
    console.log('[VLF] Decompressing text, length:', encodedText.length);

    const result = await executeVLFPython('decompress', [encodedText]);

    console.log('[VLF] Decompression successful');
    console.log('[VLF] Decoded text length:', result.decodedText?.length || 0);

    return { success: true, data: result };
  } catch (error) {
    console.error('[VLF] Decompress error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-vlf-file', async (event, args) => {
  try {
    console.log('[VLF] Saving file:', args.filename);

    // Use output directory from settings
    const outputPath = path.join(userSettings.outputDir, args.filename);

    // Ensure output directory exists
    if (!fs.existsSync(userSettings.outputDir)) {
      fs.mkdirSync(userSettings.outputDir, { recursive: true });
    }

    // Write the content to file
    fs.writeFileSync(outputPath, args.content, 'utf8');

    console.log('[VLF] File saved successfully:', outputPath);
    return { success: true, data: { path: outputPath } };
  } catch (error) {
    console.error('[VLF] Save file error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('copy-to-clipboard', async (event, text) => {
  try {
    console.log('[VLF] Copying to clipboard, length:', text.length);

    // Use Electron's clipboard module
    clipboard.writeText(text);

    console.log('[VLF] Text copied to clipboard successfully');
    return { success: true };
  } catch (error) {
    console.error('[VLF] Copy to clipboard error:', error);
    return { success: false, error: error.message };
  }
});
