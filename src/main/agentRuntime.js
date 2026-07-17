const os = require('os');
const WebSocket = require('ws');
const ApiClient = require('./apiClient');
const Ledger = require('./ledger');
const PrinterService = require('./printerService');
const { getConnectionSettings, getPrintTransport } = require('./config');
const { printerFingerprint } = require('./printerInventory');
const { event } = require('./logger');

const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const RECONCILIATION_INTERVAL_MS = 60 * 1000;
const PRINTER_SCAN_INTERVAL_MS = 60 * 1000;
const PRINTER_SAFETY_SYNC_MS = 15 * 60 * 1000;
const SESSION_RENEWAL_MS = 4 * 60 * 1000;
const RETRY_JOB_DELAY_MS = 3000;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

class AgentRuntime {
  constructor(store, mainWindowProvider, notifyStatus, dependencies = {}) {
    this.store = store;
    this.notifyStatus = notifyStatus;
    this.connectionSettings = this.store.readConnectionSettings?.() || getConnectionSettings();
    this.ledger = dependencies.ledger || new Ledger();
    this.api = dependencies.api || new ApiClient(() => this.credential?.token, this.connectionSettings);
    this.printerService = dependencies.printerService
      || new PrinterService(mainWindowProvider, () => this.store.readPrintLayout());
    this.running = false;
    this.credential = null;
    this.session = null;
    this.socket = null;
    this.socketConnected = false;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.timers = new Set();
    this.processingPromise = null;
    this.pendingJobIds = new Set();
    this.reconciliationRequested = false;
    this.retryNotBefore = new Map();
    this.lastPrinterFingerprint = null;
    this.lastPrinterSyncAt = 0;
    this.printerCount = 0;
    this.configuredTransport = getPrintTransport(this.connectionSettings);
    this.transport = this.configuredTransport;
  }

  status(extra = {}) {
    return {
      paired: Boolean(this.credential?.token),
      agent: this.credential?.agent || null,
      deviceId: this.store.getDeviceId(),
      deviceName: this.store.getDeviceName(),
      running: this.running,
      connected: this.socketConnected,
      transport: this.transport,
      connectionSettings: this.connectionSettings,
      printers: this.printerCount,
      ...extra,
    };
  }

  loadCredential() {
    this.credential = this.store.readCredential();
    return this.credential;
  }

  async pair(pairingCode) {
    const result = await this.api.pair({
      pairing_code: pairingCode,
      device_id: this.store.getDeviceId(),
      nome: this.store.getDeviceName(),
      platform: os.platform(),
      app_version: require('../../package.json').version,
    });
    if (result.environment && result.environment !== this.connectionSettings.environment) {
      this.connectionSettings = this.store.saveConnectionSettings({
        ...this.connectionSettings,
        environment: result.environment,
      });
    }
    this.store.saveCredential(result);
    this.credential = this.store.readCredential();
    event('AGENT_PAIRED', { agentId: result.agent?.id });
    this.start();
    return this.status();
  }

  clearCredential() {
    this.stop();
    this.store.clearCredential();
    this.credential = null;
    this.session = null;
    this.api.setSessionToken(null);
    event('AGENT_REVOKED');
    this.notifyStatus(this.status({ authFailed: true }));
  }

  updateConnectionSettings(settings) {
    const previous = this.connectionSettings;
    const next = this.store.saveConnectionSettings(settings);
    const environmentChanged = previous.environment !== next.environment;
    const hadCredential = Boolean(this.store.readCredential());

    this.stop();
    this.connectionSettings = next;
    this.configuredTransport = getPrintTransport(next);
    this.transport = this.configuredTransport;
    this.session = null;
    this.reconnectAttempt = 0;
    this.pendingJobIds.clear();
    this.reconciliationRequested = false;
    this.retryNotBefore.clear();
    this.api.configure?.(next);

    if (environmentChanged && hadCredential) {
      this.store.clearCredential();
      this.credential = null;
    }

    this.start();
    const status = this.status({
      connectionSaved: true,
      requiresRePairing: environmentChanged && hadCredential,
      lastError: null,
    });
    this.notifyStatus(status);
    return status;
  }

  start() {
    if (!this.loadCredential()) {
      this.notifyStatus(this.status());
      return;
    }
    if (this.running) return;
    this.running = true;
    event('AGENT_STARTED', { agentId: this.credential.agent?.id });
    void this.initialize();
  }

