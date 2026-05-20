/**
 * EPM Commercial - Database Manager
 * Handles local SQLite database operations
 */

const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const log = require('electron-log');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.computerId = null;
  }

  async initialize() {
    try {
      // Get user data path
      const userDataPath = app.getPath('userData');
      this.dbPath = path.join(userDataPath, 'epm_data.db');

      log.info('Database path:', this.dbPath);

      // Open database
      this.db = new Database(this.dbPath);

      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');

      // Create tables
      await this.createTables();

      // Get or generate computer ID
      this.computerId = await this.getOrCreateComputerId();

      log.info('Database initialized with computer ID:', this.computerId);
    } catch (error) {
      log.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async createTables() {
    // Computer info table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS computer_info (
        id TEXT PRIMARY KEY,
        hostname TEXT NOT NULL,
        username TEXT NOT NULL,
        hardware_id TEXT NOT NULL,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL
      )
    `);

    // Activity logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        computer_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        app_name TEXT NOT NULL,
        app_title TEXT,
        url TEXT,
        category TEXT,
        duration_seconds INTEGER NOT NULL,
        screenshot_hash TEXT,
        synced INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (computer_id) REFERENCES computer_info(id)
      )
    `);

    // Idle time table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS idle_logs (
        id TEXT PRIMARY KEY,
        computer_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        synced INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (computer_id) REFERENCES computer_info(id)
      )
    `);

    // Settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Daily stats table (pre-aggregated for quick queries)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id TEXT PRIMARY KEY,
        computer_id TEXT NOT NULL,
        date TEXT NOT NULL,
        active_seconds INTEGER DEFAULT 0,
        idle_seconds INTEGER DEFAULT 0,
        productive_seconds INTEGER DEFAULT 0,
        unproductive_seconds INTEGER DEFAULT 0,
        neutral_seconds INTEGER DEFAULT 0,
        synced INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(computer_id, date)
      )
    `);

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activity_computer_time
      ON activity_logs(computer_id, timestamp DESC)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activity_synced
      ON activity_logs(synced) WHERE synced = 0
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_daily_stats_date
      ON daily_stats(date DESC)
    `);

    log.info('Database tables created');
  }

  async getOrCreateComputerId() {
    // Try to get existing computer ID
    const existing = this.db.prepare('SELECT id FROM computer_info LIMIT 1').get();

    if (existing) {
      // Update last seen
      this.db.prepare('UPDATE computer_info SET last_seen = ? WHERE id = ?')
        .run(new Date().toISOString(), existing.id);
      return existing.id;
    }

    // Generate new computer ID
    const computerId = uuidv4();
    const hostname = require('os').hostname();
    const username = require('os').userInfo().username;
    const hardwareId = await this.getHardwareId();

    this.db.prepare(`
      INSERT INTO computer_info (id, hostname, username, hardware_id, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(computerId, hostname, username, hardwareId, new Date().toISOString(), new Date().toISOString());

    return computerId;
  }

  async getHardwareId() {
    // Generate hardware ID based on CPU and disk serials
    // In production, use more robust hardware identification
    const cpuInfo = await this.getCpuInfo();
    const diskInfo = await this.getDiskInfo();

    const combined = `${cpuInfo}-${diskInfo}`;
    return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 32);
  }

  async getCpuInfo() {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      exec('wmic cpu get ProcessorId', { timeout: 5000 }, (error, stdout) => {
        if (error) {
          resolve(require('os').cpus()[0].model);
          return;
        }
        const lines = stdout.trim().split('\n');
        resolve(lines[1] || require('os').cpus()[0].model);
      });
    });
  }

  async getDiskInfo() {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      exec('wmic diskdrive get SerialNumber', { timeout: 5000 }, (error, stdout) => {
        if (error) {
          resolve('default-disk');
          return;
        }
        const lines = stdout.trim().split('\n');
        resolve(lines[1] || 'default-disk');
      });
    });
  }

  getComputerId() {
    return this.computerId;
  }

  async saveActivityBatch(activities) {
    if (!activities || activities.length === 0) return 0;

    const insert = this.db.prepare(`
      INSERT INTO activity_logs (id, computer_id, timestamp, app_name, app_title, url, category, duration_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStats = this.db.transaction((activities) => {
      for (const activity of activities) {
        insert.run(
          uuidv4(),
          this.computerId,
          activity.timestamp,
          activity.app,
          activity.title,
          activity.url,
          activity.type,
          Math.floor(activity.duration / 1000)
        );
      }
    });

    updateStats(activities);
    return activities.length;
  }

  async saveActivity(activity) {
    const id = uuidv4();

    this.db.prepare(`
      INSERT INTO activity_logs (id, computer_id, timestamp, app_name, app_title, url, category, duration_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      this.computerId,
      activity.timestamp,
      activity.app_name,
      activity.app_title,
      activity.url,
      activity.category,
      activity.duration_seconds
    );

    // Update daily stats
    await this.updateDailyStats(activity);

    return id;
  }

  async updateDailyStats(activity) {
    const date = activity.timestamp.split('T')[0];
    const category = activity.category + '_seconds';

    // Use UPSERT pattern
    const existing = this.db.prepare(`
      SELECT id FROM daily_stats WHERE computer_id = ? AND date = ?
    `).get(this.computerId, date);

    if (existing) {
      this.db.prepare(`
        UPDATE daily_stats
        SET
          active_seconds = active_seconds + ?,
          ${category} = ${category} + ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        activity.duration_seconds,
        activity.duration_seconds,
        new Date().toISOString(),
        existing.id
      );
    } else {
      const insertData = {
        active: activity.duration_seconds,
        productive: activity.category === 'productive' ? activity.duration_seconds : 0,
        unproductive: activity.category === 'unproductive' ? activity.duration_seconds : 0,
        neutral: activity.category === 'neutral' ? activity.duration_seconds : 0
      };

      this.db.prepare(`
        INSERT INTO daily_stats (id, computer_id, date, active_seconds, productive_seconds, unproductive_seconds, neutral_seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        this.computerId,
        date,
        insertData.active,
        insertData.productive,
        insertData.unproductive,
        insertData.neutral
      );
    }
  }

  async saveIdleTime(idle) {
    const id = uuidv4();

    this.db.prepare(`
      INSERT INTO idle_logs (id, computer_id, timestamp, duration_seconds)
      VALUES (?, ?, ?, ?)
    `).run(id, this.computerId, idle.timestamp, idle.duration_seconds);

    // Update daily stats
    const date = idle.timestamp.split('T')[0];
    const existing = this.db.prepare(`
      SELECT id, idle_seconds FROM daily_stats WHERE computer_id = ? AND date = ?
    `).get(this.computerId, date);

    if (existing) {
      this.db.prepare(`
        UPDATE daily_stats SET idle_seconds = idle_seconds + ?, updated_at = ? WHERE id = ?
      `).run(idle.duration_seconds, new Date().toISOString(), existing.id);
    }
  }

  /**
   * Sync activity logs to Supabase
   */
  async syncActivityLogsToCloud(supabaseClient) {
    const unsyncedActivity = await this.getUnsyncedActivity(100);

    if (unsyncedActivity.length === 0) {
      return { synced: 0, message: 'No data to sync' };
    }

    try {
      const records = unsyncedActivity.map(activity => ({
        id: activity.id,
        computer_id: activity.computer_id,
        timestamp: activity.timestamp,
        app_name: activity.app_name,
        app_title: activity.app_title,
        url: activity.url,
        category: activity.category,
        duration_seconds: activity.duration_seconds
      }));

      const { data, error } = await supabaseClient.syncActivityLogs(records);

      if (error) {
        log.error('Failed to sync activity logs:', error);
        return { synced: 0, message: error };
      }

      // Mark as synced
      await this.markAsSynced(unsyncedActivity.map(d => d.id));
      log.info(`Synced ${unsyncedActivity.length} activity records to cloud`);

      return { synced: unsyncedActivity.length, message: 'Sync successful' };
    } catch (error) {
      log.error('Sync error:', error);
      return { synced: 0, message: error.message };
    }
  }

  async getUnsyncedActivity(limit = 100) {
    return this.db.prepare(`
      SELECT * FROM activity_logs WHERE synced = 0 ORDER BY timestamp ASC LIMIT ?
    `).all(limit);
  }

  async markAsSynced(ids) {
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    this.db.prepare(`
      UPDATE activity_logs SET synced = 1 WHERE id IN (${placeholders})
    `).run(...ids);
  }

  async getRecentActivity(limit = 50) {
    return this.db.prepare(`
      SELECT * FROM activity_logs
      WHERE computer_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(this.computerId, limit);
  }

  async getDailyStats(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.db.prepare(`
      SELECT * FROM daily_stats
      WHERE computer_id = ? AND date >= ?
      ORDER BY date DESC
    `).all(this.computerId, startDate.toISOString().split('T')[0]);
  }

  async getActivitySummary(date = null) {
    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }

    const stats = this.db.prepare(`
      SELECT
        SUM(active_seconds) as total_active,
        SUM(idle_seconds) as total_idle,
        SUM(productive_seconds) as total_productive,
        SUM(unproductive_seconds) as total_unproductive,
        SUM(neutral_seconds) as total_neutral
      FROM daily_stats
      WHERE computer_id = ? AND date = ?
    `).get(this.computerId, date);

    return stats || {
      total_active: 0,
      total_idle: 0,
      total_productive: 0,
      total_unproductive: 0,
      total_neutral: 0
    };
  }

  async getTopApps(days = 1, limit = 10) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.db.prepare(`
      SELECT
        app_name,
        SUM(duration_seconds) as total_duration
      FROM activity_logs
      WHERE computer_id = ? AND timestamp >= ?
      GROUP BY app_name
      ORDER BY total_duration DESC
      LIMIT ?
    `).all(this.computerId, startDate.toISOString(), limit);
  }

  getSetting(key, defaultValue = null) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (row) {
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    }
    return defaultValue;
  }

  setSetting(key, value) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?
    `).run(key, stringValue, stringValue);
  }

  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = { DatabaseManager };
