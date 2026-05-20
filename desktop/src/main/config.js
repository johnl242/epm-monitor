/**
 * EPM Commercial - Configuration Manager
 * Handles application settings and configuration
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

class ConfigManager {
  constructor() {
    this.configPath = null;
    this.config = {};
    this.defaultConfig = {
      apiUrl: 'https://api.epm-commercial.com',
      syncInterval: 5, // minutes
      idleThreshold: 300, // seconds
      screenshotEnabled: false,
      screenshotInterval: 10, // minutes
      screenshotQuality: 70,
      maxLocalStorage: 500, // MB
      autoStart: true,
      minimizeToTray: true,
      closeToTray: true,
      showNotifications: true,
      language: 'en'
    };
  }

  async load() {
    try {
      const userDataPath = app.getPath('userData');
      this.configPath = path.join(userDataPath, 'config.json');

      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        this.config = { ...this.defaultConfig, ...JSON.parse(data) };
      } else {
        this.config = { ...this.defaultConfig };
      }

      log.info('Configuration loaded');
    } catch (error) {
      log.error('Failed to load configuration:', error);
      this.config = { ...this.defaultConfig };
    }
  }

  async save() {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      log.info('Configuration saved');
    } catch (error) {
      log.error('Failed to save configuration:', error);
      throw error;
    }
  }

  get(key, defaultValue = null) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  set(key, value) {
    this.config[key] = value;
  }

  getConfig() {
    return { ...this.config };
  }

  async updateConfig(updates) {
    // Validate updates
    if (updates.syncInterval !== undefined) {
      if (updates.syncInterval < 1 || updates.syncInterval > 60) {
        throw new Error('Sync interval must be between 1 and 60 minutes');
      }
    }

    if (updates.idleThreshold !== undefined) {
      if (updates.idleThreshold < 60 || updates.idleThreshold > 3600) {
        throw new Error('Idle threshold must be between 60 and 3600 seconds');
      }
    }

    if (updates.screenshotInterval !== undefined) {
      if (updates.screenshotInterval < 1 || updates.screenshotInterval > 60) {
        throw new Error('Screenshot interval must be between 1 and 60 minutes');
      }
    }

    if (updates.maxLocalStorage !== undefined) {
      if (updates.maxLocalStorage < 100 || updates.maxLocalStorage > 10000) {
        throw new Error('Max local storage must be between 100 and 10000 MB');
      }
    }

    // Apply updates
    Object.assign(this.config, updates);

    // Save configuration
    await this.save();

    log.info('Configuration updated:', Object.keys(updates));

    return true;
  }

  reset() {
    this.config = { ...this.defaultConfig };
    this.save();
  }

  exportConfig() {
    return JSON.stringify(this.config, null, 2);
  }

  async importConfig(configJson) {
    try {
      const imported = JSON.parse(configJson);
      const validated = {};

      // Only import known keys
      for (const key of Object.keys(this.defaultConfig)) {
        if (imported[key] !== undefined) {
          validated[key] = imported[key];
        }
      }

      this.config = { ...this.defaultConfig, ...validated };
      await this.save();

      log.info('Configuration imported');
      return true;
    } catch (error) {
      log.error('Failed to import configuration:', error);
      throw new Error('Invalid configuration format');
    }
  }
}

module.exports = { ConfigManager };
