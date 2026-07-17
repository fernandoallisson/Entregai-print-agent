const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Ledger = require('../src/main/ledger');

test('persiste o ledger atomicamente e recupera jobs já impressos', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'entregai-ledger-'));
  const filePath = path.join(directory, 'ledger.json');
  try {
    const ledger = new Ledger(filePath);
    ledger.add('job-1');
    const reloaded = new Ledger(filePath);
    assert.equal(reloaded.has('job-1'), true);
    assert.equal(fs.existsSync(`${filePath}.tmp`), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
