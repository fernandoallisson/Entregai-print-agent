const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog, Menu, Tray } = require('electron');
const SecureStore = require('./secureStore');
const { loadEnvFiles } = require('./envLoader');
const AgentRuntime = require('./agentRuntime');
const UpdateService = require('./updateService');
const { renderJob } = require('./templateRenderer');
const { normalizePrintLayoutConfig } = require('./printLayoutConfig');

let mainWindow;
let runtime;
let updateService;
let tray;
let isQuitting = false;
let closePromptOpen = false;

function sendStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent:status', status);
  }
}

function sendUpdateStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:status', status);
  }
}

function sharedLayoutFileName() {
  const date = new Date().toISOString().slice(0, 10);
  return `entregai-layout-impressao-${date}.json`;
}

function appIconPath() {
  return path.join(app.getAppPath(), 'build/icon.ico');
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function createTray() {
  if (tray) return;
  tray = new Tray(appIconPath());
  tray.setToolTip('Entregaí Print Agent');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Entregaí Print Agent', click: showMainWindow },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));
  tray.on('click', showMainWindow);
  tray.on('double-click', showMainWindow);
}

function setStartWithWindows(enabled) {
  if (process.platform !== 'win32') return;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
  });
}

async function askStartWithWindows(store) {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  const config = store.readConfig();
  if (config.startWithWindowsPrompted) return;

  const response = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Iniciar com o Windows',
    message: 'Deseja iniciar o Entregaí Print Agent junto com o Windows?',
    detail: 'Isso mantém o agente disponível para impressão silenciosa depois que o computador ligar.',
    buttons: ['Sim, iniciar com o Windows', 'Não'],
    defaultId: 0,
    cancelId: 1,
  });

  const enabled = response.response === 0;
  setStartWithWindows(enabled);
  store.updateConfig({
    startWithWindowsPrompted: true,
    startWithWindows: enabled,
  });
}

async function askCloseAction(event) {
  if (isQuitting) return;
  event.preventDefault();
  if (closePromptOpen) return;

  closePromptOpen = true;
  try {
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Fechar Entregaí Print Agent',
      message: 'O que deseja fazer com o agente de impressão?',
      detail: 'Minimizar mantém o agente rodando em segundo plano para continuar recebendo impressões.',
      buttons: ['Minimizar', 'Sair', 'Cancelar'],
      defaultId: 0,
      cancelId: 2,
    });

    if (response.response === 0) {
      createTray();
      mainWindow.hide();
      return;
    }

    if (response.response === 1) {
      isQuitting = true;
      app.quit();
    }
  } finally {
    closePromptOpen = false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 680,
    minWidth: 760,
    minHeight: 560,
    title: 'Entregaí Print Agent',
    icon: appIconPath(),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.on('close', askCloseAction);
}

function previewJob(profile) {
  const documentType = profile === 'kitchen' ? 'ORDER_KITCHEN' : 'ORDER_CUSTOMER';
  return {
    id: 'preview',
    document_type: documentType,
    payload: {
      documentType,
      store: {
        nome: 'Mercado Entregaí',
        razaoSocial: 'Mercado Entregaí LTDA',
        cnpj: '12.345.678/0001-90',
        telefone: '(81) 99999-0000',
        email: 'contato@entregai.com.br',
      },
      order: {
        numeroPedido: 'PED-1024',
        numeroComandaCodigo: '00042',
        clienteNome: 'Maria Silva',
        clienteTelefone: '(81) 98888-7777',
        clienteDocumento: '123.456.789-00',
        tipoPedidoLabel: 'Entrega',
        enderecoDestaque: {
          linha: 'Rua das Flores, 120',
          bairro: 'Centro',
          completo: 'Rua das Flores, 120, Casa 2',
          referencia: 'Próximo à praça',
        },
      },
      items: [
        {
          quantidade: 2,
          nomeProduto: 'X-Burger Artesanal',
          nomeVariacao: 'Grande',
          precoTotal: 39.8,
          observacoes: 'Sem cebola, maionese à parte',
          selecoes: [
            { nomeGrupo: 'Adicional', nomeOpcao: 'Bacon', quantidade: 1 },
            { nomeGrupo: 'Bebida', nomeOpcao: 'Refrigerante lata', quantidade: 2 },
          ],
        },
        {
          quantidade: 1,
          nomeProduto: 'Batata Frita',
          precoTotal: 14.9,
          observacoes: 'Bem crocante',
        },
      ],
      totals: {
        subtotal: 54.7,
        taxaEntrega: 5,
        desconto: 0,
        total: 59.7,
      },
      payment: {
        formaPagamentoLabel: 'Dinheiro',
        statusLabel: 'Pendente',
        pago: false,
        pagoLabel: 'PAGAMENTO PENDENTE',
        troco: { linhas: ['Troco para R$ 100,00'] },
      },
    },
  };
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on('second-instance', showMainWindow);

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return;
  loadEnvFiles();
  const store = new SecureStore();
  createWindow();
  createTray();
  runtime = new AgentRuntime(store, () => mainWindow, sendStatus);
  runtime.start();
  updateService = new UpdateService({
    app,
    environmentProvider: () => store.readConnectionSettings().environment,
    notify: sendUpdateStatus,
  });
  updateService.start();
  mainWindow.webContents.once('did-finish-load', () => {
    askStartWithWindows(store);
  });

  ipcMain.handle('agent:get-status', () => runtime.status());
  ipcMain.handle('agent:pair', async (_event, pairingCode) => {
    const status = await runtime.pair(pairingCode);
    updateService.refreshEligibility();
    return status;
  });
  ipcMain.handle('agent:clear', () => {
    runtime.clearCredential();
    return runtime.status();
  });
  ipcMain.handle('connection-settings:get', () => store.readConnectionSettings());
  ipcMain.handle('connection-settings:save', (_event, settings) => {
    const status = runtime.updateConnectionSettings(settings);
    updateService.refreshEligibility();
    return status;
  });
  ipcMain.handle('update:get-status', () => updateService.getStatus());
  ipcMain.handle('print-layout:get', () => store.readPrintLayout());
  ipcMain.handle('print-layout:save', (_event, config) => store.savePrintLayout(config));
  ipcMain.handle('print-layout:reset', () => store.resetPrintLayout());
  ipcMain.handle('print-layout:preview', (_event, profile, config) => renderJob(previewJob(profile), config || store.readPrintLayout()));
  ipcMain.handle('print-layout:export', async (_event, config) => {
    const normalized = normalizePrintLayoutConfig(config || store.readPrintLayout());
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Baixar layout salvo',
      defaultPath: sharedLayoutFileName(),
      filters: [{ name: 'Layout de impressão Entregaí', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true, layout: normalized };
    fs.writeFileSync(result.filePath, JSON.stringify(normalized, null, 2), { mode: 0o600 });
    return { canceled: false, filePath: result.filePath, layout: normalized };
  });
  ipcMain.handle('print-layout:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Usar layout compartilhado',
      properties: ['openFile'],
      filters: [{ name: 'Layout de impressão Entregaí', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths?.[0]) return { canceled: true, layout: store.readPrintLayout() };

    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
    } catch {
      throw new Error('Arquivo de layout inválido.');
    }

    const normalized = store.savePrintLayout(parsed);
    return { canceled: false, filePath: result.filePaths[0], layout: normalized };
  });
});

app.on('window-all-closed', () => {
  if (isQuitting && process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  runtime?.stop();
  updateService?.stop();
});

app.on('activate', showMainWindow);
