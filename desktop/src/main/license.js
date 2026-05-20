/**
 * EPM Commercial - License Manager
 * Validates license keys against Supabase; enforces seat limits.
 */

const crypto = require('crypto');
const log = require('electron-log');

class LicenseManager {
  constructor(databaseManager, supabaseClient) {
    this.databaseManager = databaseManager;
    this.supabaseClient  = supabaseClient; // SupabaseClient instance
    this.isValid = false;
    this.licenseInfo = {};
    this.lastValidation = null;
    this.CACHE_MS = 60 * 60 * 1000; // 1 hour
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async validateLicense() {
    // Serve from cache if fresh
    if (this.lastValidation && (Date.now() - this.lastValidation) < this.CACHE_MS) {
      return { valid: this.isValid, message: 'cached', info: this.licenseInfo };
    }

    const stored = this.databaseManager.getSetting('license');
    if (!stored) return this._invalid('No license key. Enter your license key to activate.');

    let license;
    try { license = typeof stored === 'string' ? JSON.parse(stored) : stored; }
    catch { return this._invalid('Stored license is corrupt. Please re-register.'); }

    // Local expiry quick-check before hitting the network
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return this._invalid('License expired. Please renew.');
    }

    // Always validate with server (falls back gracefully if offline)
    return this._validateWithServer(license);
  }

  async register(licenseKey) {
    if (!licenseKey || typeof licenseKey !== 'string') {
      throw new Error('License key is required.');
    }
    const key = licenseKey.trim().toUpperCase();
    if (key.length < 10) throw new Error('Invalid license key format.');

    log.info('Registering license:', key);

    // Validate against Supabase and get license record
    const result = await this.supabaseClient.validateAndRegisterLicense(key);
    if (!result.valid) throw new Error(result.message ?? 'License validation failed.');

    const license = {
      key,
      company_id:   result.companyId,
      hardware_id:  await this.databaseManager.getHardwareId(),
      seats:        result.seats,
      tier:         result.tier,
      expires_at:   result.expiresAt,
      registered_at: new Date().toISOString()
    };

    this.databaseManager.setSetting('license', JSON.stringify(license));
    this.licenseInfo = this._buildInfo(key, result);
    this.isValid = true;
    this.lastValidation = Date.now();

    log.info('License registered:', key, 'tier:', result.tier, 'seats:', result.seats);
    return { valid: true, info: this.licenseInfo };
  }

  async unregister() {
    this.databaseManager.setSetting('license', null);
    this._reset();
    log.info('License unregistered');
  }

  getLicenseInfo()          { return this.licenseInfo; }
  isLicenseValid()          { return this.isValid; }

  isExpiringSoon(days = 7) {
    if (!this.licenseInfo.expiresAt) return false;
    const thresh = new Date();
    thresh.setDate(thresh.getDate() + days);
    return new Date(this.licenseInfo.expiresAt) <= thresh;
  }

  async generateTrialLicense() {
    const key = 'T' + crypto.randomBytes(7).toString('hex').toUpperCase(); // 15 chars
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const trial = {
      key,
      company_id:    null,
      hardware_id:   await this.databaseManager.getHardwareId(),
      seats:         3,
      tier:          'trial',
      expires_at:    expiresAt,
      registered_at: new Date().toISOString()
    };
    this.databaseManager.setSetting('license', JSON.stringify(trial));
    this.licenseInfo = { key, seats: 3, seatsUsed: 1, tier: 'trial', expiresAt, companyId: null };
    this.isValid = true;
    this.lastValidation = Date.now();
    log.info('Trial license generated:', key);
    return trial;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  async _validateWithServer(license) {
    try {
      const result = await this.supabaseClient.validateLicenseKey(license.key);

      if (!result.valid) return this._invalid(result.message ?? 'License not valid.');

      // Hardware binding check (skip for trial tier)
      if (license.hardware_id && result.tier !== 'trial') {
        const currentHwId = await this.databaseManager.getHardwareId();
        if (license.hardware_id !== currentHwId) {
          return this._invalid('License is bound to a different machine. Contact your administrator.');
        }
      }

      this.licenseInfo = this._buildInfo(license.key, result);
      this.isValid = true;
      this.lastValidation = Date.now();

      // Update stored license with fresh server data
      const updated = { ...license, seats: result.seats, tier: result.tier, expires_at: result.expiresAt };
      this.databaseManager.setSetting('license', JSON.stringify(updated));

      if (result.seatsUsed >= result.seats) {
        return { valid: true, warning: true, message: 'Seat limit reached. Contact your admin to add seats.', info: this.licenseInfo };
      }
      return { valid: true, info: this.licenseInfo };

    } catch (err) {
      log.warn('Server validation failed, falling back to cached info:', err.message);
      // Offline fallback: trust the local stored license
      this.isValid = true;
      this.licenseInfo = {
        key:       license.key,
        seats:     license.seats ?? 1,
        seatsUsed: 1,
        tier:      license.tier ?? 'starter',
        expiresAt: license.expires_at,
        companyId: license.company_id
      };
      this.lastValidation = Date.now();
      return { valid: true, offline: true, message: 'Offline — using cached license.', info: this.licenseInfo };
    }
  }

  _buildInfo(key, result) {
    return {
      key,
      seats:     result.seats,
      seatsUsed: result.seatsUsed ?? 1,
      tier:      result.tier,
      expiresAt: result.expiresAt,
      companyId: result.companyId
    };
  }

  _invalid(message) {
    this._reset();
    return { valid: false, message };
  }

  _reset() {
    this.isValid = false;
    this.licenseInfo = {};
    this.lastValidation = null;
  }
}

module.exports = { LicenseManager };
