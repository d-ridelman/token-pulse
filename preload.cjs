const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pulse', {
  snapshot: () => ipcRenderer.invoke('pulse:snapshot'),
  share: (id, language) => ipcRenderer.invoke('pulse:share', id, language),
  onUpdate: (callback) => ipcRenderer.on('pulse:update', (_event, data) => callback(data)),
});
