const os = require('os');
const ApiClient = require('./apiClient');
const Ledger = require('./ledger');
const PrintRealtimeClient = require('./printRealtimeClient');
const PrinterService = require('./printerService');
const { getConnectionSettings, getPrintTransport } = require('./config');
const { printerFingerprint } = require('./printerInventory');
const { event } = require('./logger');

const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const RECONCILIATION_INTERVAL_MS = 3 * 60 * 1000;
const MIN_LOCAL_RECONCILIATION_INTERVAL_MS = 3 * 1000;
const PRINTER_SCAN_INTERVAL_MS = 60 * 1000;
const PRINTER_SAFETY_SYNC_MS = 15 * 60 * 1000;
const SESSION_RENEWAL_MS = 4 * 60 * 1000;
const RETRY_JOB_DELAY_MS = 3000;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

function resolveReconciliationIntervalMs({ isPackaged = true, value } = {}) {
  if (isPackaged) return RECONCILIATION_INTERVAL_MS;
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isInteger(parsed) || parsed < MIN_LOCAL_RECONCILIATION_INTERVAL_MS) {
    return RECONCILIATION_INTERVAL_MS;
  }
  return parsed;
}

class AgentRuntime {
  constructor(store, mainWindowProvider, notifyStatus, dependencies = {}) {
    this.store = store;
    this.notifyStatus = notifyStatus;
    this.connectionSettings = this.store.readConnectionSettings?.() || getConnectionSettings();
    this.ledger = dependencies.ledger || new Ledger();
    this.api = dependencies.api || new ApiClient(() => this.credential?.token, this.connectionSettings);
    this.realtime = dependencies.realtime || new PrintRealtimeClient(this.store, {
      onEvent: (message) => this.handleRealtimeMessage(message),
      onStatus: (status) => this.handleRealtimeStatus(status),
    });
    this.printerService = dependencies.printerService
      || new PrinterService(mainWindowProvider, () => this.store.readPrintLayout());
    this.running = false;
    this.credential = null;
    this.session = null;
    this.realtimeConnected = false;
    this.realtimeConnectPromise = null;
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
    this.reconciliationIntervalMs = dependencies.reconciliationIntervalMs
      || RECONCILIATION_INTERVAL_MS;
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
      connected: this.realtimeConnected,
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
    void this.realtime.disconnect();
    this.realtimeConnected = false;
    this.realtimeConnectPromise = null;
  }

  async initialize() {
    try {
      await this.refreshSession();
      await this.heartbeat();
      await this.syncPrintersIfNeeded(true);
      if (!this.running) return;
      this.startTimers();

      this.requestReconciliation();
      if (this.shouldUseRealtime()) void this.connectRealtime();
    } catch (error) {
      this.handleRuntimeError(error);
      if (this.running) this.scheduleReconnect();
    }
  }

  shouldUseRealtime() {
    if (this.transport === 'polling') return false;
    return this.session?.transport === 'supabase_realtime';
  }

  startTimers() {
    if (this.timers.size) return;
    this.addInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL_MS);
    this.addInterval(() => this.syncPrintersIfNeeded(false), PRINTER_SCAN_INTERVAL_MS);
    this.addInterval(() => this.requestReconciliation(), this.reconciliationIntervalMs);
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
    const previouslyRealtime = this.shouldUseRealtime();
    await this.refreshSession();
    if (!this.shouldUseRealtime() && previouslyRealtime) {
      await this.realtime.disconnect();
      this.realtimeConnected = false;
      this.requestReconciliation();
    } else if (this.shouldUseRealtime() && !this.realtimeConnected) {
      void this.connectRealtime();
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

  async connectRealtime() {
    if (!this.running || !this.shouldUseRealtime() || this.realtimeConnectPromise) {
      return this.realtimeConnectPromise;
    }

    this.realtimeConnectPromise = (async () => {
      const publicConfig = this.session?.realtime || {};
      let connected = await this.realtime.connect(publicConfig);
      if (!connected) {
        const credentials = await this.api.createRealtimeSession();
        connected = await this.realtime.connect({ ...publicConfig, ...credentials });
      }
      if (connected) {
        this.reconnectAttempt = 0;
        event('SUPABASE_REALTIME_CONNECTED', { agentId: this.credential.agent?.id });
        this.requestReconciliation();
      }
      return connected;
    })().catch((error) => {
      event('SUPABASE_REALTIME_ERROR', { message: error.message });
      this.realtimeConnected = false;
      this.requestReconciliation();
      this.notifyStatus(this.status({
        lastError: 'Tempo real indisponível; usando polling de contingência.',
      }));
      if (this.running) this.scheduleReconnect();
      return false;
    }).finally(() => {
      this.realtimeConnectPromise = null;
    });

    return this.realtimeConnectPromise;
  }

  handleRealtimeStatus(status = {}) {
    this.realtimeConnected = Boolean(status.connected);
    if (this.realtimeConnected) {
      this.notifyStatus(this.status({ lastError: null }));
      return;
    }
    if (this.running && this.shouldUseRealtime() && status.status !== 'CLOSED') {
      this.notifyStatus(this.status({
        lastError: 'Tempo real indisponível; usando polling de contingência.',
      }));
      this.scheduleReconnect();
    }
  }

  handleRealtimeMessage(message = {}) {
    if (message.type === 'PRINT_JOB_AVAILABLE' && message.print_job_id) {
      this.requestJob(message.print_job_id);
      return;
    }
    if (message.type === 'PRINT_AGENT_REVOKED') {
      event('AGENT_REVOKED_BY_REALTIME');
      this.clearCredential();
    }
  }

  scheduleReconnect() {
    if (!this.running || this.reconnectTimer) return;
    const baseDelay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt += 1;
    if (this.reconnectAttempt >= 3) this.requestReconciliation();
    const jitter = 0.8 + Math.random() * 0.4;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.refreshSession();
        this.requestReconciliation();
        if (this.shouldUseRealtime()) await this.connectRealtime();
      } catch (error) {
        this.handleRuntimeError(error);
        this.scheduleReconnect();
      }
    }, Math.round(baseDelay * jitter));
    this.reconnectTimer.unref?.();
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

  isIdleForUpdate() {
    return !this.processingPromise
      && this.pendingJobIds.size === 0
      && !this.reconciliationRequested
      && this.retryNotBefore.size === 0;
  }
}

module.exports = AgentRuntime;
module.exports.RECONCILIATION_INTERVAL_MS = RECONCILIATION_INTERVAL_MS;
module.exports.resolveReconciliationIntervalMs = resolveReconciliationIntervalMs;
