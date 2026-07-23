const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { app, safeStorage } = require('electron');
const { DEFAULT_PRINT_LAYOUT, normalizePrintLayoutConfig } = require('./printLayoutConfig');
const { getConnectionSettings, validateConnectionSettings } = require('./config');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

class SecureStore {
  constructor() {
    this.dir = app.getPath('userData');
    ensureDir(this.dir);
    this.configPath = path.join(this.dir, 'config.json');
    this.credentialPath = path.join(this.dir, 'credential.json');
    this.realtimeStoragePath = path.join(this.dir, 'realtime-session.json');
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

  readConnectionSettings() {
    return getConnectionSettings(this.readConfig().connection || null);
  }

  saveConnectionSettings(settings) {
    const normalized = validateConnectionSettings(settings);
    this.updateConfig({ connection: normalized });
    return normalized;
  }

  readOperationalOverrideUntil() {
    const value = this.readConfig().operationalOverrideUntil;
    if (!value || !Number.isFinite(Date.parse(value))) return null;
    return value;
  }

  saveOperationalOverrideUntil(value) {
    if (!value || !Number.isFinite(Date.parse(value))) {
      this.clearOperationalOverride();
      return null;
    }
    const normalized = new Date(value).toISOString();
    this.updateConfig({ operationalOverrideUntil: normalized });
    return normalized;
  }

  clearOperationalOverride() {
    const config = this.readConfig();
    if (!Object.prototype.hasOwnProperty.call(config, 'operationalOverrideUntil')) return;
    delete config.operationalOverrideUntil;
    this.writeJson(this.configPath, config);
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
    this.clearOperationalOverride();
    this.clearRealtimeStorage();
  }

  readRealtimeStorageValue(key) {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const entries = this.readJson(this.realtimeStoragePath, {});
    if (!entries[key]) return null;
    try {
      return safeStorage.decryptString(Buffer.from(entries[key], 'base64'));
    } catch {
      return null;
    }
  }

  saveRealtimeStorageValue(key, value) {
    if (!safeStorage.isEncryptionAvailable()) return false;
    const entries = this.readJson(this.realtimeStoragePath, {});
    entries[key] = safeStorage.encryptString(String(value)).toString('base64');
    this.writeJson(this.realtimeStoragePath, entries);
    return true;
  }

  removeRealtimeStorageValue(key) {
    const entries = this.readJson(this.realtimeStoragePath, {});
    if (!Object.prototype.hasOwnProperty.call(entries, key)) return;
    delete entries[key];
    if (Object.keys(entries).length) this.writeJson(this.realtimeStoragePath, entries);
    else this.clearRealtimeStorage();
  }

  createRealtimeStorage() {
    return {
      getItem: (key) => this.readRealtimeStorageValue(key),
      setItem: (key, value) => this.saveRealtimeStorageValue(key, value),
      removeItem: (key) => this.removeRealtimeStorageValue(key),
    };
  }

  clearRealtimeStorage() {
    try {
      fs.unlinkSync(this.realtimeStoragePath);
    } catch {
      // Sessão Realtime ausente.
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
