const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('argus', {
  // File operations
  selectFile: (options) => ipcRenderer.invoke('select-file', options),
  saveDialog: (options) => ipcRenderer.invoke('save-dialog', options),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  
  // Template operations
  listTemplates: () => ipcRenderer.invoke('list-templates'),
  createTemplate: (args) => ipcRenderer.invoke('create-template', args),
  
  // Compression operations
  compressImage: (args) => ipcRenderer.invoke('compress-image', args),
  decompressMessage: (args) => ipcRenderer.invoke('decompress-message', args),
  saveTempMessage: (text) => ipcRenderer.invoke('save-temp-message', text),
  
  // Utilities
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path')
});

console.log('Preload script loaded - argus API exposed');
