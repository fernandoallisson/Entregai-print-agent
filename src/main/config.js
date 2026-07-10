const DEFAULT_API_BASE_URL = 'http://localhost:3010/api';

function getApiBaseUrl() {
  return (process.env.ENTREGAI_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

function getAgentEnvironment() {
  const value = String(process.env.ENTREGAI_AGENT_ENVIRONMENT || process.env.NODE_ENV || 'development').toLowerCase();
  if (value === 'production' || value === 'staging') return value;
  return 'development';
}

module.exports = {
  getAgentEnvironment,
  getApiBaseUrl,
};
