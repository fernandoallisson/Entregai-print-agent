const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('interface expõe configuração local sem campo de segredo', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '../src/preload/preload.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');

  assert.match(html, /id="backendUrl"/);
  assert.match(html, /id="agentEnvironment"/);
  assert.match(html, /id="printTransport"/);
  assert.doesNotMatch(html, /PRINT_AGENT_SESSION_SECRET|sessionSecret|service_role/i);
  assert.match(preload, /saveConnectionSettings/);
  assert.match(main, /connection-settings:save/);
  assert.match(html, /id="currentVersion"/);
  assert.match(html, /id="updateProgress"/);
  assert.match(preload, /onUpdateStatus/);
  assert.match(main, /update:get-status/);
});
