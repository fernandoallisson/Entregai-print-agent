const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Ledger {
  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'print-ledger.json');
    this.entries = this.load();
  }

  load() {
    try {
      return new Set(JSON.parse(fs.readFileSync(this.filePath, 'utf8')));
    } catch {
      return new Set();
    }
  }

  has(jobId) {
    return this.entries.has(jobId);
  }

  add(jobId) {
    this.entries.add(jobId);
    fs.writeFileSync(this.filePath, JSON.stringify([...this.entries].slice(-1000), null, 2));
  }
}

module.exports = Ledger;
