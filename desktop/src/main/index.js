/**
 * EPM Commercial - Main Process Entry Point
 * Employee Productivity Monitor - Desktop Agent
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
log.transports.console.level = 'debug';

// Import modules
const { TrayManager } = require('./tray');
const { ActivityMonitor } = require('./monitor-optimized');
const { DatabaseManager } = require('./database');
const { AuthManager } = require('./auth');
const { LicenseManager } = require('./license');
const { ConfigManager } = require('./config');
const { UninstallProtection } = require('./uninstall-protection');
const { SupabaseClient } = require('./supabase-client');

class EPMApplication {
  constructor() {
    this.mainWindow = null;
    this.trayManager = null;
    this.activityMonitor = null;
    this.databaseManager = null;
    this.authManager = null;
    this.licenseManager = null;
    this.configManager = null;
    this.uninstallProtection = null;
    this.supabaseClient = null;
    this.isQuitting = false;
    this.isPaused = false;
  }

  async initialize() {
    try {
      log.info('EPM Commercial starting...');

      // Initialize configuration
      this.configManager = new ConfigManager();
      await this.configManager.load();

      // Initialize database
      this.databaseManager = new DatabaseManager();
      await this.databaseManager.initialize();
      log.info('Database initialized');

      // Initialize Supabase client for cloud sync
      this.supabaseClient = new SupabaseClient();
      const connected = await this.supabaseClient.testConnection();
      if (connected) {
        log.info('Cloud sync connected to Supabase');
      } else {
        log.warn('Cloud sync unavailable - will continue offline');
      }

      // Initialize auth manager
      this.authManager = new AuthManager(this.databaseManager);
      const needsSetup = await this.authManager.needsSetup();

      // Initialize license manager (needs supabaseClient for server-side validation)
      this.licenseManager = new LicenseManager(this.databaseManager, this.supabaseClient);

      // Initialize uninstall protection
      this.uninstallProtection = new UninstallProtection(this);
      await this.uninstallProtection.initialize();

      // Initialize activity monitor
      this.activityMonitor = new ActivityMonitor(this.databaseManager);

      // Check if first run - show setup window
      if (needsSetup) {
        await this.showSetupWindow();
      } else {
        // Check license status
        const licenseStatus = await this.licenseManager.validateLicense();
        if (!licenseStatus.valid) {
          await this.showLicenseWindow(licenseStatus.message);
        }
      }

      // Initialize tray
      this.trayManager = new TrayManager(this);
      await this.trayManager.create();
      log.info('System tray created');

      // Start monitoring if not paused
      if (!this.isPaused) {
        await this.startMonitoring();
      }

      // Setup IPC handlers
      this.setupIPC();

      // Prevent app from closing
      app.on('before-quit', () => {
        this.isQuitting = true;
      });

      // Handle window close - minimize to tray instead
      if (this.mainWindow) {
        this.mainWindow.on('close', (event) => {
          if (!this.isQuitting) {
            event.preventDefault();
            this.mainWindow.hide();
          }
        });
      }

      log.info('EPM Commercial initialized successfully');

    } catch (error) {
      log.error('Failed to initialize EPM:', error);
      dialog.showErrorBox('Startup Error', `Failed to initialize: ${error.message}`);
      app.quit();
    }
  }

  async showSetupWindow() {
    return new Promise((resolve) => {
      this.mainWindow = new BrowserWindow({
        width: 500,
        height: 450,
        resizable: false,
        center: true,
        title: 'EPM Monitor - Initial Setup',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '../preload/preload.js')
        },
        autoHideMenuBar: true
      });

      this.mainWindow.loadFile(path.join(__dirname, '../renderer/setup.html'));

      this.mainWindow.webContents.on('did-finish-load', () => {
        log.info('Setup window loaded');
      });

      this.mainWindow.on('closed', () => {
        this.mainWindow = null;
        if (!this.authManager) {
          app.quit();
        }
      });

      // Handle setup completion
      ipcMain.once('setup-complete', async (event, { password, licenseKey, companyId }) => {
        try {
          await this.authManager.setupPassword(password);
          await this.licenseManager.register(licenseKey, companyId);
          this.mainWindow.close();
          this.mainWindow = null;
          resolve();
        } catch (error) {
          log.error('Setup failed:', error);
          dialog.showErrorBox('Setup Error', error.message);
        }
      });
    });
  }

  async showLicenseWindow(message) {
    return new Promise((resolve) => {
      this.mainWindow = new BrowserWindow({
        width: 500,
        height: 350,
        resizable: false,
        center: true,
        title: 'EPM Monitor - License Required',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '../preload/preload.js')
        },
        autoHideMenuBar: true
      });

      this.mainWindow.loadFile(path.join(__dirname, '../renderer/license.html'));

      this.mainWindow.webContents.on('did-finish-load', () => {
        this.mainWindow.webContents.send('license-message', message);
      });

      this.mainWindow.on('closed', () => {
        if (!this.licenseManager.isValid) {
          app.quit();
        }
      });

      ipcMain.once('license-submitted', async (event, { licenseKey }) => {
        try {
          const status = await this.licenseManager.register(licenseKey);
          if (status.valid) {
            this.mainWindow.close();
            this.mainWindow = null;
            resolve();
          } else {
            dialog.showErrorBox('Invalid License', status.message);
          }
        } catch (error) {
          dialog.showErrorBox('License Error', error.message);
        }
      });
    });
  }

  setupIPC() {
    // Get status
    ipcMain.handle('get-status', () => {
      return {
        isMonitoring: this.activityMonitor?.isRunning || false,
        isPaused: this.isPaused,
        isLicensed: this.licenseManager?.isValid || false,
        licenseInfo: this.licenseManager?.getLicenseInfo() || null,
        computerId: this.databaseManager?.getComputerId() || null
      };
    });

    // Verify password
    ipcMain.handle('verify-password', async (event, password) => {
      return await this.authManager.verifyPassword(password);
    });

    // Change password
    ipcMain.handle('change-password', async (event, { oldPassword, newPassword }) => {
      return await this.authManager.changePassword(oldPassword, newPassword);
    });

    // Pause/Resume monitoring
    ipcMain.handle('pause-monitoring', async () => {
      if (this.activityMonitor) {
        await this.activityMonitor.pause();
        this.isPaused = true;
        this.trayManager?.updateMenu();
        log.info('Monitoring paused');
      }
      return true;
    });

    ipcMain.handle('resume-monitoring', async () => {
      if (this.activityMonitor) {
        await this.activityMonitor.resume();
        this.isPaused = false;
        this.trayManager?.updateMenu();
        log.info('Monitoring resumed');
      }
      return true;
    });

    // Get recent activity
    ipcMain.handle('get-recent-activity', async (event, limit = 50) => {
      return await this.databaseManager.getRecentActivity(limit);
    });

    // Sync data to server
    ipcMain.handle('sync-data', async () => {
      return await this.syncToServer();
    });

    // Open settings window
    ipcMain.handle('open-settings', () => {
      this.showSettingsWindow();
    });

    // Get configuration
    ipcMain.handle('get-config', () => {
      return this.configManager?.getConfig() || {};
    });

    // Update configuration
    ipcMain.handle('update-config', async (event, config) => {
      await this.configManager.updateConfig(config);
      if (this.activityMonitor) {
        this.activityMonitor.updateConfig(config);
      }
      return true;
    });
  }

  async startMonitoring() {
    try {
      await this.activityMonitor.start();
      log.info('Activity monitoring started');
    } catch (error) {
      log.error('Failed to start monitoring:', error);
    }
  }

  async syncToServer() {
    try {
      if (!this.supabaseClient) {
        return { synced: 0, message: 'Cloud sync not available' };
      }

      const unsyncedData = await this.databaseManager.getUnsyncedActivity();

      if (unsyncedData.length === 0) {
        return { synced: 0, message: 'No data to sync' };
      }

      log.info(`Syncing ${unsyncedData.length} activity records to cloud via Supabase`);

      // Sync to Supabase directly
      const result = await this.databaseManager.syncActivityLogsToCloud(this.supabaseClient);

      // Also update computer last_seen
      await this.supabaseClient.updateComputerStatus(this.databaseManager.getComputerId());

      return result;
    } catch (error) {
      log.error('Sync failed:', error);
      return { synced: 0, message: error.message };
    }
  }

  showSettingsWindow() {
    if (this.mainWindow) {
      this.mainWindow.show();
      return;
    }

    this.mainWindow = new BrowserWindow({
      width: 600,
      height: 500,
      center: true,
      title: 'EPM Monitor - Settings',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/preload.js')
      },
      autoHideMenuBar: true
    });

    this.mainWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  async shutdown() {
    log.info('EPM Commercial shutting down...');
    this.isQuitting = true;

    if (this.activityMonitor) {
      await this.activityMonitor.stop();
    }

    if (this.databaseManager) {
      await this.databaseManager.close();
    }

    app.quit();
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log.info('Another instance is running, quitting...');
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus the main window if another instance tries to start
    if (global.epmApp?.mainWindow) {
      if (global.epmApp.mainWindow.isMinimized()) {
        global.epmApp.mainWindow.restore();
      }
      global.epmApp.mainWindow.show();
      global.epmApp.mainWindow.focus();
    }
  });

  // Start the application
  const epmApp = new EPMApplication();
  global.epmApp = epmApp;

  app.whenReady().then(() => {
    epmApp.initialize();
  });

  app.on('window-all-closed', () => {
    // Don't quit on window close - stay in tray
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      epmApp.showSettingsWindow();
    }
  });
}
