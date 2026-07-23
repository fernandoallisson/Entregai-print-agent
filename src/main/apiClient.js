const { getApiBaseUrl } = require('./config');

class ApiClient {
  constructor(tokenProvider, connectionSettings = null) {
    this.tokenProvider = tokenProvider;
    this.baseUrl = getApiBaseUrl(connectionSettings);
    this.sessionToken = null;
  }

  configure(connectionSettings) {
    this.baseUrl = getApiBaseUrl(connectionSettings);
    this.sessionToken = null;
  }

  async request(path, options = {}) {
    const { useCredential = false, ...requestOptions } = options;
    const headers = {
      'Content-Type': 'application/json',
      ...(requestOptions.headers || {}),
    };
    const token = useCredential ? this.tokenProvider?.() : (this.sessionToken || this.tokenProvider?.());
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...requestOptions,
      headers,
      body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || data?.message || 'Falha de comunicação com o backend');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data.data ?? data;
  }

  pair(payload) {
    return this.request('/printing/agent/pair', { method: 'POST', body: payload });
  }

  createSession() {
    return this.request('/printing/agent/session', { method: 'POST', useCredential: true });
  }

  createRealtimeSession() {
    return this.request('/printing/agent/realtime-session', { method: 'POST', useCredential: true });
  }

  resume() {
    return this.request('/printing/agent/resume', { method: 'POST', useCredential: true });
  }

  setSessionToken(token) {
    this.sessionToken = token || null;
  }

  heartbeat(payload = {}) {
    return this.request('/printing/agent/heartbeat', { method: 'POST', body: payload });
  }

  syncPrinters(printers) {
    return this.request('/printing/agent/printers/sync', { method: 'POST', body: { printers } });
  }

  claimJobs(limit = 1, jobId = null) {
    return this.request('/printing/agent/jobs/claim', {
      method: 'POST',
      body: { limit, ...(jobId ? { job_id: jobId } : {}) },
    });
  }

  success(jobId, payload = {}) {
    return this.request(`/printing/agent/jobs/${jobId}/success`, { method: 'POST', body: payload });
  }

  failure(jobId, payload) {
    return this.request(`/printing/agent/jobs/${jobId}/failure`, { method: 'POST', body: payload });
  }
}

module.exports = ApiClient;
