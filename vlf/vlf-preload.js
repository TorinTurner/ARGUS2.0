const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, data) => {
    const validChannels = [
      'select-file',
      'read-file',
      'vlf-compress',
      'vlf-decompress',
      'save-vlf-file',
      'copy-to-clipboard',
      'show-item-in-folder'
    ];

    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
  },

  send: (channel, data) => {
    const validChannels = [];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  on: (channel, func) => {
    const validChannels = [];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});
