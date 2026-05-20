/**
 * EPM Commercial - Authentication Manager
 * Handles password protection and verification
 */

const bcrypt = require('bcryptjs');
const log = require('electron-log');

class AuthManager {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
    this.saltRounds = 12;
    this.passwordHash = null;
    this.failedAttempts = 0;
    this.maxFailedAttempts = 5;
    this.lockoutDuration = 5 * 60 * 1000; // 5 minutes
    this.lastFailedAttempt = null;
  }

  async needsSetup() {
    const password = this.databaseManager.getSetting('password_hash');
    return !password;
  }

  async setupPassword(password) {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Hash password
    const hash = await bcrypt.hash(password, this.saltRounds);

    // Store in database (using secure storage in production)
    this.databaseManager.setSetting('password_hash', hash);
    this.passwordHash = hash;

    log.info('Password set successfully');
    return true;
  }

  async verifyPassword(password) {
    // Check if locked out
    if (this.isLockedOut()) {
      const remainingTime = Math.ceil((this.lockoutDuration - (Date.now() - this.lastFailedAttempt)) / 1000);
      throw new Error(`Account locked. Try again in ${remainingTime} seconds.`);
    }

    // Get stored hash
    const storedHash = this.databaseManager.getSetting('password_hash');

    if (!storedHash) {
      throw new Error('Password not set');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, storedHash);

    if (!isValid) {
      this.failedAttempts++;
      this.lastFailedAttempt = Date.now();

      if (this.failedAttempts >= this.maxFailedAttempts) {
        this.databaseManager.setSetting('account_locked_until', Date.now() + this.lockoutDuration);
        throw new Error(`Too many failed attempts. Account locked for ${this.lockoutDuration / 1000 / 60} minutes.`);
      }

      const remaining = this.maxFailedAttempts - this.failedAttempts;
      throw new Error(`Invalid password. ${remaining} attempts remaining.`);
    }

    // Reset failed attempts on success
    this.failedAttempts = 0;
    this.lastFailedAttempt = null;

    return true;
  }

  isLockedOut() {
    const lockoutUntil = this.databaseManager.getSetting('account_locked_until');

    if (lockoutUntil && Date.now() < lockoutUntil) {
      return true;
    }

    // Clear lockout if expired
    if (lockoutUntil) {
      this.databaseManager.setSetting('account_locked_until', null);
    }

    return false;
  }

  async changePassword(oldPassword, newPassword) {
    // Verify old password first
    await this.verifyPassword(oldPassword);

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }

    if (oldPassword === newPassword) {
      throw new Error('New password must be different from old password');
    }

    // Hash and store new password
    const hash = await bcrypt.hash(newPassword, this.saltRounds);
    this.databaseManager.setSetting('password_hash', hash);
    this.passwordHash = hash;

    // Log password change
    log.info('Password changed successfully');

    return true;
  }

  isPasswordSet() {
    return !!this.databaseManager.getSetting('password_hash');
  }
}

module.exports = { AuthManager };
