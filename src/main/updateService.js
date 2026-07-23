const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INITIAL_CHECK_DELAY_MS = 15 * 1000;
const INSTALL_IDLE_MS = 60 * 1000;
const INSTALL_CHECK_INTERVAL_MS = 5 * 1000;

function safeErrorMessage(error) {
  return String(error?.message || 'Falha desconhecida ao verificar atualizações')
    .replace(/https?:\/\/\S+/gi, '[endereço removido]')
    .slice(0, 500);
}

class UpdateService {
  constructor({
    app,
    environmentProvider,
    notify = () => undefined,
    autoUpdater = null,
    logger = null,
    logEvent = null,
    idleProvider = () => true,
    beforeInstall = () => undefined,
    initialCheckDelayMs = INITIAL_CHECK_DELAY_MS,
    checkIntervalMs = CHECK_INTERVAL_MS,
    installIdleMs = INSTALL_IDLE_MS,
    installCheckIntervalMs = INSTALL_CHECK_INTERVAL_MS,
  }) {
    this.app = app;
    this.environmentProvider = environmentProvider;
    this.notify = notify;
    this.autoUpdater = autoUpdater;
    this.logger = logger;
    this.logEvent = logEvent;
    this.idleProvider = idleProvider;
    this.beforeInstall = beforeInstall;
    this.initialCheckDelayMs = initialCheckDelayMs;
    this.checkIntervalMs = checkIntervalMs;
    this.installIdleMs = installIdleMs;
    this.installCheckIntervalMs = installCheckIntervalMs;
    this.active = false;
    this.listenersAttached = false;
    this.initialTimer = null;
    this.intervalTimer = null;
    this.installTimer = null;
    this.idleSince = null;
    this.checkPromise = null;
    this.lastProgressBucket = -1;
    this.state = {
      currentVersion: this.app.getVersion(),
      status: 'idle',
      message: 'Atualizações automáticas aguardando inicialização.',
      progress: null,
      availableVersion: null,
      ready: false,
      error: null,
    };
  }

  isEligible() {
    return Boolean(this.app.isPackaged && this.environmentProvider?.() === 'production');
  }

  getStatus() {
    return { ...this.state };
  }

  publish(patch) {
    this.state = { ...this.state, ...patch };
    this.notify(this.getStatus());
  }

  dependencies() {
    if (!this.autoUpdater) this.autoUpdater = require('electron-updater').autoUpdater;
    if (!this.logger || !this.logEvent) {
      const { event, log } = require('./logger');
      this.logger ||= log;
      this.logEvent ||= event;
    }
  }

  configureUpdater() {
    this.dependencies();
    this.autoUpdater.logger = this.logger;
    this.autoUpdater.autoDownload = true;
    this.autoUpdater.autoInstallOnAppQuit = true;
    this.autoUpdater.allowDowngrade = false;
  }

  attachListeners() {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

    this.autoUpdater.on('checking-for-update', () => {
      this.logEvent('UPDATE_CHECKING', { currentVersion: this.app.getVersion() });
      this.publish({
        status: 'checking',
        message: 'Verificando atualizações...',
        progress: null,
        error: null,
      });
    });

    this.autoUpdater.on('update-available', (info = {}) => {
      this.logEvent('UPDATE_AVAILABLE', { version: info.version });
      this.publish({
        status: 'available',
        message: `Atualização ${info.version || ''} disponível. Baixando em segundo plano...`.replace('  ', ' '),
        availableVersion: info.version || null,
        progress: 0,
        ready: false,
        error: null,
      });
    });

    this.autoUpdater.on('update-not-available', () => {
      this.logEvent('UPDATE_NOT_AVAILABLE', { currentVersion: this.app.getVersion() });
      this.publish({
        status: 'up-to-date',
        message: 'O aplicativo está atualizado.',
        progress: null,
        availableVersion: null,
        ready: false,
        error: null,
      });
    });

    this.autoUpdater.on('download-progress', (progress = {}) => {
      const percent = Math.max(0, Math.min(100, Math.round(Number(progress.percent) || 0)));
      const bucket = Math.floor(percent / 10);
      if (bucket !== this.lastProgressBucket) {
        this.lastProgressBucket = bucket;
        this.logEvent('UPDATE_DOWNLOAD_PROGRESS', { percent });
      }
      this.publish({
        status: 'downloading',
        message: `Baixando atualização: ${percent}%`,
        progress: percent,
        error: null,
      });
    });

    this.autoUpdater.on('update-downloaded', (info = {}) => {
      this.logEvent('UPDATE_DOWNLOADED', { version: info.version });
      this.publish({
        status: 'downloaded',
        message: 'Atualização pronta. O agente reiniciará quando não houver impressão em andamento.',
        availableVersion: info.version || this.state.availableVersion,
        progress: 100,
        ready: true,
        error: null,
      });
      this.scheduleAutomaticInstall();
    });

    this.autoUpdater.on('error', (error) => this.handleError(error));
  }

