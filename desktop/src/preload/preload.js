/**
 * EPM Commercial - Preload Script
 * Secure bridge between main and renderer processes
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('epm', {
  // Status
  getStatus: () => ipcRenderer.invoke('get-status'),

  // Authentication
  verifyPassword: (password) => ipcRenderer.invoke('verify-password', password),
  changePassword: (oldPassword, newPassword) =>
    ipcRenderer.invoke('change-password', { oldPassword, newPassword }),

  // Monitoring control
  pauseMonitoring: () => ipcRenderer.invoke('pause-monitoring'),
  resumeMonitoring: () => ipcRenderer.invoke('resume-monitoring'),

  // Activity
  getRecentActivity: (limit) => ipcRenderer.invoke('get-recent-activity', limit),

  // Sync
  syncData: () => ipcRenderer.invoke('sync-data'),

  // Settings
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (config) => ipcRenderer.invoke('update-config', config),
  openSettings: () => ipcRenderer.invoke('open-settings'),

  // Setup (only available during setup)
  submitSetup: (data) => ipcRenderer.send('setup-complete', data),

  // License
  submitLicense: (licenseKey) => ipcRenderer.send('license-submitted', { licenseKey }),

  // Uninstall password verification
  cancelPassword: () => ipcRenderer.send('uninstall-password-cancel'),
  submitUninstallPassword: (password) => ipcRenderer.send('uninstall-password-result', { password }),

  // Password dialog (for sensitive actions)
  cancelPasswordDialog: () => ipcRenderer.send('password-dialog-cancel'),
  submitPasswordDialog: (password) => ipcRenderer.send('password-dialog-result', { password }),

  // Event listeners
  onLicenseMessage: (callback) => {
    ipcRenderer.on('license-message', (event, message) => callback(message));
  },

  removeLicenseListener: () => {
    ipcRenderer.removeAllListeners('license-message');
  }
});

// Notify main process that preload is ready
console.log('EPM Preload script loaded');
