const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Settings file location (stored in user data directory, persists between runs)
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

/**
 * Load settings from disk
 * @returns {object} Settings object
 */
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Settings] Error loading settings:', error.message);
  }
  return null;
}

/**
 * Save settings to disk
 * @param {object} settings - Settings object to save
 */
function saveSettings(settings) {
  try {
    // Ensure user data directory exists
    const userDataDir = app.getPath('userData');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log('[Settings] Settings saved to:', settingsPath);
    return true;
  } catch (error) {
    console.error('[Settings] Error saving settings:', error.message);
    return false;
  }
}

/**
 * Get default settings based on exe location
 * @param {string} exeDir - Directory where exe is located (for reference only)
 * @returns {object} Default settings
 */
function getDefaultSettings(exeDir) {
  // Use user data directory instead of Program Files to avoid permission issues
  // Windows: C:\Users\<username>\AppData\Roaming\ARGUS
  // macOS: ~/Library/Application Support/ARGUS
  // Linux: ~/.config/ARGUS
  const userDataDir = app.getPath('userData');

  return {
    templatesDir: path.join(userDataDir, 'templates'),
    outputDir: path.join(userDataDir, 'output'),
    firstRun: false
  };
}

/**
 * Check if this is first run (no settings exist)
 * @returns {boolean}
 */
function isFirstRun() {
  const settings = loadSettings();
  return !settings || settings.firstRun !== false;
}

module.exports = {
  loadSettings,
  saveSettings,
  getDefaultSettings,
  isFirstRun,
  settingsPath
};
