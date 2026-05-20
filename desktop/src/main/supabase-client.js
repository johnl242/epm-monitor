/**
 * EPM Commercial - Supabase Client
 * Direct connection to Supabase for syncing activity data
 */

const { createClient } = require('@supabase/supabase-js');
const log = require('electron-log');

// Supabase configuration
const SUPABASE_URL = 'https://fcfezhoaxqroubphzzfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZmV6aG9heHFyb3VicGh6emZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDc1NzAsImV4cCI6MjA5MzYyMzU3MH0.GXjaEpjuRCM39qMkpSCPHyhEoC1nxRg-1BpQ_39q4pc';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

class SupabaseClient {
  constructor() {
    this.isConnected = false;
    this.lastSync = null;
    this.syncInterval = 60000; // 1 minute
    this.pendingSync = [];
  }

  /**
   * Test connection to Supabase
   */
  async testConnection() {
    try {
      const { data, error } = await supabase.from('companies').select('id').limit(1);
      if (error) {
        log.error('Supabase connection test failed:', error);
        return false;
      }
      log.info('Supabase connection successful');
      this.isConnected = true;
      return true;
    } catch (error) {
      log.error('Supabase connection error:', error);
      return false;
    }
  }

  /**
   * Register a new computer with the server
   */
  async registerComputer(computerData) {
    try {
      const { data, error } = await supabase
        .from('computers')
        .upsert([{
          id:          computerData.id,
          company_id:  computerData.companyId,
          license_id:  computerData.licenseId  ?? null,
          license_key: computerData.licenseKey ?? null,
          hostname:    computerData.hostname,
          username:    computerData.username,
          hardware_id: computerData.hardwareId,
          os:          computerData.os || 'Windows',
          last_seen:   new Date().toISOString()
        }], {
          onConflict: 'id'
        });

      if (error) {
        log.error('Failed to register computer:', error);
        return { success: false, error: error.message };
      }

      log.info('Computer registered successfully');
      return { success: true };
    } catch (error) {
      log.error('Computer registration error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync activity logs to Supabase
   */
  async syncActivityLogs(activities) {
    if (!activities || activities.length === 0) {
      return { synced: 0 };
    }

    try {
      const records = activities.map(activity => ({
        id: activity.id || crypto.randomUUID(),
        computer_id: activity.computer_id,
        timestamp: activity.timestamp,
        app_name: activity.app_name,
        app_title: activity.app_title,
        url: activity.url,
        category: activity.category,
        duration_seconds: activity.duration_seconds,
        synced: true
      }));

      const { data, error } = await supabase
        .from('activity_logs')
        .upsert(records, {
          onConflict: 'id'
        });

      if (error) {
        log.error('Failed to sync activity logs:', error);
        return { synced: 0, error: error.message };
      }

      log.info(`Synced ${activities.length} activity logs to Supabase`);
      this.lastSync = new Date();
      return { synced: activities.length };
    } catch (error) {
      log.error('Activity sync error:', error);
      return { synced: 0, error: error.message };
    }
  }

  /**
   * Sync idle logs to Supabase
   */
  async syncIdleLogs(idleLogs) {
    if (!idleLogs || idleLogs.length === 0) {
      return { synced: 0 };
    }

    try {
      const records = idleLogs.map(idle => ({
        id: idle.id || crypto.randomUUID(),
        computer_id: idle.computer_id,
        timestamp: idle.timestamp,
        duration_seconds: idle.duration_seconds,
        synced: true
      }));

      const { data, error } = await supabase
        .from('idle_logs')
        .upsert(records, {
          onConflict: 'id'
        });

      if (error) {
        log.error('Failed to sync idle logs:', error);
        return { synced: 0, error: error.message };
      }

      log.info(`Synced ${idleLogs.length} idle logs to Supabase`);
      return { synced: idleLogs.length };
    } catch (error) {
      log.error('Idle sync error:', error);
      return { synced: 0, error: error.message };
    }
  }

  /**
   * Get productivity rules for this company
   */
  async getProductivityRules(companyId) {
    try {
      const { data, error } = await supabase
        .from('productivity_rules')
        .select('*')
        .eq('company_id', companyId);

      if (error) {
        log.error('Failed to get productivity rules:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      log.error('Get rules error:', error);
      return [];
    }
  }

  /**
   * Validate a license key against Supabase (called during registration).
   * Also registers this computer as a seat if the key is valid and seats remain.
   */
  async validateAndRegisterLicense(licenseKey) {
    try {
      const { data: license, error } = await supabase
        .from('licenses')
        .select('*, companies(id, name, license_tier, license_seats, license_expiry, status)')
        .eq('license_key', licenseKey)
        .eq('is_active', true)
        .single();

      if (error || !license) {
        return { valid: false, message: 'License key not found or inactive.' };
      }

      if (license.expires_at && new Date(license.expires_at) < new Date()) {
        return { valid: false, message: 'License has expired. Please renew.' };
      }

      const company = license.companies;
      if (company?.status === 'suspended') {
        return { valid: false, message: 'Account suspended. Contact support.' };
      }

      // Count seats already used (computers registered under this license)
      const { count: seatsUsed } = await supabase
        .from('computers')
        .select('id', { count: 'exact', head: true })
        .eq('license_id', license.id);

      const used = seatsUsed ?? 0;
      if (used >= license.seats) {
        return {
          valid: false,
          message: `Seat limit reached (${used}/${license.seats}). Ask your admin to add more seats.`
        };
      }

      return {
        valid:     true,
        licenseId: license.id,
        companyId: company?.id,
        tier:      license.tier,
        seats:     license.seats,
        seatsUsed: used,
        expiresAt: license.expires_at
      };
    } catch (err) {
      log.error('validateAndRegisterLicense error:', err);
      return { valid: false, message: 'Network error during license validation.' };
    }
  }

  /**
   * Validate an already-registered license key (periodic re-check).
   * Does NOT register a new seat — just checks validity + seat count.
   */
  async validateLicenseKey(licenseKey) {
    try {
      const { data: license, error } = await supabase
        .from('licenses')
        .select('id, tier, seats, is_active, expires_at, company_id')
        .eq('license_key', licenseKey)
        .single();

      if (error || !license) return { valid: false, message: 'License not found.' };
      if (!license.is_active)  return { valid: false, message: 'License has been revoked.' };
      if (license.expires_at && new Date(license.expires_at) < new Date()) {
        return { valid: false, message: 'License has expired.' };
      }

      const { count } = await supabase
        .from('computers')
        .select('id', { count: 'exact', head: true })
        .eq('license_id', license.id);

      return {
        valid:     true,
        licenseId: license.id,
        companyId: license.company_id,
        tier:      license.tier,
        seats:     license.seats,
        seatsUsed: count ?? 0,
        expiresAt: license.expires_at
      };
    } catch (err) {
      log.error('validateLicenseKey error:', err);
      throw err; // let license.js handle offline fallback
    }
  }

  /**
   * Get license info for this computer
   */
  async getLicenseStatus(computerId) {
    try {
      const { data, error } = await supabase
        .from('computers')
        .select(`
          *,
          companies (
            id,
            name,
            license_tier,
            license_seats,
            license_expiry
          )
        `)
        .eq('id', computerId)
        .single();

      if (error) {
        log.error('Failed to get license status:', error);
        return { valid: false, error: error.message };
      }

      if (!data) {
        return { valid: false, error: 'Computer not registered' };
      }

      const company = data.companies;
      const seatsUsed = data.companies?.computers?.length || 1;
      const seatsAllowed = company.license_seats || 10;

      // Check if license is valid
      const isValid =
        company.license_expiry &&
        new Date(company.license_expiry) > new Date() &&
        seatsUsed <= seatsAllowed;

      return {
        valid: isValid,
        companyId: company.id,
        companyName: company.name,
        licenseTier: company.license_tier,
        licenseSeats: seatsAllowed,
        seatsUsed: seatsUsed,
        expiresAt: company.license_expiry
      };
    } catch (error) {
      log.error('License check error:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Verify company admin credentials
   */
  async verifyAdminCredentials(email, password) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          companies (
            id,
            name,
            license_tier
          )
        `)
        .eq('email', email)
        .eq('role', 'admin')
        .single();

      if (error || !data) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Note: In production, use Supabase Auth for proper authentication
      // This is a simplified version for demo purposes
      const bcrypt = require('bcryptjs');
      const passwordMatch = await bcrypt.compare(password, data.password_hash);

      if (!passwordMatch) {
        return { success: false, error: 'Invalid credentials' };
      }

      return {
        success: true,
        user: {
          id: data.id,
          email: data.email,
          name: data.name,
          companyId: data.company_id,
          companyName: data.companies?.name
        }
      };
    } catch (error) {
      log.error('Auth error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new employee record
   */
  async createEmployee(employeeData) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .insert([{
          id: employeeData.id,
          company_id: employeeData.companyId,
          computer_id: employeeData.computerId,
          name: employeeData.name,
          email: employeeData.email,
          department: employeeData.department,
          is_active: true
        }])
        .select()
        .single();

      if (error) {
        log.error('Failed to create employee:', error);
        return { success: false, error: error.message };
      }

      return { success: true, employee: data };
    } catch (error) {
      log.error('Create employee error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get employees for a company
   */
  async getEmployees(companyId) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', companyId);

      if (error) {
        log.error('Failed to get employees:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      log.error('Get employees error:', error);
      return [];
    }
  }

  /**
   * Update last seen timestamp
   */
  async updateComputerStatus(computerId) {
    try {
      const { error } = await supabase
        .from('computers')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', computerId);

      if (error) {
        log.error('Failed to update computer status:', error);
      }
    } catch (error) {
      log.error('Update status error:', error);
    }
  }
}

// Export singleton instance
module.exports = { SupabaseClient, supabase };
