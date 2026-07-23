const { createClient } = require('@supabase/supabase-js');

const SUBSCRIBE_TIMEOUT_MS = 15 * 1000;

class PrintRealtimeClient {
  constructor(store, {
    onEvent = () => undefined,
    onStatus = () => undefined,
    clientFactory = createClient,
  } = {}) {
    this.store = store;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.clientFactory = clientFactory;
    this.client = null;
    this.channel = null;
    this.connected = false;
  }

  setConnected(connected, details = {}) {
    this.connected = connected;
    this.onStatus({ connected, ...details });
  }

  async connect(config = {}) {
    await this.disconnect();
    if (!config.url || !config.publishable_key || !config.topic) {
      throw new Error('Configuração do tempo real incompleta.');
    }

    this.client = this.clientFactory(config.url, config.publishable_key, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage: this.store.createRealtimeStorage(),
      },
    });

    let authResult;
    if (config.access_token && config.refresh_token) {
      authResult = await this.client.auth.setSession({
        access_token: config.access_token,
        refresh_token: config.refresh_token,
      });
    } else {
      authResult = await this.client.auth.getSession();
    }

    if (authResult.error) throw authResult.error;
    if (!authResult.data?.session?.access_token) return false;

    this.channel = this.client
      .channel(config.topic, { config: { private: true } })
      .on('broadcast', { event: 'printing:update' }, (message) => {
        this.onEvent(message?.payload || message);
      });

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.setConnected(false, { status: 'TIMED_OUT' });
        this.disconnect()
          .catch(() => undefined)
          .finally(() => reject(new Error('Tempo limite ao conectar o canal de impressão.')));
      }, SUBSCRIBE_TIMEOUT_MS);
      timer.unref?.();

      this.channel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          this.setConnected(true, { status });
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(true);
          }
          return;
        }

        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          this.setConnected(false, { status, error });
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error || new Error(`Canal de impressão indisponível: ${status}`));
          }
        }
      });
    });
  }

  async disconnect() {
    this.setConnected(false, { status: 'CLOSED' });
    if (this.client && this.channel) {
      await this.client.removeChannel(this.channel).catch(() => undefined);
    }
    this.client?.auth?.stopAutoRefresh?.();
    this.channel = null;
    this.client = null;
  }
}

module.exports = PrintRealtimeClient;
