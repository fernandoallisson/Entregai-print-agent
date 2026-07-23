const test = require('node:test');
const assert = require('node:assert/strict');
const AgentRuntime = require('../src/main/agentRuntime');

test('configura o polling de contingência para três minutos', () => {
  assert.equal(AgentRuntime.RECONCILIATION_INTERVAL_MS, 3 * 60 * 1000);
});

test('permite polling de três segundos somente na execução local', () => {
  assert.equal(AgentRuntime.resolveReconciliationIntervalMs({
    isPackaged: false,
    value: '3000',
  }), 3000);
  assert.equal(AgentRuntime.resolveReconciliationIntervalMs({
    isPackaged: true,
    value: '3000',
  }), 3 * 60 * 1000);
});

const makeRuntime = ({ jobs = [] } = {}) => {
  const printed = [];
  const succeeded = [];
  const synced = [];
  const entries = new Set();
  const claimed = new Set();
  let credential = { token: 'epa_test', agent: { id: 'agent-1' }, environment: 'development' };
  let connectionSettings = {
    apiBaseUrl: 'http://localhost:3010/api',
    environment: 'development',
    transport: 'auto',
  };
  const configuredConnections = [];
  const realtimeConnections = [];
  const realtimeDisconnects = [];
  const heartbeats = [];
  let operationalOverrideUntil = null;
  const api = {
    pair: async () => ({
      token: 'epa_paired',
      agent: { id: 'agent-1', nome: 'Caixa' },
      environment: 'development',
    }),
    claimJobs: async (_limit, jobId) => {
      const job = jobs.find((candidate) => (!jobId || candidate.id === jobId) && !claimed.has(candidate.id));
      if (!job) return [];
      claimed.add(job.id);
      return [job];
    },
    success: async (jobId) => succeeded.push(jobId),
    failure: async () => undefined,
    syncPrinters: async (printers) => synced.push(printers),
    heartbeat: async (payload) => heartbeats.push(payload),
    createSession: async () => ({ access_token: 'session', transport: 'polling' }),
    resume: async () => ({ access_token: 'session', transport: 'polling' }),
    createRealtimeSession: async () => ({
      transport: 'supabase_realtime',
      url: 'https://project.supabase.co',
      publishable_key: 'sb_publishable_test',
      topic: 'printing:agent:agent-1',
      access_token: 'realtime-access',
      refresh_token: 'realtime-refresh',
    }),
    setSessionToken: () => undefined,
    configure: (settings) => configuredConnections.push(settings),
  };
  const printerService = {
    print: async (job) => printed.push(job.id),
    listPrinters: async () => [{ device_name: 'Printer', display_name: 'Printer', description: '' }],
  };
  const ledger = {
    has: (id) => entries.has(id),
    add: (id) => entries.add(id),
  };
  const realtime = {
    connect: async (config) => {
      realtimeConnections.push(config);
      return true;
    },
    disconnect: async (options) => realtimeDisconnects.push(options || {}),
  };
  const store = {
    readCredential: () => credential,
    saveCredential: (nextCredential) => { credential = nextCredential; },
    clearCredential: () => { credential = null; },
    readConnectionSettings: () => connectionSettings,
    saveConnectionSettings: (settings) => {
      connectionSettings = settings;
      return connectionSettings;
    },
    readOperationalOverrideUntil: () => operationalOverrideUntil,
    saveOperationalOverrideUntil: (value) => {
      operationalOverrideUntil = value;
      return value;
    },
    clearOperationalOverride: () => { operationalOverrideUntil = null; },
    clearRealtimeStorage: () => undefined,
    getDeviceId: () => 'device-1',
    getDeviceName: () => 'Caixa',
    readPrintLayout: () => ({}),
  };
  const runtime = new AgentRuntime(store, () => null, () => undefined, {
    api,
    printerService,
    ledger,
    realtime,
  });
  runtime.running = true;
  runtime.runtimeState = AgentRuntime.RUNTIME_STATES.ACTIVE;
  runtime.credential = store.readCredential();
  runtime.session = { access_token: 'session', transport: 'polling' };
  return {
    runtime,
    printed,
    succeeded,
    synced,
    configuredConnections,
    api,
    heartbeats,
    realtimeDisconnects,
    realtimeConnections,
    store,
    getOperationalOverrideUntil: () => operationalOverrideUntil,
  };
};

test('eventos duplicados do mesmo job produzem uma única impressão', async () => {
  const job = { id: 'job-1', printer_id: 'printer-1', payload: {} };
  const { runtime, printed, succeeded } = makeRuntime({ jobs: [job] });
  runtime.requestJob(job.id);
  runtime.requestJob(job.id);
  await runtime.drainJobs();
  assert.deepEqual(printed, ['job-1']);
  assert.deepEqual(succeeded, ['job-1']);
});

test('lista idêntica não é reenviada antes da verificação de segurança', async () => {
  const { runtime, synced } = makeRuntime();
  await runtime.syncPrintersIfNeeded(true);
  await runtime.syncPrintersIfNeeded(false);
  assert.equal(synced.length, 1);
});

test('modo automático adota Supabase Realtime quando o backend habilita o transporte', async () => {
  const { runtime } = makeRuntime();
  runtime.configuredTransport = 'auto';
  runtime.transport = 'polling';
  runtime.api.createSession = async () => ({
    access_token: 'new-session',
    transport: 'supabase_realtime',
    realtime: {
      url: 'https://project.supabase.co',
      publishable_key: 'sb_publishable_test',
      topic: 'printing:agent:agent-1',
    },
  });

  await runtime.refreshSession();

  assert.equal(runtime.transport, 'supabase_realtime');
  assert.equal(runtime.shouldUseRealtime(), true);
});

