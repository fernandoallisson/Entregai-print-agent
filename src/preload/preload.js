const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('entregaiAgent', {
  getStatus: () => ipcRenderer.invoke('agent:get-status'),
  pair: (pairingCode) => ipcRenderer.invoke('agent:pair', pairingCode),
  clear: () => ipcRenderer.invoke('agent:clear'),
  getPrintLayout: () => ipcRenderer.invoke('print-layout:get'),
  savePrintLayout: (config) => ipcRenderer.invoke('print-layout:save', config),
  resetPrintLayout: () => ipcRenderer.invoke('print-layout:reset'),
  exportPrintLayout: (config) => ipcRenderer.invoke('print-layout:export', config),
  importPrintLayout: () => ipcRenderer.invoke('print-layout:import'),
  previewPrintLayout: (profile, config) => ipcRenderer.invoke('print-layout:preview', profile, config),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('agent:status', listener);
    return () => ipcRenderer.removeListener('agent:status', listener);
  },
});
