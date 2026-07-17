const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { app, safeStorage } = require('electron');
const { DEFAULT_PRINT_LAYOUT, normalizePrintLayoutConfig } = require('./printLayoutConfig');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

class SecureStore {
  constructor() {
    this.dir = app.getPath('userData');
    ensureDir(this.dir);
    this.configPath = path.join(this.dir, 'config.json');
    this.credentialPath = path.join(this.dir, 'credential.json');
    this.printLayoutPath = path.join(this.dir, 'print-layout.json');
  }

  readJson(filePath, fallback) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return fallback;
    }
  }

  writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  getDeviceId() {
    const config = this.readJson(this.configPath, {});
    if (config.deviceId) return config.deviceId;
    const deviceId = crypto.randomUUID();
    this.writeJson(this.configPath, {
      ...config,
      deviceId,
      deviceName: os.hostname(),
    });
    return deviceId;
  }

  getDeviceName() {
    const config = this.readJson(this.configPath, {});
    return config.deviceName || os.hostname();
  }

  readConfig() {
    return this.readJson(this.configPath, {});
  }

  updateConfig(patch) {
    const config = this.readConfig();
    this.writeJson(this.configPath, {
      ...config,
      ...patch,
    });
  }

  saveCredential({ token, agent, environment }) {
    const encrypted = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(token).toString('base64')
      : Buffer.from(token, 'utf8').toString('base64');
    this.writeJson(this.credentialPath, {
      encrypted,
      safeStorage: safeStorage.isEncryptionAvailable(),
      agent,
      environment,
      savedAt: new Date().toISOString(),
    });
  }

  readCredential() {
    const credential = this.readJson(this.credentialPath, null);
    if (!credential?.encrypted) return null;
    const buffer = Buffer.from(credential.encrypted, 'base64');
    const token = credential.safeStorage && safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buffer)
      : buffer.toString('utf8');
    return { ...credential, token };
  }

  clearCredential() {
    try {
      fs.unlinkSync(this.credentialPath);
    } catch {
      // Credencial ausente.
    }
  }

  readPrintLayout() {
    return normalizePrintLayoutConfig(this.readJson(this.printLayoutPath, DEFAULT_PRINT_LAYOUT));
  }

  savePrintLayout(config) {
    const normalized = normalizePrintLayoutConfig(config);
    this.writeJson(this.printLayoutPath, normalized);
    return normalized;
  }

  resetPrintLayout() {
    const normalized = normalizePrintLayoutConfig(DEFAULT_PRINT_LAYOUT);
    this.writeJson(this.printLayoutPath, normalized);
    return normalized;
  }
}

module.exports = SecureStore;
