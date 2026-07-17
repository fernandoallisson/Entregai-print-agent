const os = require('os');
const ApiClient = require('./apiClient');
const Ledger = require('./ledger');
const PrinterService = require('./printerService');
const { event } = require('./logger');

class AgentRuntime {
  constructor(store, mainWindowProvider, notifyStatus) {
    this.store = store;
    this.notifyStatus = notifyStatus;
    this.ledger = new Ledger();
    this.api = new ApiClient(() => this.credential?.token);
    this.printerService = new PrinterService(mainWindowProvider, () => this.store.readPrintLayout());
    this.running = false;
    this.backoffMs = 3000;
    this.credential = null;
  }

  status(extra = {}) {
    return {
      paired: Boolean(this.credential?.token),
      agent: this.credential?.agent || null,
      deviceId: this.store.getDeviceId(),
      deviceName: this.store.getDeviceName(),
      running: this.running,
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
    this.store.saveCredential(result);
    this.credential = this.store.readCredential();
    event('AGENT_PAIRED', { agentId: result.agent?.id });
    this.start();
    return this.status();
  }

  clearCredential() {
    this.store.clearCredential();
    this.credential = null;
    this.running = false;
    event('AGENT_REVOKED');
    this.notifyStatus(this.status({ authFailed: true }));
  }

  start() {
    if (!this.loadCredential()) {
      this.notifyStatus(this.status());
      return;
    }
    if (this.running) return;
    this.running = true;
    event('AGENT_STARTED', { agentId: this.credential.agent?.id });
    this.loop();
  }

  stop() {
    this.running = false;
  }

  async loop() {
    while (this.running) {
      try {
        await this.tick();
        this.backoffMs = 3000;
        await this.delay(3000);
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          event('AGENT_AUTH_FAILED');
          this.clearCredential();
          return;
        }
        event('BACKEND_DISCONNECTED', { message: error.message });
        this.notifyStatus(this.status({ lastError: error.message }));
        await this.delay(this.backoffMs);
        this.backoffMs = Math.min(this.backoffMs * 2, 30000);
      }
    }
  }

  async tick() {
    await this.api.heartbeat({ app_version: require('../../package.json').version, platform: os.platform() });
    event('BACKEND_CONNECTED', { agentId: this.credential.agent?.id });
    const printers = await this.printerService.listPrinters();
    await this.api.syncPrinters(printers);
    event('PRINTERS_SYNCED', { count: printers.length });

    const jobs = await this.api.claimJobs(2);
    for (const job of jobs) {
      await this.processJob(job);
    }
    this.notifyStatus(this.status({ printers: printers.length, lastSeenAt: new Date().toISOString() }));
  }

  async processJob(job) {
    if (this.ledger.has(job.id)) {
      event('PRINT_JOB_ALREADY_IN_LEDGER', { jobId: job.id });
      await this.api.success(job.id, { ledger_key: job.id });
      return;
    }

    try {
      event('PRINT_JOB_CLAIMED', { jobId: job.id, printerId: job.printer_id });
      event('PRINT_STARTED', { jobId: job.id, printerId: job.printer_id });
      await this.printerService.print(job);
      this.ledger.add(job.id);
      await this.api.success(job.id, { ledger_key: job.id });
      event('PRINT_SUCCESS', { jobId: job.id, printerId: job.printer_id });
    } catch (error) {
      const code = error.code || 'PRINT_FAILED';
      await this.api.failure(job.id, {
        error_code: code,
        error_message: error.message || 'Falha ao imprimir',
        retryable: code !== 'PRINTER_NOT_FOUND',
      });
      event('PRINT_FAILED', { jobId: job.id, printerId: job.printer_id, errorCode: code });
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = AgentRuntime;
