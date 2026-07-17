const test = require('node:test');
const assert = require('node:assert/strict');
const { printerFingerprint } = require('../src/main/printerInventory');

test('gera o mesmo hash independentemente da ordem das impressoras', () => {
  const first = printerFingerprint([
    { device_name: 'B', display_name: 'B', description: '' },
    { device_name: 'A', display_name: 'A', description: '' },
  ]);
  const second = printerFingerprint([
    { device_name: 'A', display_name: 'A', description: '' },
    { device_name: 'B', display_name: 'B', description: '' },
  ]);
  assert.equal(first, second);
});

test('altera o hash quando o inventário do sistema operacional muda', () => {
  const first = printerFingerprint([{ device_name: 'A', description: 'USB' }]);
  const second = printerFingerprint([{ device_name: 'A', description: 'Rede' }]);
  assert.notEqual(first, second);
});
