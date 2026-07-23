const DEFAULT_API_BASE_URL = 'http://localhost:3010/api';

function normalizeEnvironment(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['development', 'staging', 'production'].includes(normalized)) return normalized;
  return 'development';
}

function normalizeTransport(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'polling') return normalized;
  if (normalized === 'websocket' || normalized === 'supabase_realtime') return 'auto';
  return 'auto';
}

function normalizeApiBaseUrl(value, environment) {
  let url;
  try {
    url = new URL(String(value || DEFAULT_API_BASE_URL).trim());
  } catch {
    throw new Error('Informe uma URL válida para o backend.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('A URL do backend deve usar HTTP ou HTTPS.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('A URL do backend não pode conter credenciais, parâmetros ou fragmentos.');
  }

  const localHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (environment === 'production' && url.protocol !== 'https:' && !localHost) {
    throw new Error('Em produção, a URL do backend deve usar HTTPS.');
  }

  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = !path || path === '/' ? '/api' : path;
  if (!url.pathname.endsWith('/api')) {
    throw new Error('A URL do backend deve terminar com /api.');
  }
  return url.toString().replace(/\/$/, '');
}

function getConnectionSettings(stored = null) {
  const environment = normalizeEnvironment(
    stored?.environment || process.env.ENTREGAI_AGENT_ENVIRONMENT || process.env.NODE_ENV || 'development',
  );
  return {
    apiBaseUrl: normalizeApiBaseUrl(
      stored?.apiBaseUrl || process.env.ENTREGAI_API_BASE_URL || DEFAULT_API_BASE_URL,
      environment,
    ),
    environment,
    transport: normalizeTransport(stored?.transport || process.env.ENTREGAI_PRINT_TRANSPORT || 'auto'),
  };
}

function validateConnectionSettings(settings = {}) {
  const requestedTransport = String(settings.transport || '').trim().toLowerCase();
  if (!String(settings.apiBaseUrl || '').trim()) {
    throw new Error('Informe a URL do backend.');
  }
  if (!['development', 'staging', 'production'].includes(String(settings.environment || '').toLowerCase())) {
    throw new Error('Selecione um ambiente válido.');
  }
  if (!['auto', 'polling', 'websocket', 'supabase_realtime'].includes(requestedTransport)) {
    throw new Error('Selecione um transporte válido.');
  }
  return getConnectionSettings(settings);
}

function getApiBaseUrl(settings = null) {
  return getConnectionSettings(settings).apiBaseUrl;
}

function getAgentEnvironment(settings = null) {
  return getConnectionSettings(settings).environment;
}

function getPrintTransport(settings = null) {
  return getConnectionSettings(settings).transport;
}

module.exports = {
  DEFAULT_API_BASE_URL,
  getConnectionSettings,
  getAgentEnvironment,
  getApiBaseUrl,
  getPrintTransport,
  validateConnectionSettings,
};
