const test = require('node:test');
const assert = require('node:assert/strict');
const { getConnectionSettings, validateConnectionSettings } = require('../src/main/config');

test('normaliza configurações locais e acrescenta /api quando necessário', () => {
  const settings = getConnectionSettings({
    apiBaseUrl: 'http://localhost:3010',
    environment: 'development',
    transport: 'auto',
  });

  assert.deepEqual(settings, {
    apiBaseUrl: 'http://localhost:3010/api',
    environment: 'development',
    transport: 'auto',
  });
});

test('exige HTTPS para backend remoto de produção', () => {
  assert.throws(() => getConnectionSettings({
    apiBaseUrl: 'http://api.exemplo.com/api',
    environment: 'production',
    transport: 'auto',
  }), /HTTPS/);

  assert.equal(getConnectionSettings({
    apiBaseUrl: 'https://api.exemplo.com/api',
    environment: 'production',
    transport: 'auto',
  }).apiBaseUrl, 'https://api.exemplo.com/api');
});

test('migra transportes antigos para o modo automático', () => {
  assert.equal(getConnectionSettings({
    apiBaseUrl: 'https://api.exemplo.com/api',
    environment: 'production',
    transport: 'websocket',
  }).transport, 'auto');
  assert.equal(getConnectionSettings({
    apiBaseUrl: 'https://api.exemplo.com/api',
    environment: 'production',
    transport: 'supabase_realtime',
  }).transport, 'auto');
});

test('rejeita URL que contenha credenciais', () => {
  assert.throws(() => getConnectionSettings({
    apiBaseUrl: 'https://usuario:senha@api.exemplo.com/api',
    environment: 'production',
    transport: 'auto',
  }), /credenciais/);
});

test('valida os valores recebidos pela interface', () => {
  assert.throws(() => validateConnectionSettings({
    apiBaseUrl: '',
    environment: 'production',
    transport: 'auto',
  }), /URL/);
  assert.throws(() => validateConnectionSettings({
    apiBaseUrl: 'https://api.exemplo.com/api',
    environment: 'production',
    transport: 'invalido',
  }), /transporte/);
});
