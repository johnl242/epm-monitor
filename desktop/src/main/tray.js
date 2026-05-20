/**
 * EPM Commercial - System Tray Manager
 * Handles system tray icon and context menu with password protection
 */

const { Tray, Menu, nativeImage, app, dialog, BrowserWindow } = require('electron');
const path = require('path');
const log = require('electron-log');
const { checkForUpdates } = require('./updater');

class TrayManager {
  constructor(mainApp) {
    this.mainApp = mainApp;
    this.tray = null;
    this.iconPath = path.join(__dirname, '../../assets/tray-icon.png');
    this.currentIcon = 'active';
    this.passwordWindow = null;
  }

  async create() {
    try {
      // Create tray icon using a simple native image
      const icon = this.createTrayIcon('active');
      this.tray = new Tray(icon);
      this.tray.setToolTip('EPM Monitor - Monitoring Active');

      // Set context menu
      this.updateMenu();

      // Double-click to open settings (with password)
      this.tray.on('double-click', () => {
        this.requestPasswordForAction('settings');
      });

      log.info('Tray created successfully');
    } catch (error) {
      log.error('Failed to create tray:', error);
      throw error;
    }
  }

  createTrayIcon(status) {
    // Create a simple colored icon based on status
    let color;
    switch (status) {
      case 'active':
        color = '#22c55e'; // Green
        break;
      case 'paused':
        color = '#f59e0b'; // Yellow/Orange
        break;
      case 'warning':
        color = '#ef4444'; // Red
        break;
      default:
        color = '#22c55e';
    }

    // Create a 16x16 icon with the status color using a data URL
    const size = 16;
    const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="3" fill="${color}"/>
      <circle cx="8" cy="8" r="4" fill="white"/>
    </svg>`;

    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    return nativeImage.createFromDataURL(dataUrl);
  }

  /**
   * Request password before performing sensitive action
   */
  async requestPasswordForAction(action) {
    try {
      const verified = await this.showPasswordDialog();
      if (!verified) {
        return false;
      }

      // Execute the action
      switch (action) {
        case 'pause':
          await this.mainApp.pauseMonitoring();
          break;
        case 'resume':
          await this.mainApp.resumeMonitoring();
          break;
        case 'settings':
          this.mainApp.showSettingsWindow();
          break;
        case 'exit':
          this.mainApp.shutdown();
          break;
        case 'sync':
          await this.mainApp.syncToServer();
          break;
      }
      return true;
    } catch (error) {
      log.error(`Failed to ${action}:`, error);
      return false;
    }
  }

  /**
   * Show password verification dialog
   */
  showPasswordDialog() {
    return new Promise((resolve) => {
      if (this.passwordWindow && !this.passwordWindow.isDestroyed()) {
        this.passwordWindow.focus();
        resolve(false);
        return;
      }

      this.passwordWindow = new BrowserWindow({
        width: 380,
        height: 280,
        resizable: false,
        center: true,
        title: 'Password Required',
        parent: this.mainApp.mainWindow || null,
        modal: true,
        frame: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '../preload/preload.js')
        }
      });

      this.passwordWindow.loadFile(path.join(__dirname, '../renderer/password-dialog.html'));

      this.passwordWindow.webContents.on('did-finish-load', () => {
        this.passwordWindow.focus();
      });

      // Handle password verification
      const { ipcMain } = require('electron');

      // Listen for password verification result
      const handleResult = (event, { password }) => {
        ipcMain.removeListener('password-dialog-result', handleResult);
        ipcMain.removeListener('password-dialog-cancel', handleCancel);
        this.closePasswordWindow();

        this.verifyPassword(password).then(resolve).catch(() => resolve(false));
      };

      const handleCancel = () => {
        ipcMain.removeListener('password-dialog-result', handleResult);
        ipcMain.removeListener('password-dialog-cancel', handleCancel);
        this.closePasswordWindow();
        resolve(false);
      };

      ipcMain.on('password-dialog-result', handleResult);
      ipcMain.on('password-dialog-cancel', handleCancel);

      this.passwordWindow.on('closed', () => {
        ipcMain.removeAllListeners('password-dialog-result');
        ipcMain.removeAllListeners('password-dialog-cancel');
        this.passwordWindow = null;
        resolve(false);
      });
    });
  }

  /**
   * Verify password with auth manager
   */
  async verifyPassword(password) {
    try {
      const isValid = await this.mainApp.authManager.verifyPassword(password);
      return isValid;
    } catch (error) {
      log.warn('Password verification failed:', error.message);
      return false;
    }
  }

  closePasswordWindow() {
    if (this.passwordWindow && !this.passwordWindow.isDestroyed()) {
      this.passwordWindow.close();
      this.passwordWindow = null;
    }
  }

  updateMenu() {
    if (!this.tray) return;

    const isMonitoring = !this.mainApp.isPaused;
    const isLicensed = this.mainApp.licenseManager?.isValid || false;
    const licenseInfo = this.mainApp.licenseManager?.getLicenseInfo() || {};

    // Status text
    let statusText = 'Monitoring Active';
    if (this.mainApp.isPaused) {
      statusText = 'Monitoring Paused';
    } else if (!isLicensed) {
      statusText = 'License Required';
    }

    // Build menu
    const menuTemplate = [
      {
        label: `EPM Monitor - ${statusText}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Status',
        submenu: [
          {
            label: `Computer ID: ${this.mainApp.databaseManager?.getComputerId() || 'N/A'}`,
            enabled: false
          },
          {
            label: `License: ${licenseInfo.key || 'None'}`,
            enabled: false
          },
          {
            label: `Seats: ${licenseInfo.seatsUsed || 0} / ${licenseInfo.seats || 0}`,
            enabled: false
          }
        ]
      },
      { type: 'separator' },
      {
        label: isMonitoring ? 'Pause Monitoring' : 'Resume Monitoring',
        click: () => {
          this.requestPasswordForAction(isMonitoring ? 'pause' : 'resume');
        }
      },
      {
        label: 'View Recent Activity',
        click: () => {
          this.showActivityWindow();
        }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          this.requestPasswordForAction('settings');
        }
      },
      {
        label: 'Sync Now',
        click: () => {
          this.requestPasswordForAction('sync');
        }
      },
      { type: 'separator' },
      {
        label: 'Check for Updates',
        click: () => checkForUpdates(false)
      },
      {
        label: 'About',
        click: () => {
          this.showAbout();
        }
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          this.requestPasswordForAction('exit');
        }
      }
    ];

    const contextMenu = Menu.buildFromTemplate(menuTemplate);
    this.tray.setContextMenu(contextMenu);
  }

  updateIcon(status) {
    if (this.currentIcon === status) return;

    this.currentIcon = status;
    const icon = this.createTrayIcon(status);
    this.tray.setImage(icon);

    switch (status) {
      case 'active':
        this.tray.setToolTip('EPM Monitor - Monitoring Active');
        break;
      case 'paused':
        this.tray.setToolTip('EPM Monitor - Monitoring Paused');
        break;
      case 'warning':
        this.tray.setToolTip('EPM Monitor - License Warning');
        break;
    }
  }

  showActivityWindow() {
    const activityWindow = new BrowserWindow({
      width: 800,
      height: 600,
      title: 'EPM Monitor - Recent Activity',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/preload.js')
      }
    });

    activityWindow.loadFile(path.join(__dirname, '../renderer/activity.html'));
  }

  showAbout() {
    dialog.showMessageBox({
      type: 'info',
      title: 'About EPM Monitor',
      message: 'EPM Commercial',
      detail: `Version: ${app.getVersion()}
Copyright © 2024 EPM Commercial
Employee Productivity Monitor

Track application usage, browser activity, and idle time to improve workplace productivity.
Your activity is monitored by your organization.`
    });
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
    this.closePasswordWindow();
  }
}

module.exports = { TrayManager };
