/**
 * EPM Commercial - Activity Monitor
 * Tracks application usage, browser activity, and idle time
 */

const { exec } = require('child_process');
const crypto = require('crypto');
const log = require('electron-log');

class ActivityMonitor {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
    this.isRunning = false;
    this.isPaused = false;
    this.interval = null;
    this.idleThreshold = 300; // 5 minutes default
    this.syncInterval = 5 * 60 * 1000; // 5 minutes default
    this.lastActiveTime = Date.now();
    this.currentActivity = null;
    this.activityStartTime = null;
    this.browserPatterns = [
      'chrome.exe', 'firefox.exe', 'msedge.exe', 'brave.exe', 'opera.exe'
    ];
  }

  async start() {
    if (this.isRunning) return;

    log.info('Starting activity monitor...');
    this.isRunning = true;
    this.isPaused = false;
    this.activityStartTime = Date.now();

    // Start monitoring loop
    this.interval = setInterval(() => this.monitor(), 1000);

    // Start sync loop
    this.syncIntervalId = setInterval(() => this.syncData(), this.syncInterval);

    // Initial capture
    await this.captureActivity();

    log.info('Activity monitor started');
  }

  async stop() {
    if (!this.isRunning) return;

    log.info('Stopping activity monitor...');
    this.isRunning = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }

    // Save final activity
    if (this.currentActivity) {
      await this.saveActivity(this.currentActivity);
    }

    log.info('Activity monitor stopped');
  }

  async pause() {
    this.isPaused = true;
    if (this.currentActivity) {
      await this.saveActivity(this.currentActivity);
      this.currentActivity = null;
    }
    log.info('Activity monitor paused');
  }

  async resume() {
    this.isPaused = false;
    this.activityStartTime = Date.now();
    await this.captureActivity();
    log.info('Activity monitor resumed');
  }

  updateConfig(config) {
    if (config.idleThreshold) {
      this.idleThreshold = config.idleThreshold;
    }
    if (config.syncInterval) {
      this.syncInterval = config.syncInterval * 60 * 1000;
      // Restart sync interval
      if (this.syncIntervalId) {
        clearInterval(this.syncIntervalId);
        this.syncIntervalId = setInterval(() => this.syncData(), this.syncInterval);
      }
    }
  }

  async monitor() {
    if (this.isPaused) return;

    try {
      // Check if system is idle
      const isIdle = await this.checkIdleStatus();

      if (isIdle) {
        // System is idle
        if (this.currentActivity && this.currentActivity.type !== 'idle') {
          // Save previous activity
          await this.saveActivity(this.currentActivity);
          this.currentActivity = null;
        }

        // Record idle time
        await this.recordIdleTime();
      } else {
        // System is active
        this.lastActiveTime = Date.now();
        await this.captureActivity();
      }
    } catch (error) {
      log.error('Monitor error:', error);
    }
  }

  async checkIdleStatus() {
    return new Promise((resolve) => {
      // Windows: Use PowerGetActiveSchema or query system
      // For simplicity, we'll use last input time
      const command = 'powershell -command "Add-Type -TypeDefinition @\"using System; using System.Runtime.InteropServices; public class IdleTime { [DllImport(\"user32.dll\")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii); [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; } public static uint GetIdleTime() { LASTINPUTINFO lastInput = new LASTINPUTINFO(); lastInput.cbSize = (uint)Marshal.SizeOf(lastInput); if (GetLastInputInfo(ref lastInput)) { return ((uint)Environment.TickCount - lastInput.dwTime) / 1000; } return 0; } }\"@ -PassThru; [IdleTime]::GetIdleTime()"';

      exec(command, { timeout: 5000 }, (error, stdout) => {
        if (error) {
          log.warn('Failed to get idle time:', error);
          resolve(false);
          return;
        }

        const idleSeconds = parseInt(stdout.trim(), 10);
        resolve(idleSeconds >= this.idleThreshold);
      });
    });
  }

  async captureActivity() {
    try {
      const activeWindow = await this.getActiveWindowInfo();

      if (!activeWindow || !activeWindow.title) {
        return;
      }

      // Check if this is a new activity
      const activityKey = this.getActivityKey(activeWindow);

      if (this.currentActivity && this.currentActivity.key === activityKey) {
        // Same activity, update duration
        this.currentActivity.duration = Date.now() - this.activityStartTime;
      } else {
        // New activity
        if (this.currentActivity) {
          await this.saveActivity(this.currentActivity);
        }

        this.currentActivity = {
          key: activityKey,
          type: this.categorizeActivity(activeWindow),
          app: activeWindow.process,
          title: activeWindow.title,
          url: activeWindow.url || null,
          startTime: Date.now(),
          duration: 0,
          synced: false
        };

        this.activityStartTime = Date.now();
      }
    } catch (error) {
      log.error('Failed to capture activity:', error);
    }
  }

  async getActiveWindowInfo() {
    return new Promise((resolve) => {
      const script = `
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        public class WindowInfo {
            [DllImport("user32.dll")]
            public static extern IntPtr GetForegroundWindow();
            [DllImport("user32.dll")]
            public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
            [DllImport("user32.dll")]
            public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        }
"@
        $hwnd = [WindowInfo]::GetForegroundWindow()
        $title = New-Object System.Text.StringBuilder 256
        [WindowInfo]::GetWindowText($hwnd, $title, 256) | Out-Null
        $processId = 0
        [WindowInfo]::GetWindowThreadProcessId($hwnd, [ref]$processId) | Out-Null
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        Write-Output "$($title.ToString())|$($process.ProcessName)"
      `;

      exec(`powershell -command "${script.replace(/"/g, '\\"')}"`, { timeout: 5000 }, (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }

        const parts = stdout.trim().split('|');
        if (parts.length < 2) {
          resolve(null);
          return;
        }

        const title = parts[0];
        const process = parts[1];

        // Check for browser URL
        let url = null;
        if (this.browserPatterns.includes(process.toLowerCase())) {
          url = this.extractBrowserUrl(process);
        }

        resolve({
          title: title,
          process: process,
          url: url
        });
      });
    });
  }

  extractBrowserUrl(browser) {
    // In production, this would read browser history/tabs
    // For now, return null
    return null;
  }

  getActivityKey(windowInfo) {
    const keyData = `${windowInfo.process}:${windowInfo.title}:${windowInfo.url || ''}`;
    return crypto.createHash('sha256').update(keyData).digest('hex').substring(0, 16);
  }

  categorizeActivity(windowInfo) {
    const process = windowInfo.process.toLowerCase();
    const title = (windowInfo.title || '').toLowerCase();
    const url = windowInfo.url || '';

    // Productive applications
    const productive = [
      'code', 'devenv', 'sublime', 'atom', 'notepad++',
      'word', 'excel', 'powerpoint', 'outlook',
      'slack', 'teams', 'zoom', 'skype',
      'git', 'terminal', 'cmd', 'powershell'
    ];

    // Unproductive applications
    const unproductive = [
      'spotify', 'discord', 'steam', 'games',
      'netflix', 'twitch', 'facebook', 'twitter',
      'instagram', 'tiktok', 'youtube'
    ];

    // Check process
    if (productive.some(p => process.includes(p))) {
      return 'productive';
    }

    if (unproductive.some(p => process.includes(p))) {
      return 'unproductive';
    }

    // Check URL patterns
    if (url.includes('github') || url.includes('stackoverflow') || url.includes('gitlab')) {
      return 'productive';
    }

    if (url.includes('facebook') || url.includes('twitter') || url.includes('youtube')) {
      return 'unproductive';
    }

    // Default to neutral
    return 'neutral';
  }

  async saveActivity(activity) {
    if (!activity || activity.duration < 1000) {
      return; // Ignore activities shorter than 1 second
    }

    try {
      await this.databaseManager.saveActivity({
        app_name: activity.app,
        app_title: activity.title,
        url: activity.url,
        category: activity.type,
        duration_seconds: Math.floor(activity.duration / 1000),
        timestamp: new Date(activity.startTime).toISOString()
      });

      log.debug(`Saved activity: ${activity.app} (${Math.floor(activity.duration / 1000)}s)`);
    } catch (error) {
      log.error('Failed to save activity:', error);
    }
  }

  async recordIdleTime() {
    const idleDuration = Math.floor((Date.now() - this.lastActiveTime) / 1000);

    if (idleDuration >= 60) { // Only record if idle for at least 1 minute
      try {
        await this.databaseManager.saveIdleTime({
          duration_seconds: idleDuration,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        log.error('Failed to record idle time:', error);
      }
    }
  }

  async syncData() {
    log.info('Starting data sync...');
    try {
      const unsyncedData = await this.databaseManager.getUnsyncedActivity();

      if (unsyncedData.length === 0) {
        log.debug('No data to sync');
        return;
      }

      // In production, send to backend API
      // For now, just log
      log.info(`Would sync ${unsyncedData.length} activity records`);

      // Mark as synced
      await this.databaseManager.markAsSynced(unsyncedData.map(d => d.id));

      log.info('Data sync completed');
    } catch (error) {
      log.error('Data sync failed:', error);
    }
  }
}

module.exports = { ActivityMonitor };
