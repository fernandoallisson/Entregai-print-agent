const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('entregaiAgent', {
  getStatus: () => ipcRenderer.invoke('agent:get-status'),
  pair: (pairingCode) => ipcRenderer.invoke('agent:pair', pairingCode),
  clear: () => ipcRenderer.invoke('agent:clear'),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('agent:status', listener);
    return () => ipcRenderer.removeListener('agent:status', listener);
  },
});
