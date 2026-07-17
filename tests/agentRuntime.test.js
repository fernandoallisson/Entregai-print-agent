const test = require('node:test');
const assert = require('node:assert/strict');
const AgentRuntime = require('../src/main/agentRuntime');

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
    heartbeat: async () => undefined,
    createSession: async () => ({ access_token: 'session', transport: 'polling' }),
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
  const store = {
    readCredential: () => credential,
    saveCredential: (nextCredential) => { credential = nextCredential; },
    clearCredential: () => { credential = null; },
    readConnectionSettings: () => connectionSettings,
    saveConnectionSettings: (settings) => {
      connectionSettings = settings;
      return connectionSettings;
    },
    getDeviceId: () => 'device-1',
    getDeviceName: () => 'Caixa',
    readPrintLayout: () => ({}),
  };
  const runtime = new AgentRuntime(store, () => null, () => undefined, { api, printerService, ledger });
  runtime.running = true;
  runtime.credential = store.readCredential();
  runtime.session = { access_token: 'session', transport: 'polling' };
  return { runtime, printed, succeeded, synced, configuredConnections };
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

test('modo automático retorna do polling para WebSocket quando o backend habilita o transporte', async () => {
  const { runtime } = makeRuntime();
  runtime.configuredTransport = 'auto';
  runtime.transport = 'polling';
  runtime.api.createSession = async () => ({ access_token: 'new-session', transport: 'websocket' });

  await runtime.refreshSession();

  assert.equal(runtime.transport, 'websocket');
  assert.equal(runtime.shouldUseWebSocket(), true);
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
