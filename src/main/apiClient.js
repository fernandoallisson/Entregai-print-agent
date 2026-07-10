const { getApiBaseUrl } = require('./config');

class ApiClient {
  constructor(tokenProvider) {
    this.tokenProvider = tokenProvider;
    this.baseUrl = getApiBaseUrl();
  }

  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    const token = this.tokenProvider?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
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

  heartbeat(payload = {}) {
    return this.request('/printing/agent/heartbeat', { method: 'POST', body: payload });
  }

  syncPrinters(printers) {
    return this.request('/printing/agent/printers/sync', { method: 'POST', body: { printers } });
  }

  claimJobs(limit = 1) {
    return this.request('/printing/agent/jobs/claim', { method: 'POST', body: { limit } });
  }

  success(jobId, payload = {}) {
    return this.request(`/printing/agent/jobs/${jobId}/success`, { method: 'POST', body: payload });
  }

  failure(jobId, payload) {
    return this.request(`/printing/agent/jobs/${jobId}/failure`, { method: 'POST', body: payload });
  }
}

module.exports = ApiClient;
