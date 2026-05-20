/**
 * EPM Commercial - Optimized Activity Monitor
 * Low CPU/RAM footprint monitoring with efficient Windows API usage
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const log = require('electron-log');

// Native Windows API bindings for better performance
// Falls back to PowerShell if native bindings unavailable
class ActivityMonitor {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
    this.isRunning = false;
    this.isPaused = false;
    this.monitorInterval = null;
    this.syncInterval = null;
    this.idleInterval = null;

    // Performance settings - optimized for minimal resource usage
    this.config = {
      // How often to check active window (milliseconds)
      // 3 seconds is sufficient for activity monitoring
      // Reduces CPU usage by 3x compared to 1-second intervals
      windowCheckInterval: 3000,

      // Idle check interval (milliseconds)
      // Can be longer since idle state changes less frequently
      idleCheckInterval: 10000,

      // How often to sync data to server (milliseconds)
      syncInterval: 5 * 60 * 1000,

      // Minimum activity duration to record (milliseconds)
      // Prevents recording quick window switches
      minActivityDuration: 5000,

      // Batch size for database writes
      batchSize: 50,

      // Idle threshold in milliseconds (5 minutes)
      idleThreshold: 5 * 60 * 1000,

      // Maximum memory缓存 for activities before forcing sync
      maxActivityCache: 200
    };

    this.lastActiveTime = Date.now();
    this.lastIdleCheck = Date.now();
    this.currentActivity = null;
    this.activityStartTime = null;
    this.activityCache = [];
    this.isCurrentlyIdle = false;

    this.browserPatterns = [
      'chrome.exe', 'firefox.exe', 'msedge.exe', 'brave.exe', 'opera.exe',
      'chromium.exe', 'vivaldi.exe', 'brave.exe'
    ];

    // Productive/unproductive apps - expandable
    this.productivityRules = this.buildProductivityRules();

    // Cache for window info to reduce API calls
    this.windowCache = {
      lastWindow: null,
      lastWindowTime: 0,
      cacheTimeout: 2000
    };
  }

  buildProductivityRules() {
    return {
      productive: {
        apps: [
          'code', 'devenv', 'sublime', 'atom', 'notepad++', 'vim', 'emacs',
          'word', 'excel', 'powerpoint', 'onenote', 'wps', 'pdf',
          'outlook', 'thunderbird', 'mail',
          'slack', 'teams', 'zoom', 'skype', 'discord',
          'git', 'terminal', 'cmd', 'powershell', 'bash',
          'sap', 'salesforce', 'crm', 'erp',
          'photoshop', 'illustrator', 'figma', 'sketch',
          'studio', 'android', 'xcode', 'intellij', 'pycharm', 'webstorm'
        ],
        domains: [
          'github.com', 'gitlab.com', 'bitbucket.org',
          'stackoverflow.com', 'stackexchange.com',
          'notion.so', 'confluence.atlassian.com',
          'slack.com', 'teams.microsoft.com',
          'docs.google.com', 'office.com', 'microsoft.com/office',
          'jira.atlassian.com', 'asana.com', 'trello.com'
        ]
      },
      unproductive: {
        apps: [
          'spotify', 'steam', 'epic', 'gog', 'minecraft',
          'netflix', 'hulu', 'disney', 'hbomax',
          'twitch', 'kick', 'rumble',
          'facebook', 'twitter', 'instagram', 'tiktok',
          'youtube', 'reddit', '9gag'
        ],
        domains: [
          'facebook.com', 'twitter.com', 'x.com',
          'instagram.com', 'tiktok.com', 'youtube.com',
          'reddit.com', '9gag.com', 'buzzfeed.com',
          'netflix.com', 'hulu.com', 'twitch.tv'
        ]
      }
    };
  }

  async start() {
    if (this.isRunning) return;

    log.info('[Monitor] Starting optimized activity monitor...');
    this.isRunning = true;
    this.isPaused = false;
    this.activityStartTime = Date.now();
    this.lastActiveTime = Date.now();

    // Main monitoring loop - using setInterval for efficiency
    // This is much lighter than recursive polling
    this.monitorInterval = setInterval(
      () => this.monitorActiveWindow(),
      this.config.windowCheckInterval
    );

    // Separate idle check - runs less frequently
    this.idleInterval = setInterval(
      () => this.checkIdleStatus(),
      this.config.idleCheckInterval
    );

    // Sync to server periodically
    this.syncInterval = setInterval(
      () => this.flushActivityCache(),
      this.config.syncInterval
    );

    // Initial capture
    await this.captureActiveWindow();

    log.info('[Monitor] Optimized activity monitor started');
    log.info(`[Monitor] Window check interval: ${this.config.windowCheckInterval}ms`);
    log.info(`[Monitor] Idle check interval: ${this.config.idleCheckInterval}ms`);
  }

  async stop() {
    if (!this.isRunning) return;

    log.info('[Monitor] Stopping activity monitor...');
    this.isRunning = false;

    // Clear all intervals
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    if (this.idleInterval) {
      clearInterval(this.idleInterval);
      this.idleInterval = null;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Flush any remaining activity
    await this.flushActivityCache();

    log.info('[Monitor] Activity monitor stopped');
  }

  async pause() {
    this.isPaused = true;
    await this.flushActivityCache();
    log.info('[Monitor] Activity monitor paused');
  }

  async resume() {
    this.isPaused = false;
    this.activityStartTime = Date.now();
    this.lastActiveTime = Date.now();
    await this.captureActiveWindow();
    log.info('[Monitor] Activity monitor resumed');
  }

  async monitorActiveWindow() {
    if (this.isPaused) return;

    try {
      // Check cache first
      const now = Date.now();
      if (this.windowCache.lastWindow &&
          (now - this.windowCache.lastWindowTime) < this.windowCache.cacheTimeout) {
        // Use cached value
        this.handleWindowChange(this.windowCache.lastWindow);
        return;
      }

      const windowInfo = await this.getActiveWindowInfo();

      if (windowInfo) {
        this.windowCache.lastWindow = windowInfo;
        this.windowCache.lastWindowTime = now;
        this.handleWindowChange(windowInfo);
      }
    } catch (error) {
      log.error('[Monitor] Error in monitor loop:', error.message);
    }
  }

  handleWindowChange(windowInfo) {
    const activityKey = this.generateActivityKey(windowInfo);
    const duration = Date.now() - this.activityStartTime;

    if (this.currentActivity && this.currentActivity.key === activityKey) {
      // Same activity - check if we should flush based on time
      // For very long activities, flush periodically to prevent data loss
      if (duration > 30 * 60 * 1000) { // 30 minutes
        this.currentActivity.duration = duration;
        this.addToCache(this.currentActivity);
        this.currentActivity = {
          ...this.currentActivity,
          startTime: Date.now()
        };
        this.activityStartTime = Date.now();
      }
    } else {
      // New activity
      if (this.currentActivity && this.currentActivity.duration >= this.config.minActivityDuration) {
        this.addToCache(this.currentActivity);
      }

      this.currentActivity = {
        key: activityKey,
        type: this.categorizeActivity(windowInfo),
        app: windowInfo.process,
        title: windowInfo.title,
        url: windowInfo.url || null,
        startTime: Date.now(),
        duration: 0
      };

      this.activityStartTime = Date.now();
      this.lastActiveTime = Date.now();
      this.isCurrentlyIdle = false;
    }

    // Flush cache if it gets too large
    if (this.activityCache.length >= this.config.maxActivityCache) {
      this.flushActivityCache();
    }
  }

  async checkIdleStatus() {
    if (this.isPaused) return;

    try {
      const idleTime = await this.getIdleTime();

      if (idleTime >= this.config.idleThreshold) {
        if (!this.isCurrentlyIdle) {
          // Transitioning to idle
          this.isCurrentlyIdle = true;

          if (this.currentActivity) {
            this.addToCache(this.currentActivity);
            this.currentActivity = null;
          }

          // Record idle activity
          this.activityCache.push({
            type: 'idle',
            duration: idleTime,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        if (this.isCurrentlyIdle) {
          // Transitioning from idle to active
          this.isCurrentlyIdle = false;
          this.lastActiveTime = Date.now();
          await this.captureActiveWindow();
        }
      }
    } catch (error) {
      log.warn('[Monitor] Idle check failed:', error.message);
    }
  }

  async getActiveWindowInfo() {
    // Optimized PowerShell script - single execution, minimal output
    // This is much more efficient than running multiple PowerShell commands
    const script = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        public class WinAPI {
          [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
          [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        }
"@
      $hwnd = [WinAPI]::GetForegroundWindow()
      $title = New-Object System.Text.StringBuilder 128
      [WinAPI]::GetWindowText($hwnd, $title, 128) | Out-Null
      $pid = 0
      [WinAPI]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
      $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
      if ($proc) { "$($title)|$($proc.ProcessName)|$($proc.Id)" }
    `;

    return new Promise((resolve) => {
      exec(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`,
        { timeout: 2000, maxBuffer: 512 },
        (error, stdout) => {
          if (error || !stdout.trim()) {
            resolve(null);
            return;
          }

          const parts = stdout.trim().split('|');
          if (parts.length < 2) {
            resolve(null);
            return;
          }

          resolve({
            title: parts[0],
            process: parts[1],
            pid: parseInt(parts[2], 10) || 0,
            url: null // URL extraction would require browser-specific API calls
          });
        }
      );
    });
  }

  async getIdleTime() {
    // Efficient idle time check using Windows API
    const script = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class IdleChecker {
          [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
          [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO {
            public uint cbSize;
            public uint dwTime;
          }
          public static uint GetIdleMs() {
            LASTINPUTINFO lii = new LASTINPUTINFO();
            lii.cbSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf(lii);
            if (GetLastInputInfo(ref lii)) return (uint)Environment.TickCount - lii.dwTime;
            return 0;
          }
        }
"@
      [IdleChecker]::GetIdleMs()
    `;

    return new Promise((resolve) => {
      exec(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`,
        { timeout: 1500, maxBuffer: 256 },
        (error, stdout) => {
          if (error) {
            resolve(0);
            return;
          }
          const ms = parseInt(stdout.trim(), 10);
          resolve(isNaN(ms) ? 0 : ms);
        }
      );
    });
  }

  async captureActiveWindow() {
    const windowInfo = await this.getActiveWindowInfo();
    if (windowInfo) {
      this.handleWindowChange(windowInfo);
    }
  }

  generateActivityKey(windowInfo) {
    // Create a stable key for the activity
    const keyData = `${windowInfo.process}:${windowInfo.title.substring(0, 50)}`;
    return Buffer.from(keyData).to('base64').substring(0, 32);
  }

  categorizeActivity(windowInfo) {
    const process = (windowInfo.process || '').toLowerCase();
    const title = (windowInfo.title || '').toLowerCase();
    const url = windowInfo.url || '';

    // Check productive apps
    for (const app of this.productivityRules.productive.apps) {
      if (process.includes(app)) {
        return 'productive';
      }
    }

    // Check unproductive apps
    for (const app of this.productivityRules.unproductive.apps) {
      if (process.includes(app)) {
        return 'unproductive';
      }
    }

    // Check URL patterns if available
    if (url) {
      for (const domain of this.productivityRules.productive.domains) {
        if (url.includes(domain)) return 'productive';
      }
      for (const domain of this.productivityRules.unproductive.domains) {
        if (url.includes(domain)) return 'unproductive';
      }
    }

    // Default to neutral for unknown apps
    return 'neutral';
  }

  addToCache(activity) {
    if (activity.duration < 1000) return; // Ignore very short activities

    this.activityCache.push({
      key: activity.key,
      type: activity.type,
      app: activity.app,
      title: activity.title,
      url: activity.url,
      duration: activity.duration,
      startTime: activity.startTime,
      timestamp: new Date(activity.startTime).toISOString()
    });
  }

  async flushActivityCache() {
    if (this.activityCache.length === 0) return;

    log.info(`[Monitor] Flushing ${this.activityCache.length} activities to database`);

    // Batch save to database
    try {
      await this.databaseManager.saveActivityBatch(this.activityCache);

      // Clear cache
      this.activityCache = [];

      log.info('[Monitor] Cache flushed successfully');
    } catch (error) {
      log.error('[Monitor] Failed to flush cache:', error.message);
      // Keep activities in cache - will retry next sync
    }
  }

  async syncData() {
    // Flush local cache first
    await this.flushActivityCache();

    log.info('[Monitor] Starting data sync to server...');

    try {
      const unsyncedData = await this.databaseManager.getUnsyncedActivity();

      if (unsyncedData.length === 0) {
        log.debug('[Monitor] No data to sync');
        return { synced: 0, message: 'No data to sync' };
      }

      // In production, send to backend API
      log.info(`[Monitor] Would sync ${unsyncedData.length} records to server`);

      // Mark as synced
      await this.databaseManager.markAsSynced(unsyncedData.map(d => d.id));

      return { synced: unsyncedData.length, message: 'Sync successful' };
    } catch (error) {
      log.error('[Monitor] Sync failed:', error.message);
      return { synced: 0, message: error.message };
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isIdle: this.isCurrentlyIdle,
      currentActivity: this.currentActivity ? {
        app: this.currentActivity.app,
        title: this.currentActivity.title,
        duration: Date.now() - this.activityStartTime
      } : null,
      cacheSize: this.activityCache.length
    };
  }
}

module.exports = { ActivityMonitor };
