const test = require('node:test');
const assert = require('node:assert/strict');
const PrintRealtimeClient = require('../src/main/printRealtimeClient');

function makeClient({ storedSession = null } = {}) {
  const events = [];
  const statuses = [];
  const channel = {
    on(_type, _filter, callback) {
      this.callback = callback;
      return this;
    },
    subscribe(callback) {
      callback('SUBSCRIBED');
      return this;
    },
  };
  const auth = {
    getSession: async () => ({ data: { session: storedSession }, error: null }),
    setSession: async (session) => ({ data: { session }, error: null }),
    stopAutoRefresh: () => undefined,
  };
  const supabase = {
    auth,
    channel: () => channel,
    removeChannel: async () => undefined,
  };
  const storage = {};
  const store = {
    createRealtimeStorage: () => ({
      getItem: (key) => storage[key] || null,
      setItem: (key, value) => { storage[key] = value; },
      removeItem: (key) => { delete storage[key]; },
    }),
  };
  const client = new PrintRealtimeClient(store, {
    clientFactory: () => supabase,
    onEvent: (event) => events.push(event),
    onStatus: (status) => statuses.push(status),
  });
  return { channel, client, events, statuses };
}

test('assina canal privado com sessão emitida pelo backend', async () => {
  const { channel, client, events } = makeClient();
  const connected = await client.connect({
    url: 'https://project.supabase.co',
    publishable_key: 'sb_publishable_test',
    topic: 'printing:agent:agent-1',
    access_token: 'access',
    refresh_token: 'refresh',
  });

  assert.equal(connected, true);
  channel.callback({ payload: { type: 'PRINT_JOB_AVAILABLE', print_job_id: 'job-1' } });
  assert.deepEqual(events, [{ type: 'PRINT_JOB_AVAILABLE', print_job_id: 'job-1' }]);
});

test('informa ausência de sessão persistida para permitir novo provisionamento', async () => {
  const { client } = makeClient();
  const connected = await client.connect({
    url: 'https://project.supabase.co',
    publishable_key: 'sb_publishable_test',
    topic: 'printing:agent:agent-1',
  });
  assert.equal(connected, false);
});
