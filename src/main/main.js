const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const SecureStore = require('./secureStore');
const { loadEnvFiles } = require('./envLoader');
const AgentRuntime = require('./agentRuntime');
const { renderJob } = require('./templateRenderer');

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
    icon: path.join(app.getAppPath(), 'build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
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
  ipcMain.handle('print-layout:get', () => store.readPrintLayout());
  ipcMain.handle('print-layout:save', (_event, config) => store.savePrintLayout(config));
  ipcMain.handle('print-layout:reset', () => store.resetPrintLayout());
  ipcMain.handle('print-layout:preview', (_event, profile, config) => renderJob(previewJob(profile), config || store.readPrintLayout()));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  runtime?.stop();
});