  handleError(error) {
    const message = safeErrorMessage(error);
    this.logEvent?.('UPDATE_ERROR', { message });
    this.publish({
      status: 'error',
      message: 'Não foi possível atualizar agora. O agente continuará funcionando normalmente.',
      progress: null,
      error: message,
    });
  }

  start() {
    if (!this.isEligible()) {
      this.stopTimers();
      this.active = false;
      this.publish({
        status: 'disabled',
        message: this.app.isPackaged
          ? 'Atualizações automáticas disponíveis somente no ambiente de produção.'
          : 'Atualizações automáticas desativadas no modo de desenvolvimento.',
        progress: null,
        ready: false,
        error: null,
      });
      return false;
    }
    if (this.active) return true;

    this.configureUpdater();
    this.attachListeners();
    this.active = true;
    this.publish({
      status: 'idle',
      message: 'Atualizações automáticas ativadas.',
      error: null,
    });

    this.initialTimer = setTimeout(() => void this.checkNow(), this.initialCheckDelayMs);
    this.initialTimer.unref?.();
    this.intervalTimer = setInterval(() => void this.checkNow(), this.checkIntervalMs);
    this.intervalTimer.unref?.();
    return true;
  }

  refreshEligibility() {
    if (!this.isEligible()) {
      this.stopTimers();
      this.active = false;
    }
    return this.start();
  }

  async checkNow() {
    if (!this.active || !this.isEligible()) return null;
    if (this.checkPromise) return this.checkPromise;

    this.checkPromise = Promise.resolve(this.autoUpdater.checkForUpdates())
      .catch((error) => {
        this.handleError(error);
        return null;
      })
      .finally(() => {
        this.checkPromise = null;
      });
    return this.checkPromise;
  }

  scheduleAutomaticInstall() {
    if (this.installTimer) return;
    this.idleSince = null;
    this.installTimer = setInterval(
      () => this.checkAutomaticInstall(),
      this.installCheckIntervalMs,
    );
    this.installTimer.unref?.();
  }

  checkAutomaticInstall(now = Date.now()) {
    if (!this.active || !this.state.ready) return false;
    if (!this.idleProvider()) {
      this.idleSince = null;
      return false;
    }

    if (this.idleSince === null) {
      this.idleSince = now;
      return false;
    }
    if (now - this.idleSince < this.installIdleMs) return false;

    if (this.installTimer) clearInterval(this.installTimer);
    this.installTimer = null;
    this.logEvent?.('UPDATE_INSTALLING', { version: this.state.availableVersion });
    this.publish({
      status: 'installing',
      message: 'Instalando atualização e reiniciando o agente...',
      progress: 100,
    });
    this.beforeInstall();
    this.autoUpdater.quitAndInstall(false, true);
    return true;
  }

  stopTimers() {
    if (this.initialTimer) clearTimeout(this.initialTimer);
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    if (this.installTimer) clearInterval(this.installTimer);
    this.initialTimer = null;
    this.intervalTimer = null;
    this.installTimer = null;
    this.idleSince = null;
  }

  stop() {
    this.active = false;
    this.stopTimers();
  }
}

module.exports = UpdateService;
module.exports.safeErrorMessage = safeErrorMessage;