  stop() {
    this.running = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    for (const timer of this.timers) clearInterval(timer);
    this.timers.clear();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }
    this.socketConnected = false;
  }

  async initialize() {
    try {
      await this.refreshSession();
      await this.heartbeat();
      await this.syncPrintersIfNeeded(true);
      if (!this.running) return;
      this.startTimers();

      if (this.shouldUseWebSocket()) this.connectWebSocket();
      else this.requestReconciliation();
    } catch (error) {
      this.handleRuntimeError(error);
      if (this.running) this.scheduleReconnect();
    }
  }

  shouldUseWebSocket() {
    if (this.transport === 'polling') return false;
    return this.session?.transport === 'websocket';
  }

  startTimers() {
    if (this.timers.size) return;
    this.addInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL_MS);
    this.addInterval(() => this.syncPrintersIfNeeded(false), PRINTER_SCAN_INTERVAL_MS);
    this.addInterval(() => this.requestReconciliation(), RECONCILIATION_INTERVAL_MS);
    this.addInterval(() => this.renewSession(), SESSION_RENEWAL_MS);
  }

  addInterval(callback, intervalMs) {
    const timer = setInterval(() => {
      if (!this.running) return;
      Promise.resolve(callback()).catch((error) => this.handleRuntimeError(error));
    }, intervalMs);
    timer.unref?.();
    this.timers.add(timer);
  }

  async refreshSession() {
    try {
      const session = await this.api.createSession();
      this.session = session;
      this.api.setSessionToken(session.access_token);
      this.transport = this.configuredTransport === 'auto'
        ? (session.transport || 'polling')
        : this.configuredTransport;
      return session;
    } catch (error) {
      if (error.status === 404 || error.status === 405) {
        this.session = { transport: 'polling' };
        this.api.setSessionToken(null);
        if (this.configuredTransport === 'auto') this.transport = 'polling';
        event('LEGACY_BACKEND_FALLBACK');
        return this.session;
      }
      throw error;
    }
  }

  async renewSession() {
    const previousTransport = this.session?.transport;
    await this.refreshSession();
    if (this.socketConnected && this.socket?.readyState === WebSocket.OPEN && this.session?.access_token) {
      this.socket.send(JSON.stringify({ type: 'AUTH_REFRESH', access_token: this.session.access_token }));
    } else if (this.shouldUseWebSocket() && previousTransport !== 'websocket') {
      this.connectWebSocket();
    }
  }

  async heartbeat() {
    await this.withSessionRetry(() => this.api.heartbeat({
      app_version: require('../../package.json').version,
      platform: os.platform(),
    }));
    event('BACKEND_CONNECTED', { agentId: this.credential.agent?.id });
    this.notifyStatus(this.status({ lastSeenAt: new Date().toISOString(), lastError: null }));
  }

  async syncPrintersIfNeeded(force = false) {
    const printers = await this.printerService.listPrinters();
    const fingerprint = printerFingerprint(printers);
    const safetyDue = Date.now() - this.lastPrinterSyncAt >= PRINTER_SAFETY_SYNC_MS;
    this.printerCount = printers.length;
    if (!force && fingerprint === this.lastPrinterFingerprint && !safetyDue) return false;

    await this.withSessionRetry(() => this.api.syncPrinters(printers));
    this.lastPrinterFingerprint = fingerprint;
    this.lastPrinterSyncAt = Date.now();
    event('PRINTERS_SYNCED', { count: printers.length, changed: !force });
    this.notifyStatus(this.status());
    return true;
  }

  connectWebSocket() {
    if (!this.running || !this.shouldUseWebSocket() || !this.session?.access_token) return;
    if (this.socket && [WebSocket.CONNECTING, WebSocket.OPEN].includes(this.socket.readyState)) return;

    const socket = new WebSocket(this.api.getWebSocketUrl(), {
      headers: { Authorization: `Bearer ${this.session.access_token}` },
      handshakeTimeout: 15000,
      maxPayload: 4096,
    });
    this.socket = socket;

    socket.on('open', () => {
      this.socketConnected = true;
      this.reconnectAttempt = 0;
      event('WEBSOCKET_CONNECTED', { agentId: this.credential.agent?.id });
      this.notifyStatus(this.status({ lastError: null }));
    });
    socket.on('message', (raw) => this.handleSocketMessage(raw));
    socket.on('close', (code) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.socketConnected = false;
      event('WEBSOCKET_DISCONNECTED', { code });
      this.notifyStatus(this.status({ lastError: 'Canal de impressão desconectado; tentando reconectar.' }));
      if (this.running) this.scheduleReconnect();
    });
    socket.on('error', (error) => {
      event('WEBSOCKET_ERROR', { message: error.message });
    });
  }

  handleSocketMessage(raw) {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      event('WEBSOCKET_INVALID_MESSAGE');
      return;
    }
    if (message.type === 'READY') {
      this.requestReconciliation();
      return;
    }
    if (message.type === 'PRINT_JOB_AVAILABLE' && message.print_job_id) {
      this.requestJob(message.print_job_id);
    }
  }

  scheduleReconnect() {
    if (!this.running || this.reconnectTimer || !this.shouldUseWebSocket()) return;
    const baseDelay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt += 1;
    if (this.reconnectAttempt >= 3) this.requestReconciliation();
    const jitter = 0.8 + Math.random() * 0.4;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.refreshSession();
        this.connectWebSocket();
      } catch (error) {
        this.handleRuntimeError(error);
        this.scheduleReconnect();
      }
    }, Math.round(baseDelay * jitter));
  }

  requestJob(jobId) {
    this.pendingJobIds.add(jobId);
    void this.drainJobs();
  }

  requestReconciliation() {
    this.reconciliationRequested = true;
    void this.drainJobs();
  }

  async drainJobs() {
    if (this.processingPromise) return this.processingPromise;
    this.processingPromise = (async () => {
      while (this.running && (this.pendingJobIds.size || this.reconciliationRequested)) {
        let jobId = this.pendingJobIds.values().next().value || null;
        if (jobId) {
          this.pendingJobIds.delete(jobId);
          const notBefore = this.retryNotBefore.get(jobId) || 0;
          if (notBefore > Date.now()) {
            this.scheduleJobRetry(jobId, notBefore - Date.now());
            continue;
          }
        } else {
          this.reconciliationRequested = false;
        }

        const limit = jobId ? 1 : 2;
        const jobs = await this.withSessionRetry(() => this.api.claimJobs(limit, jobId));
        for (const job of jobs) await this.processJob(job);
        if (!jobId && jobs.length >= limit) this.reconciliationRequested = true;
      }
    })().catch((error) => this.handleRuntimeError(error)).finally(() => {
      this.processingPromise = null;
      if (this.running && (this.pendingJobIds.size || this.reconciliationRequested)) void this.drainJobs();
    });
    return this.processingPromise;
  }

  async processJob(job) {
    if (this.ledger.has(job.id)) {
      event('PRINT_JOB_ALREADY_IN_LEDGER', { jobId: job.id });
      await this.withSessionRetry(() => this.api.success(job.id, { ledger_key: job.id }));
      return;
    }

    try {
      event('PRINT_JOB_CLAIMED', { jobId: job.id, printerId: job.printer_id });
      event('PRINT_STARTED', { jobId: job.id, printerId: job.printer_id });
      await this.printerService.print(job);
      this.ledger.add(job.id);
      await this.withSessionRetry(() => this.api.success(job.id, { ledger_key: job.id }));
      this.retryNotBefore.delete(job.id);
      event('PRINT_SUCCESS', { jobId: job.id, printerId: job.printer_id });
    } catch (error) {
      const code = error.code || 'PRINT_FAILED';
      const retryable = code !== 'PRINTER_NOT_FOUND';
      if (retryable) this.retryNotBefore.set(job.id, Date.now() + RETRY_JOB_DELAY_MS);
      await this.withSessionRetry(() => this.api.failure(job.id, {
        error_code: code,
        error_message: error.message || 'Falha ao imprimir',
        retryable,
      }));
      if (retryable) this.scheduleJobRetry(job.id, RETRY_JOB_DELAY_MS);
      event('PRINT_FAILED', { jobId: job.id, printerId: job.printer_id, errorCode: code });
    }
  }

  scheduleJobRetry(jobId, delayMs) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (this.running) this.requestJob(jobId);
    }, Math.max(1, delayMs));
    timer.unref?.();
    this.timers.add(timer);
  }

  async withSessionRetry(operation) {
    try {
      return await operation();
    } catch (error) {
      if (error.status !== 401 && error.status !== 403) throw error;
      try {
        await this.refreshSession();
        return await operation();
      } catch (refreshError) {
        if (refreshError.status === 401 || refreshError.status === 403) this.clearCredential();
        throw refreshError;
      }
    }
  }

  handleRuntimeError(error) {
    if (!error) return;
    if (error.status === 401 || error.status === 403) {
      event('AGENT_AUTH_FAILED');
      this.clearCredential();
      return;
    }
    event('BACKEND_DISCONNECTED', { message: error.message });
    this.notifyStatus(this.status({ lastError: error.message }));
  }
}

module.exports = AgentRuntime;
