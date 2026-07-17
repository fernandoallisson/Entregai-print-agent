const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const UpdateService = require('../src/main/updateService');

class FakeUpdater extends EventEmitter {
  constructor() {
    super();
    this.checks = 0;
    this.quitAndInstallCalls = 0;
  }

  async checkForUpdates() {
    this.checks += 1;
    this.emit('checking-for-update');
    return { updateInfo: { version: '1.1.1' } };
  }

  quitAndInstall() {
    this.quitAndInstallCalls += 1;
  }
}

function createService({ packaged = true, environment = 'production' } = {}) {
  const updater = new FakeUpdater();
  const events = [];
  const states = [];
  const service = new UpdateService({
    app: { isPackaged: packaged, getVersion: () => '1.1.0' },
    environmentProvider: () => environment,
    notify: (state) => states.push(state),
    autoUpdater: updater,
    logger: {},
    logEvent: (name, details) => events.push({ name, details }),
    initialCheckDelayMs: 60 * 60 * 1000,
    checkIntervalMs: 60 * 60 * 1000,
  });
  return { events, service, states, updater };
}

test('não consulta atualizações fora do aplicativo empacotado em produção', async () => {
  const development = createService({ packaged: false });
  assert.equal(development.service.start(), false);
  await development.service.checkNow();
  assert.equal(development.updater.checks, 0);
  assert.equal(development.service.getStatus().status, 'disabled');
});

test('baixa em segundo plano e nunca reinicia automaticamente', async () => {
  const { service, updater } = createService();
  try {
    assert.equal(service.start(), true);
    assert.equal(updater.autoDownload, true);
    assert.equal(updater.autoInstallOnAppQuit, true);
    assert.equal(updater.allowDowngrade, false);

    updater.emit('update-available', { version: '1.1.1' });
    updater.emit('download-progress', { percent: 47.6 });
    assert.equal(service.getStatus().progress, 48);

    updater.emit('update-downloaded', { version: '1.1.1' });
    assert.equal(service.getStatus().ready, true);
    assert.equal(service.getStatus().availableVersion, '1.1.1');
    assert.equal(updater.quitAndInstallCalls, 0);
  } finally {
    service.stop();
  }
});

test('falha do atualizador mantém o serviço isolado e informa o erro', async () => {
  const { service, updater } = createService();
  try {
    service.start();
    updater.checkForUpdates = async () => { throw new Error('Falha de rede https://privado.exemplo/token'); };
    await service.checkNow();

    const status = service.getStatus();
    assert.equal(status.status, 'error');
    assert.match(status.message, /continuará funcionando/);
    assert.doesNotMatch(status.error, /https:\/\//);
  } finally {
    service.stop();
  }
});

