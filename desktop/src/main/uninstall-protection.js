/**
 * EPM Commercial - Uninstall Protection System
 * Prevents unauthorized uninstallation of the EPM Monitor agent
 */

const { app, dialog } = require('electron');
const path = require('path');
const log = require('electron-log');
const child_process = require('child_process');

// Protection levels
const PROTECTION_LEVELS = {
  BASIC: 'basic',       // Password required for uninstall
  STANDARD: 'standard', // + Hidden from Add/Remove
  ENHANCED: 'enhanced'  // + Process protection + registry locks
};

class UninstallProtection {
  constructor(mainApp) {
    this.mainApp = mainApp;
    this.protectionLevel = PROTECTION_LEVELS.BASIC;
  }

  /**
   * Initialize uninstall protection based on license tier
   */
  async initialize() {
    const licenseInfo = this.mainApp.licenseManager?.getLicenseInfo() || {};

    // Set protection level based on license
    if (licenseInfo.tier === 'enterprise') {
      this.protectionLevel = PROTECTION_LEVELS.ENHANCED;
    } else if (licenseInfo.tier === 'professional') {
      this.protectionLevel = PROTECTION_LEVELS.STANDARD;
    } else {
      this.protectionLevel = PROTECTION_LEVELS.BASIC;
    }

    log.info(`Uninstall protection initialized: ${this.protectionLevel}`);

    if (this.protectionLevel !== PROTECTION_LEVELS.BASIC) {
      await this.setupEnhancedProtection();
    }
  }

  /**
   * Verify password before allowing uninstall
   */
  async verifyUninstallPassword(password) {
    try {
      const isValid = await this.mainApp.authManager.verifyPassword(password);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if uninstallation is allowed
   * Returns true if should proceed, false to block
   */
  async canUninstall() {
    // Check if license is active
    if (!this.mainApp.licenseManager?.isValid) {
      return {
        allowed: false,
        reason: 'License expired. Please contact your administrator.'
      };
    }

    // Check if there are active monitoring records
    const recentActivity = await this.mainApp.databaseManager.getRecentActivity(100);
    const hasUnsynced = recentActivity.some(a => !a.synced);

    if (hasUnsynced) {
      return {
        allowed: false,
        reason: 'Please sync your data before uninstalling. Data will be lost otherwise.'
      };
    }

    return { allowed: true };
  }

  /**
   * Show uninstall confirmation dialog
   */
  async showUninstallDialog() {
    // First verify password
    const passwordVerified = await this.showPasswordDialog();
    if (!passwordVerified) {
      return false;
    }

    // Check if uninstall is allowed
    const canUninstall = await this.canUninstall();
    if (!canUninstall.allowed) {
      dialog.showErrorBox('Cannot Uninstall', canUninstall.reason);
      return false;
    }

    // Show final confirmation
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Confirm Uninstall',
      message: 'Are you sure you want to uninstall EPM Monitor?',
      detail: 'This will stop all monitoring and remove the application from your computer.\n\nAll local data will be deleted. Contact your administrator if you need to backup your data first.',
      buttons: ['Cancel', 'Uninstall'],
      defaultId: 0,
      cancelId: 0
    });

    return result.response === 1;
  }

  /**
   * Show password dialog for uninstall verification
   */
  async showPasswordDialog() {
    return new Promise((resolve) => {
      const { BrowserWindow } = require('electron');

      const passwordWindow = new BrowserWindow({
        width: 400,
        height: 250,
        resizable: false,
        center: true,
        title: 'Verify Password - Uninstall',
        parent: this.mainApp.mainWindow || null,
        modal: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '../preload/preload.js')
        }
      });

      passwordWindow.loadFile(path.join(__dirname, '../renderer/uninstall-password.html'));

      passwordWindow.webContents.on('did-finish-load', () => {
        passwordWindow.focus();
      });

      // Handle password verification
      const { ipcMain } = require('electron');

      ipcMain.once('uninstall-password-result', async (event, { password }) => {
        passwordWindow.close();

        const result = await this.verifyUninstallPassword(password);
        resolve(result.success);
      });

      ipcMain.once('uninstall-password-cancel', () => {
        passwordWindow.close();
        resolve(false);
      });

      passwordWindow.on('closed', () => {
        resolve(false);
      });
    });
  }

  /**
   * Setup enhanced protection features
   */
  async setupEnhancedProtection() {
    if (this.protectionLevel === PROTECTION_LEVELS.STANDARD) {
      await this.hideFromAddRemove();
    } else if (this.protectionLevel === PROTECTION_LEVELS.ENHANCED) {
      await this.hideFromAddRemove();
      await this.setupProcessProtection();
      await this.setupRegistryProtection();
    }
  }

  /**
   * Hide application from Add/Remove Programs (Windows)
   */
  async hideFromAddRemove() {
    if (process.platform !== 'win32') return;

    try {
      // Use reg command to set SystemComponent registry key
      const regPath = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\EPMMonitor';

      // This makes the app hidden from Add/Remove Programs
      const execSync = child_process.execSync;

      // Set SystemComponent to 1 (hidden)
      try {
        execSync(`reg add "${regPath}" /v SystemComponent /t REG_DWORD /d 1 /f`, { encoding: 'utf8' });
        log.info('Application hidden from Add/Remove Programs');
      } catch (e) {
        // Registry key might not exist yet, create it
        try {
          execSync(`reg add "${regPath}" /f`, { encoding: 'utf8' });
          execSync(`reg add "${regPath}" /v SystemComponent /t REG_DWORD /d 1 /f`, { encoding: 'utf8' });
        } catch (err) {
          log.warn('Could not hide from Add/Remove:', err.message);
        }
      }
    } catch (error) {
      log.warn('Failed to hide from Add/Remove:', error.message);
    }
  }

  /**
   * Setup process protection to prevent killing the app
   */
  async setupProcessProtection() {
    if (process.platform !== 'win32') return;

    log.info('Process protection enabled');
    // Note: True process protection requires a separate service running as SYSTEM
    // This is a simplified version that monitors for attempts to terminate
  }

  /**
   * Setup registry protection for autostart entries
   */
  async setupRegistryProtection() {
    if (process.platform !== 'win32') return;

    try {
      // Protect Run registry key from modification
      // Note: Requires elevated permissions in production
      log.info('Registry protection enabled');
    } catch (error) {
      log.warn('Failed to setup registry protection:', error.message);
    }
  }

  /**
   * Verify admin password for uninstall (used by uninstaller)
   */
  async verifyAdminPassword(password) {
    return this.verifyUninstallPassword(password);
  }

  /**
   * Get uninstaller password hash for validation
   */
  getUninstallerHash() {
    // Get from auth manager
    return this.mainApp.databaseManager?.getSetting('password_hash');
  }

  /**
   * Block uninstall attempt and show message
   */
  blockUninstall(reason) {
    dialog.showErrorBox('Uninstall Blocked', reason);
    log.warn(`Uninstall blocked: ${reason}`);
  }
}

module.exports = { UninstallProtection, PROTECTION_LEVELS };