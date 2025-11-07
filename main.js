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
      // macOS: Go up from Resources/app to the .app directory
      return path.join(path.dirname(app.getPath('exe')), '..');
    } else {
      // Windows/Linux: Use the directory containing the executable
      return path.dirname(app.getPath('exe'));
    }
  } else {
    // In development, use the project directory
    return __dirname;
  }
}

// Python executable path
function getPythonPath() {
  // Always use system Python (works in dev and production)
  if (process.platform === 'darwin' || process.platform === 'linux') {
    return 'python3';
  }
  return 'python'; // Windows
}

// Ensure directories exist in app root
function ensureDirectories() {
  const appRoot = getAppRootDir();
  const templatesDir = path.join(appRoot, 'templates');
  const outputDir = path.join(appRoot, 'output');
  
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Copy example templates if none exist
  const exampleTemplates = path.join(__dirname, 'templates');
  if (fs.existsSync(exampleTemplates) && fs.readdirSync(templatesDir).length === 0) {
    copyDir(exampleTemplates, templatesDir);
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
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

  // Open DevTools in development only
  if (!app.isPackaged && process.env.NODE_ENV !== 'production') {
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

// Execute Python command
function executePython(command, args) {
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath();
    const scriptPath = path.join(__dirname, 'python', 'ARGUS_core.py');
    
    // Set working directory to app root so Python finds templates there
    const pythonArgs = [scriptPath, command, ...args];
    const pythonProcess = spawn(pythonPath, pythonArgs, {
      cwd: getAppRootDir()  // Set working directory to app root
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
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
          resolve(result);
        }
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
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
  shell.showItemInFolder(filePath);
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