test('evento Realtime solicita o job e mantém deduplicação pelo ledger', async () => {
  const job = { id: 'job-realtime', printer_id: 'printer-1', payload: {} };
  const { runtime, printed } = makeRuntime({ jobs: [job] });

  runtime.handleRealtimeMessage({ type: 'PRINT_JOB_AVAILABLE', print_job_id: job.id });
  runtime.handleRealtimeMessage({ type: 'PRINT_JOB_AVAILABLE', print_job_id: job.id });
  await runtime.drainJobs();

  assert.deepEqual(printed, [job.id]);
});

test('falha do tempo real mantém o runtime apto ao polling de contingência', async () => {
  const { runtime } = makeRuntime();
  runtime.session = {
    access_token: 'session',
    transport: 'supabase_realtime',
    realtime: {
      url: 'https://project.supabase.co',
      publishable_key: 'sb_publishable_test',
      topic: 'printing:agent:agent-1',
    },
  };
  runtime.transport = 'supabase_realtime';
  runtime.realtime.connect = async () => { throw new Error('canal indisponível'); };
  runtime.drainJobs = async () => undefined;

  const connected = await runtime.connectRealtime();

  assert.equal(connected, false);
  assert.equal(runtime.reconciliationRequested, true);
  assert.ok(runtime.reconnectTimer);
  runtime.stop();
});

test('evento de pausa suspende chamadas operacionais e limpa sessão Realtime local', async () => {
  const { runtime, realtimeDisconnects, heartbeats } = makeRuntime();
  runtime.transport = 'supabase_realtime';
  runtime.session = { access_token: 'session', transport: 'supabase_realtime' };

  runtime.handleRealtimeMessage({ type: 'PRINT_AGENT_PAUSED', print_agent_id: 'agent-1' });
  await runtime.suspensionPromise;
  runtime.requestJob('job-after-pause');
  await runtime.drainJobs();
  await runtime.heartbeat();

  assert.equal(runtime.runtimeState, AgentRuntime.RUNTIME_STATES.SUSPENDED_INACTIVE);
  assert.deepEqual(realtimeDisconnects.at(-1), { clearSession: true });
  assert.equal(heartbeats.length, 0);
  runtime.stop();
});

test('retomada local fora do horário persiste exceção até o próximo fechamento', async () => {
  const nextClose = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { runtime, api, getOperationalOverrideUntil, heartbeats } = makeRuntime();
  api.resume = async () => ({
    access_token: 'session',
    transport: 'polling',
    operational: {
      agent_active: true,
      within_business_hours: false,
      should_run: false,
      next_close_at: nextClose,
    },
  });
  runtime.runtimeState = AgentRuntime.RUNTIME_STATES.SUSPENDED_SCHEDULE;

  await runtime.resume();

  assert.equal(runtime.runtimeState, AgentRuntime.RUNTIME_STATES.ACTIVE);
  assert.equal(getOperationalOverrideUntil(), nextClose);
  assert.equal(heartbeats.length, 1);
  runtime.stop();
});

test('retomada dentro da tolerância operacional não cria exceção local', async () => {
  const nextClose = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  const { runtime, api, getOperationalOverrideUntil, heartbeats } = makeRuntime();
  api.resume = async () => ({
    access_token: 'session',
    transport: 'polling',
    operational: {
      agent_active: true,
      within_business_hours: false,
      within_operational_grace: true,
      should_run: true,
      next_close_at: nextClose,
    },
  });
  runtime.runtimeState = AgentRuntime.RUNTIME_STATES.SUSPENDED_SCHEDULE;

  await runtime.resume();

  assert.equal(runtime.runtimeState, AgentRuntime.RUNTIME_STATES.ACTIVE);
  assert.equal(getOperationalOverrideUntil(), null);
  assert.equal(heartbeats.length, 1);
  runtime.stop();
});

test('só permite atualização quando não há trabalho de impressão ou retry', () => {
  const { runtime } = makeRuntime();
  assert.equal(runtime.isIdleForUpdate(), true);
  runtime.pendingJobIds.add('job-1');
  assert.equal(runtime.isIdleForUpdate(), false);
  runtime.pendingJobIds.clear();
  runtime.retryNotBefore.set('job-1', Date.now() + 1000);
  assert.equal(runtime.isIdleForUpdate(), false);
});

test('mudança de ambiente salva a conexão e exige novo vínculo', () => {
  const { runtime, configuredConnections } = makeRuntime();

  const status = runtime.updateConnectionSettings({
    apiBaseUrl: 'https://api.exemplo.com/api',
    environment: 'production',
    transport: 'auto',
  });

  assert.equal(status.paired, false);
  assert.equal(status.requiresRePairing, true);
  assert.equal(status.connectionSettings.environment, 'production');
  assert.equal(configuredConnections.length, 1);
});

test('vínculo alinha o ambiente local ao ambiente informado pelo backend', async () => {
  const { runtime } = makeRuntime();
  runtime.connectionSettings = {
    apiBaseUrl: 'https://api.exemplo.com/api',
    environment: 'production',
    transport: 'auto',
  };
  runtime.api.pair = async () => ({
    token: 'epa_paired',
    agent: { id: 'agent-1', nome: 'Caixa' },
    environment: 'staging',
  });

  const status = await runtime.pair('123 456');

  assert.equal(status.connectionSettings.environment, 'staging');
  assert.equal(status.paired, true);
});
