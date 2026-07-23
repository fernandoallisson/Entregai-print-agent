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
const RESUME_RETRY_MS = 60 * 1000;
const MAX_LOCAL_OVERRIDE_MS = 24 * 60 * 60 * 1000;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

const RUNTIME_STATES = Object.freeze({
  STOPPED: 'stopped',
  STARTING: 'starting',
  ACTIVE: 'active',
  SUSPENDING: 'suspending',
  SUSPENDED_SCHEDULE: 'suspended_schedule',
  SUSPENDED_INACTIVE: 'suspended_inactive',
});

function resolveReconciliationIntervalMs({ isPackaged = true, value } = {}) {
  if (isPackaged) return RECONCILIATION_INTERVAL_MS;
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isInteger(parsed) || parsed < MIN_LOCAL_RECONCILIATION_INTERVAL_MS) {
    return RECONCILIATION_INTERVAL_MS;
  }
  return parsed;
}

function futureTimestamp(value, now = Date.now()) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) && timestamp > now ? timestamp : null;
}

function formatDateTime(value) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(timestamp));
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
    this.runtimeState = RUNTIME_STATES.STOPPED;
    this.credential = null;
    this.session = null;
    this.operational = null;
    this.suspensionReason = null;
    this.nextResumeAt = null;
    this.forceActiveUntil = null;
    this.lastSeenAt = null;
    this.realtimeConnected = false;
    this.realtimeConnectPromise = null;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.resumeTimer = null;
    this.boundaryTimer = null;
    this.timers = new Set();
    this.intervalTimers = new Set();
    this.processingPromise = null;
    this.initializationPromise = null;
    this.suspensionPromise = null;
    this.resumePromise = null;
    this.currentJobId = null;
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

  isSuspended() {
    return this.runtimeState === RUNTIME_STATES.SUSPENDED_SCHEDULE
      || this.runtimeState === RUNTIME_STATES.SUSPENDED_INACTIVE;
  }

  isOperational() {
    return this.running && this.runtimeState === RUNTIME_STATES.ACTIVE;
  }

  status(extra = {}) {
    const nextResume = formatDateTime(this.nextResumeAt);
    const overrideUntil = formatDateTime(this.forceActiveUntil);
    let statusMessage = null;
    let operationalDetails = '';

    if (this.runtimeState === RUNTIME_STATES.STARTING) statusMessage = 'Iniciando agente de impressão...';
    if (this.runtimeState === RUNTIME_STATES.SUSPENDING) statusMessage = 'Concluindo impressão atual antes de suspender...';
    if (this.runtimeState === RUNTIME_STATES.SUSPENDED_INACTIVE) {
      statusMessage = 'Agente de impressão inativo.';
      operationalDetails = 'A retomada deve ser feita neste computador.';
    }
    if (this.runtimeState === RUNTIME_STATES.SUSPENDED_SCHEDULE) {
      statusMessage = 'Agente suspenso fora do horário de funcionamento.';
      operationalDetails = nextResume
        ? `Retomada automática prevista para ${nextResume}.`
        : 'Sem próxima abertura cadastrada. Use a retomada local quando necessário.';
    }
    if (this.runtimeState === RUNTIME_STATES.ACTIVE && overrideUntil) {
      statusMessage = 'Agente ativo por liberação local.';
      operationalDetails = `A liberação permanece válida até ${overrideUntil}.`;
    }

    return {
      paired: Boolean(this.credential?.token),
      agent: this.credential?.agent || null,
      deviceId: this.store.getDeviceId(),
      deviceName: this.store.getDeviceName(),
      running: this.running,
      runtimeState: this.runtimeState,
      suspended: this.isSuspended(),
      suspensionReason: this.suspensionReason,
      nextResumeAt: this.nextResumeAt,
      forceActiveUntil: this.forceActiveUntil,
      resuming: Boolean(this.resumePromise),
      statusMessage,
      operationalDetails,
      connected: this.realtimeConnected,
      transport: this.transport,
      connectionSettings: this.connectionSettings,
      printers: this.printerCount,
      lastSeenAt: this.lastSeenAt,
      ...extra,
    };
  }

  notify(extra = {}) {
    this.notifyStatus(this.status(extra));
  }

  loadCredential() {
    this.credential = this.store.readCredential();
    return this.credential;
  }

  loadOperationalOverride() {
    const stored = this.store.readOperationalOverrideUntil?.() || null;
    if (!futureTimestamp(stored)) {
      this.clearOperationalOverride();
      return null;
    }
    this.forceActiveUntil = new Date(stored).toISOString();
    return this.forceActiveUntil;
  }

  saveOperationalOverride(until) {
    const timestamp = futureTimestamp(until);
    if (!timestamp) return null;
    this.forceActiveUntil = new Date(timestamp).toISOString();
    this.store.saveOperationalOverrideUntil?.(this.forceActiveUntil);
    return this.forceActiveUntil;
  }

  clearOperationalOverride() {
    this.forceActiveUntil = null;
    this.store.clearOperationalOverride?.();
  }

  hasOperationalOverride() {
    if (!futureTimestamp(this.forceActiveUntil)) {
      this.clearOperationalOverride();
      return false;
    }
    return true;
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
    this.operational = null;
    this.api.setSessionToken(null);
    event('AGENT_REVOKED');
    this.notify({ authFailed: true });
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
    this.operational = null;
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
      this.runtimeState = RUNTIME_STATES.STOPPED;
      this.notify();
      return;
    }
    if (this.running) return;
    this.running = true;
    this.runtimeState = RUNTIME_STATES.STARTING;
    this.loadOperationalOverride();
    event('AGENT_STARTED', { agentId: this.credential.agent?.id });
    this.notify();
    void this.initialize();
  }

  stop() {
    this.running = false;
    this.runtimeState = RUNTIME_STATES.STOPPED;
    this.suspensionReason = null;
    this.nextResumeAt = null;
    this.clearReconnectTimer();
    this.clearResumeTimer();
    this.clearBoundaryTimer();
    this.clearOperationalTimers();
    void this.realtime.disconnect();
    this.realtimeConnected = false;
    this.realtimeConnectPromise = null;
    this.session = null;
    this.operational = null;
    this.api.setSessionToken(null);
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  clearResumeTimer() {
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.resumeTimer = null;
  }

  clearBoundaryTimer() {
    if (this.boundaryTimer) clearTimeout(this.boundaryTimer);
    this.boundaryTimer = null;
  }

  clearOperationalTimers() {
    for (const timer of this.timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.timers.clear();
    this.intervalTimers.clear();
  }

  async initialize(existingSession = null) {
    if (this.initializationPromise) return this.initializationPromise;
    this.initializationPromise = (async () => {
      try {
        const session = existingSession
          ? this.acceptSession(existingSession)
          : await this.refreshSession();
        if (!this.shouldOperate(session.operational)) {
          await this.requestSuspension(this.resolveSuspensionReason(session.operational), session.operational);
          return this.status();
        }
        await this.startOperationalSession(session);
        return this.status();
      } catch (error) {
        this.handleRuntimeError(error);
        if (this.running && !this.isSuspended()) this.scheduleReconnect();
        return this.status();
      }
    })().finally(() => {
      this.initializationPromise = null;
    });
    return this.initializationPromise;
  }

  acceptSession(session) {
    this.session = session;
    this.operational = session?.operational || null;
    this.api.setSessionToken(session?.access_token || null);
    this.transport = this.configuredTransport === 'auto'
      ? (session?.transport || 'polling')
      : this.configuredTransport;
    return session;
  }

  async refreshSession() {
    try {
      return this.acceptSession(await this.api.createSession());
    } catch (error) {
      if (error.status === 404 || error.status === 405) {
        const session = { transport: 'polling', operational: null };
        this.acceptSession(session);
        if (this.configuredTransport === 'auto') this.transport = 'polling';
        event('LEGACY_BACKEND_FALLBACK');
        return session;
      }
      throw error;
    }
  }

  shouldOperate(operational = this.operational) {
    if (!operational) return true;
    if (operational.agent_active === false) return false;
    if (operational.should_run === true) return true;
    if (operational.should_run === false) return this.hasOperationalOverride();
    if (operational.within_business_hours !== false) return true;
    return this.hasOperationalOverride();
  }

  resolveSuspensionReason(operational = this.operational) {
    return operational?.agent_active === false ? 'inactive' : 'schedule';
  }

  async startOperationalSession(session = this.session) {
    if (!this.running) return;
    this.acceptSession(session);
    this.suspensionReason = null;
    this.nextResumeAt = null;
    this.runtimeState = RUNTIME_STATES.ACTIVE;
    this.clearResumeTimer();
    this.notify({ lastError: null });

    await this.heartbeat();
    await this.syncPrintersIfNeeded(true);
    if (!this.isOperational()) return;
    this.startTimers();
    this.scheduleOperationalBoundary();

    if (this.shouldUseRealtime()) await this.connectRealtime();
    this.requestReconciliation();
    event('AGENT_RESUMED', {
      agentId: this.credential.agent?.id,
      localOverrideUntil: this.forceActiveUntil,
    });
  }

  shouldUseRealtime() {
    if (this.transport === 'polling') return false;
    return this.session?.transport === 'supabase_realtime';
  }

  startTimers() {
    if (this.intervalTimers.size || !this.isOperational()) return;
    this.addInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL_MS);
    this.addInterval(() => this.syncPrintersIfNeeded(false), PRINTER_SCAN_INTERVAL_MS);
    this.addInterval(() => this.requestReconciliation(), this.reconciliationIntervalMs);
    this.addInterval(() => this.renewSession(), SESSION_RENEWAL_MS);
  }

  addInterval(callback, intervalMs) {
    const timer = setInterval(() => {
      if (!this.isOperational()) return;
      Promise.resolve(callback()).catch((error) => this.handleRuntimeError(error));
    }, intervalMs);
    timer.unref?.();
    this.timers.add(timer);
    this.intervalTimers.add(timer);
  }

  scheduleOperationalBoundary() {
    this.clearBoundaryTimer();
    if (!this.isOperational()) return;
    const boundary = this.hasOperationalOverride()
      ? this.forceActiveUntil
      : this.operational?.next_close_at;
    const timestamp = futureTimestamp(boundary);
    if (!timestamp) return;

    this.boundaryTimer = setTimeout(() => {
      this.boundaryTimer = null;
      void this.checkOperationalBoundary();
    }, Math.max(1, timestamp - Date.now() + 250));
    this.boundaryTimer.unref?.();
  }

  async checkOperationalBoundary() {
    if (!this.isOperational()) return;
    if (!futureTimestamp(this.forceActiveUntil)) this.clearOperationalOverride();
    try {
      const session = await this.refreshSession();
      if (!this.shouldOperate(session.operational)) {
        await this.requestSuspension(this.resolveSuspensionReason(session.operational), session.operational);
        return;
      }
      this.scheduleOperationalBoundary();
    } catch (error) {
      event('AGENT_OPERATIONAL_BOUNDARY_CHECK_FAILED', { message: error.message });
      await this.requestSuspension('schedule', this.operational);
    }
  }

  async renewSession() {
    if (!this.isOperational()) return;
    const previouslyRealtime = this.shouldUseRealtime();
    const session = await this.refreshSession();
    if (!this.shouldOperate(session.operational)) {
      await this.requestSuspension(this.resolveSuspensionReason(session.operational), session.operational);
      return;
    }
    this.scheduleOperationalBoundary();
    if (!this.shouldUseRealtime() && previouslyRealtime) {
      await this.realtime.disconnect();
      this.realtimeConnected = false;
      this.requestReconciliation();
    } else if (this.shouldUseRealtime() && !this.realtimeConnected) {
      void this.connectRealtime();
    }
  }

  async heartbeat() {
    if (!this.isOperational()) return;
    await this.withSessionRetry(() => this.api.heartbeat({
      app_version: require('../../package.json').version,
      platform: os.platform(),
    }));
    this.lastSeenAt = new Date().toISOString();
    event('BACKEND_CONNECTED', { agentId: this.credential.agent?.id });
    this.notify({ lastError: null });
  }

  async syncPrintersIfNeeded(force = false) {
    if (!this.isOperational()) return false;
    const printers = await this.printerService.listPrinters();
    const fingerprint = printerFingerprint(printers);
    const safetyDue = Date.now() - this.lastPrinterSyncAt >= PRINTER_SAFETY_SYNC_MS;
    this.printerCount = printers.length;
    if (!force && fingerprint === this.lastPrinterFingerprint && !safetyDue) return false;

    await this.withSessionRetry(() => this.api.syncPrinters(printers));
    this.lastPrinterFingerprint = fingerprint;
    this.lastPrinterSyncAt = Date.now();
    event('PRINTERS_SYNCED', { count: printers.length, changed: !force });
    this.notify();
    return true;
  }

  async connectRealtime() {
    if (!this.isOperational() || !this.shouldUseRealtime() || this.realtimeConnectPromise) {
      return this.realtimeConnectPromise;
    }

    this.realtimeConnectPromise = (async () => {
      const publicConfig = this.session?.realtime || {};
      let connected = await this.realtime.connect(publicConfig);
      if (!connected && this.isOperational()) {
        const credentials = await this.api.createRealtimeSession();
        connected = await this.realtime.connect({ ...publicConfig, ...credentials });
      }
      if (connected && this.isOperational()) {
        this.reconnectAttempt = 0;
        event('SUPABASE_REALTIME_CONNECTED', { agentId: this.credential.agent?.id });
        this.requestReconciliation();
      }
      return connected;
    })().catch((error) => {
      event('SUPABASE_REALTIME_ERROR', { message: error.message });
      this.realtimeConnected = false;
      if (this.isOperational()) {
        this.requestReconciliation();
        this.notify({
          lastError: 'Tempo real indisponível; usando polling de contingência.',
        });
        this.scheduleReconnect();
      }
      return false;
    }).finally(() => {
      this.realtimeConnectPromise = null;
    });

    return this.realtimeConnectPromise;
  }

  handleRealtimeStatus(status = {}) {
    this.realtimeConnected = Boolean(status.connected) && this.isOperational();
    if (!this.isOperational()) return;
    if (this.realtimeConnected) {
      this.notify({ lastError: null });
      return;
    }
    if (this.shouldUseRealtime() && status.status !== 'CLOSED') {
      this.notify({
        lastError: 'Tempo real indisponível; usando polling de contingência.',
      });
      this.scheduleReconnect();
    }
  }

  handleRealtimeMessage(message = {}) {
    if (message.type === 'PRINT_JOB_AVAILABLE' && message.print_job_id) {
      this.requestJob(message.print_job_id);
      return;
    }
    if (message.type === 'PRINT_AGENT_PAUSED') {
      event('AGENT_PAUSED_BY_REALTIME');
      this.clearOperationalOverride();
      void this.requestSuspension('inactive', {
        ...(this.operational || {}),
        agent_active: false,
        should_run: false,
      });
      return;
    }
    if (message.type === 'PRINT_AGENT_REVOKED') {
      event('AGENT_REVOKED_BY_REALTIME');
      this.clearCredential();
    }
  }

  clearActiveWorkQueue() {
    this.pendingJobIds.clear();
    this.reconciliationRequested = false;
    this.retryNotBefore.clear();
  }

  async requestSuspension(reason, operational = this.operational) {
    if (!this.running) return this.status();
    if (this.suspensionPromise) return this.suspensionPromise;
    if (
      (reason === 'inactive' && this.runtimeState === RUNTIME_STATES.SUSPENDED_INACTIVE)
      || (reason === 'schedule' && this.runtimeState === RUNTIME_STATES.SUSPENDED_SCHEDULE)
    ) {
      return this.status();
    }

    this.suspensionReason = reason;
    this.operational = operational || this.operational;
    this.runtimeState = RUNTIME_STATES.SUSPENDING;
    this.clearReconnectTimer();
    this.clearBoundaryTimer();
    this.clearOperationalTimers();
    this.notify();

    this.suspensionPromise = (async () => {
      if (this.processingPromise) await this.processingPromise;
      this.clearActiveWorkQueue();
      this.session = null;
      this.api.setSessionToken(null);
      await this.realtime.disconnect({ clearSession: true });
      this.store.clearRealtimeStorage?.();
      this.realtimeConnected = false;
      this.realtimeConnectPromise = null;

      if (reason === 'inactive') {
        this.clearOperationalOverride();
        this.nextResumeAt = null;
        this.runtimeState = RUNTIME_STATES.SUSPENDED_INACTIVE;
        event('AGENT_SUSPENDED_INACTIVE', { agentId: this.credential.agent?.id });
      } else {
        this.clearOperationalOverride();
        this.nextResumeAt = operational?.next_open_at || null;
        this.runtimeState = RUNTIME_STATES.SUSPENDED_SCHEDULE;
        this.scheduleAutomaticResume(this.nextResumeAt);
        event('AGENT_SUSPENDED_OUTSIDE_HOURS', {
          agentId: this.credential.agent?.id,
          nextResumeAt: this.nextResumeAt,
        });
      }
      this.notify({ lastError: null });
      return this.status();
    })().finally(() => {
      this.suspensionPromise = null;
    });

    return this.suspensionPromise;
  }

  scheduleAutomaticResume(value, retry = false) {
    this.clearResumeTimer();
    const timestamp = futureTimestamp(value);
    if (!timestamp) return;
    if (!retry) this.nextResumeAt = new Date(timestamp).toISOString();
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = null;
      void this.resumeFromSchedule();
    }, Math.max(1, timestamp - Date.now() + 250));
    this.resumeTimer.unref?.();
  }

  async resumeFromSchedule() {
    if (!this.running || this.runtimeState !== RUNTIME_STATES.SUSPENDED_SCHEDULE) return;
    this.runtimeState = RUNTIME_STATES.STARTING;
    this.suspensionReason = 'schedule';
    this.notify();
    const status = await this.initialize();
    if (
      this.running
      && this.runtimeState === RUNTIME_STATES.STARTING
      && !this.initializationPromise
    ) {
      this.clearReconnectTimer();
      this.runtimeState = RUNTIME_STATES.SUSPENDED_SCHEDULE;
      this.notify();
      this.scheduleAutomaticResume(new Date(Date.now() + RESUME_RETRY_MS).toISOString(), true);
    }
    return status;
  }

  async resume() {
    if (this.resumePromise) return this.resumePromise;
    if (!this.loadCredential()) throw new Error('Este computador não está vinculado.');
    this.running = true;
    this.clearResumeTimer();
    this.runtimeState = RUNTIME_STATES.STARTING;
    this.notify();

    this.resumePromise = (async () => {
      const session = this.acceptSession(await this.api.resume());
      const outsideHours = session.operational?.within_business_hours === false
        && session.operational?.should_run !== true;
      if (outsideHours) {
        const nextClosing = futureTimestamp(session.operational?.next_close_at);
        const limit = nextClosing || (Date.now() + MAX_LOCAL_OVERRIDE_MS);
        this.saveOperationalOverride(new Date(limit).toISOString());
        event('AGENT_LOCAL_OVERRIDE_STARTED', {
          agentId: this.credential.agent?.id,
          until: this.forceActiveUntil,
        });
      } else {
        this.clearOperationalOverride();
      }
      this.suspensionReason = null;
      this.nextResumeAt = null;
      await this.initialize(session);
      return this.status();
    })().catch((error) => {
      this.handleRuntimeError(error);
      throw error;
    }).finally(() => {
      this.resumePromise = null;
      this.notify();
    });

    return this.resumePromise;
  }

  scheduleReconnect() {
    const reconnectable = this.runtimeState === RUNTIME_STATES.ACTIVE
      || this.runtimeState === RUNTIME_STATES.STARTING;
    if (!this.running || !reconnectable || this.reconnectTimer) return;
    const baseDelay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt += 1;
    if (this.reconnectAttempt >= 3 && this.isOperational()) this.requestReconciliation();
    const jitter = 0.8 + Math.random() * 0.4;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        const session = await this.refreshSession();
        if (!this.shouldOperate(session.operational)) {
          await this.requestSuspension(this.resolveSuspensionReason(session.operational), session.operational);
          return;
        }
        if (this.runtimeState === RUNTIME_STATES.STARTING) {
          await this.startOperationalSession(session);
          return;
        }
        this.scheduleOperationalBoundary();
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
    if (!this.isOperational()) return;
    this.pendingJobIds.add(jobId);
    void this.drainJobs();
  }

  requestReconciliation() {
    if (!this.isOperational()) return;
    this.reconciliationRequested = true;
    void this.drainJobs();
  }

  async drainJobs() {
    if (this.processingPromise) return this.processingPromise;
    if (!this.isOperational()) return undefined;
    this.processingPromise = (async () => {
      while (this.isOperational() && (this.pendingJobIds.size || this.reconciliationRequested)) {
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

        const jobs = await this.withSessionRetry(() => this.api.claimJobs(1, jobId));
        if (!this.isOperational()) break;
        const [job] = jobs;
        if (job) await this.processJob(job);
        if (!jobId && jobs.length >= 1 && this.isOperational()) this.reconciliationRequested = true;
      }
    })().catch((error) => this.handleRuntimeError(error)).finally(() => {
      this.processingPromise = null;
      if (this.isOperational() && (this.pendingJobIds.size || this.reconciliationRequested)) {
        void this.drainJobs();
      }
    });
    return this.processingPromise;
  }

  async processJob(job) {
    this.currentJobId = job.id;
    try {
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
        if (retryable && this.isOperational()) this.scheduleJobRetry(job.id, RETRY_JOB_DELAY_MS);
        event('PRINT_FAILED', { jobId: job.id, printerId: job.printer_id, errorCode: code });
      }
    } finally {
      this.currentJobId = null;
    }
  }

  scheduleJobRetry(jobId, delayMs) {
    if (!this.isOperational()) return;
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (this.isOperational()) this.requestJob(jobId);
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
    this.notify({ lastError: error.message });
  }

  isIdleForUpdate() {
    return !this.processingPromise
      && !this.suspensionPromise
      && !this.currentJobId
      && this.pendingJobIds.size === 0
      && !this.reconciliationRequested
      && this.retryNotBefore.size === 0;
  }
}

module.exports = AgentRuntime;
module.exports.RECONCILIATION_INTERVAL_MS = RECONCILIATION_INTERVAL_MS;
module.exports.RUNTIME_STATES = RUNTIME_STATES;
module.exports.resolveReconciliationIntervalMs = resolveReconciliationIntervalMs;
