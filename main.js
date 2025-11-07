const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;

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

// Python executable path
function getPythonPath() {
  const appRoot = getAppRootDir();

  // In production (packaged app), use bundled Python executable
  if (app.isPackaged) {
    const bundledPython = path.join(appRoot, 'python-dist', 'ARGUS_core.exe');

    if (fs.existsSync(bundledPython)) {
      console.log('[ARGUS] Using bundled Python executable:', bundledPython);
      return bundledPython;
    } else {
      console.error('[ARGUS] ERROR: Bundled Python executable not found at:', bundledPython);
      console.error('[ARGUS] This is a packaging issue. The app will not work correctly.');
    }
  }

  // In development, use system Python
  console.log('[ARGUS] Development mode - using system Python');
  if (process.platform === 'darwin' || process.platform === 'linux') {
    return 'python3';
  }
  return 'python'; // Windows
}

// Ensure directories exist in app root
function ensureDirectories() {
  try {
    const appRoot = getAppRootDir();
    const templatesDir = path.join(appRoot, 'templates');
    const outputDir = path.join(appRoot, 'output');

    console.log('[ARGUS] App root directory:', appRoot);
    console.log('[ARGUS] Templates directory:', templatesDir);
    console.log('[ARGUS] Output directory:', outputDir);

    if (!fs.existsSync(outputDir)) {
      console.log('[ARGUS] Creating output directory...');
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Templates should already be in the unpacked directory, no need to copy
    if (!fs.existsSync(templatesDir)) {
      console.error('[ARGUS] ERROR: Templates directory not found at:', templatesDir);
      console.error('[ARGUS] This likely means the app was not packaged correctly.');
      console.error('[ARGUS] Check that asarUnpack includes "templates/**/*"');
    }
  } catch (error) {
    console.error('[ARGUS] Error setting up directories:', error);
    // Don't throw - let app continue and show error when user tries to use features
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

app.whenReady().then(() => {
  ensureDirectories();
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
    if (pythonPath.endsWith('ARGUS_core.exe')) {
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
    const isBundledExe = pythonPath.endsWith('ARGUS_core.exe');

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

    console.log('[ARGUS] Executing Python command:', command);
    console.log('[ARGUS] Spawn command:', spawnCommand);
    console.log('[ARGUS] Spawn args:', spawnArgs);
    console.log('[ARGUS] Working directory:', appRoot);

    const pythonProcess = spawn(spawnCommand, spawnArgs, {
      cwd: appRoot  // Set working directory to app root
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
