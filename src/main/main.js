const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const SecureStore = require('./secureStore');
const { loadEnvFiles } = require('./envLoader');
const AgentRuntime = require('./agentRuntime');

let mainWindow;
let runtime;

function sendStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent:status', status);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 680,
    minWidth: 760,
    minHeight: 560,
    title: 'Entregaí Print Agent',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  loadEnvFiles();
  const store = new SecureStore();
  createWindow();
  runtime = new AgentRuntime(store, () => mainWindow, sendStatus);
  runtime.start();

  ipcMain.handle('agent:get-status', () => runtime.status());
  ipcMain.handle('agent:pair', async (event, pairingCode) => runtime.pair(pairingCode));
  ipcMain.handle('agent:clear', () => {
    runtime.clearCredential();
    return runtime.status();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  runtime?.stop();
});
