const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const settings = require('./settings');

let mainWindow = null;
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

// Python executable path
function getPythonPath() {
  const exeDir = getExeDir();
  const appRoot = getAppRootDir();

  // In production (packaged app), use bundled Python executable
  if (app.isPackaged) {
    // Check for platform-specific executable names
    // Windows: ARGUS_core.exe, Mac/Linux: ARGUS_core
    const exeName = process.platform === 'win32' ? 'ARGUS_core.exe' : 'ARGUS_core';

    // Target: Python exe at root level (same dir as ARGUS.exe)
    // CRITICAL: PyInstaller's runtime_tmpdir='.' extracts DLLs relative to exe location
    // By placing it next to ARGUS.exe, DLLs extract to user-writable directory
    const targetPython = path.join(exeDir, exeName);

    // Check if we already have it at root level
    if (fs.existsSync(targetPython)) {
      console.log('[ARGUS] Using root-level Python executable:', targetPython);
      return targetPython;
    }

    // Python exe not at root yet - need to copy it from bundled location
    console.log('[ARGUS] Python exe not found at root, searching bundle...');

    // Find source: Check multiple possible bundle locations
    let sourcePython = null;
    const possibleLocations = [
      path.join(appRoot, exeName),                    // Root of unpacked
      path.join(appRoot, 'python-dist', exeName),     // python-dist subdirectory
      path.join(path.dirname(appRoot), exeName)       // One level up
    ];

    for (const location of possibleLocations) {
      if (fs.existsSync(location)) {
        sourcePython = location;
        console.log('[ARGUS] Found bundled Python at:', sourcePython);
        break;
      }
    }

    if (!sourcePython) {
      console.error('[ARGUS] CRITICAL ERROR: Bundled Python executable not found!');
      console.error('[ARGUS] Searched locations:', possibleLocations);
      return null;
    }

    // Copy Python exe to root level (next to ARGUS.exe)
    // This ensures PyInstaller extracts DLLs to exe directory, not temp
    try {
      console.log('[ARGUS] Copying Python exe from bundle to root...');
      console.log('[ARGUS]   Source:', sourcePython);
      console.log('[ARGUS]   Target:', targetPython);

      fs.copyFileSync(sourcePython, targetPython);

      // On Unix systems, preserve executable permission
      if (process.platform !== 'win32') {
        fs.chmodSync(targetPython, 0o755);
      }

      console.log('[ARGUS] ✓ Python exe copied successfully to root level');
      console.log('[ARGUS] DLLs will now extract to:', exeDir);
      return targetPython;
    } catch (error) {
      console.error('[ARGUS] ERROR copying Python exe:', error.message);
      console.error('[ARGUS] Falling back to bundled location (may cause DLL errors)');
      return sourcePython;
    }
  }

  // In development, use system Python
  console.log('[ARGUS] Development mode - using system Python');
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
    <h3>📁 Next to Application (Recommended)</h3>
    <p>Store files in the same folder as ARGUS.exe for easy access</p>
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
    }

    console.log('[ARGUS] Template search order: 1) User templates, 2) Bundled templates');
  } catch (error) {
    console.error('[ARGUS] Error setting up directories:', error);
  }
}


// Create main window
function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Changed to false for file system access
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js') // Correct path for preload
    },
    show: false // Don't show until ready
  });

  // CRITICAL FIX: Use path.join for renderer file
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Security: Block navigation
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  // Security: Block new windows
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Open DevTools only in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
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

  // Create main window
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Check Python dependencies
function checkPythonDependencies() {
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath();

    // If using bundled Python executable, skip dependency check (everything is bundled)
    if (pythonPath.includes('python-dist') &&
        (pythonPath.endsWith('ARGUS_core.exe') || pythonPath.endsWith('ARGUS_core'))) {
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

// Execute Python command
function executePython(command, args) {
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath();
    const appRoot = getAppRootDir();

    let spawnCommand = pythonPath;
    let spawnArgs;

    // Check if using bundled Python executable (production)
    const isBundledExe = pythonPath.includes('python-dist') &&
                         (pythonPath.endsWith('ARGUS_core.exe') || pythonPath.endsWith('ARGUS_core'));

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

    // Use exe directory as working directory for:
    // 1. Python DLL extraction (runtime_tmpdir='.' in spec file)
    // 2. Template and output file access
    const exeDir = getExeDir();
    const workDir = exeDir;

    console.log('[ARGUS] Executing Python command:', command);
    console.log('[ARGUS] Spawn command:', spawnCommand);
    console.log('[ARGUS] Spawn args:', spawnArgs);
    console.log('[ARGUS] Working directory:', workDir);

    const pythonProcess = spawn(spawnCommand, spawnArgs, {
      cwd: workDir,  // Set working directory to exe directory (for DLL extraction)
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

// IPC Handlers

ipcMain.handle('select-file', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result.filePaths[0];
});

ipcMain.handle('list-templates', async () => {
  try {
    const result = await executePython('list-templates', []);
    return { success: true, data: result.templates || [] };
  } catch (error) {
    console.error('List templates error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('compress-image', async (event, args) => {
  try {
    const outputPath = path.join(
      getAppRootDir(),
      'output',
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
      getAppRootDir(),
      'output',
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
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result.filePath;
});

ipcMain.handle('show-item-in-folder', async (event, filePath) => {
  const { shell } = require('electron');

  // If no specific file path provided, open the output folder
  if (!filePath) {
    const outputPath = path.join(getAppRootDir(), 'output');
    shell.openPath(outputPath);
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
    const tempPath = path.join(getAppRootDir(), 'output', `temp_message_${Date.now()}.txt`);
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
