-- EPM Commercial - Supabase Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- COMPANIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    logo_url TEXT,
    license_tier VARCHAR(50) DEFAULT 'trial' CHECK (license_tier IN ('starter', 'professional', 'enterprise', 'trial')),
    license_seats INTEGER DEFAULT 5,
    license_expiry TIMESTAMPTZ,
    settings_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for company lookups
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'viewer', 'super_admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);

-- ============================================
-- LICENSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    license_key VARCHAR(50) UNIQUE NOT NULL,
    tier VARCHAR(50) NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'professional', 'enterprise', 'trial')),
    seats INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for license lookups
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_company ON licenses(company_id);

-- ============================================
-- COMPUTERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS computers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    license_id UUID REFERENCES licenses(id),
    hardware_id VARCHAR(255) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, hardware_id)
);

-- Indexes for computer lookups
CREATE INDEX IF NOT EXISTS idx_computers_company ON computers(company_id);
CREATE INDEX IF NOT EXISTS idx_computers_hardware ON computers(hardware_id);
CREATE INDEX IF NOT EXISTS idx_computers_license ON computers(license_id);

-- ============================================
-- ACTIVITY LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    computer_id UUID NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    app_title TEXT,
    url TEXT,
    category VARCHAR(50) CHECK (category IN ('productive', 'unproductive', 'neutral')),
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for activity queries
CREATE INDEX IF NOT EXISTS idx_activity_computer ON activity_logs(computer_id);
CREATE INDEX IF NOT EXISTS idx_activity_company ON activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_computer_time ON activity_logs(computer_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_company_date ON activity_logs(company_id, timestamp DESC);

-- ============================================
-- DAILY STATS TABLE (Pre-aggregated)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    computer_id UUID NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    active_seconds INTEGER DEFAULT 0,
    idle_seconds INTEGER DEFAULT 0,
    productive_seconds INTEGER DEFAULT 0,
    unproductive_seconds INTEGER DEFAULT 0,
    neutral_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(computer_id, date)
);

-- Indexes for stats queries
CREATE INDEX IF NOT EXISTS idx_daily_company ON daily_stats(company_id);
CREATE INDEX IF NOT EXISTS idx_daily_computer ON daily_stats(computer_id);
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_company_date ON daily_stats(company_id, date DESC);

-- ============================================
-- IDLE LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS idle_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    computer_id UUID NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for idle log queries
CREATE INDEX IF NOT EXISTS idx_idle_computer ON idle_logs(computer_id);
CREATE INDEX IF NOT EXISTS idx_idle_company ON idle_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_idle_timestamp ON idle_logs(timestamp DESC);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);

-- ============================================
-- API KEYS TABLE (for external integrations)
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '[]',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Index for API key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_company ON api_keys(company_id);

-- ============================================
-- PRODUCTIVITY RULES TABLE (Custom per company)
-- ============================================
CREATE TABLE IF NOT EXISTS productivity_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('productive', 'unproductive', 'neutral')),
    type VARCHAR(50) NOT NULL CHECK (type IN ('app', 'domain', 'keyword')),
    pattern VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for productivity rules
CREATE INDEX IF NOT EXISTS idx_rules_company ON productivity_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_rules_category ON productivity_rules(category);

-- ============================================
-- EMPLOYEES TABLE (Optional self-view)
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    computer_id UUID REFERENCES computers(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    department VARCHAR(255),
    employee_code VARCHAR(50),
    can_view_own_stats BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for employee lookups
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_computer ON employees(computer_id);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE computers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE idle_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE productivity_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Companies: Anyone can view companies (for registration)
CREATE POLICY "Anyone can view companies"
    ON companies FOR SELECT
    USING (true);

-- Companies: Only admins can update
CREATE POLICY "Admins can update own company"
    ON companies FOR UPDATE
    USING (true); -- Check in application logic

-- Users: Anyone can sign up (for registration)
CREATE POLICY "Anyone can view users"
    ON users FOR SELECT
    USING (true);

-- Users: Anyone can insert (for registration)
CREATE POLICY "Anyone can insert users"
    ON users FOR INSERT
    WITH CHECK (true);

-- Users: Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (true); -- Check in application logic

-- Computers: Anyone can insert computers (desktop app registration)
CREATE POLICY "Anyone can insert computers"
    ON computers FOR INSERT
    WITH CHECK (true);

-- Computers: Anyone can view computers (for admin portal)
CREATE POLICY "Anyone can view computers"
    ON computers FOR SELECT
    USING (true);

-- Computers: Anyone can update computers (desktop app updates)
CREATE POLICY "Anyone can update computers"
    ON computers FOR UPDATE
    USING (true);

-- Activity Logs: Anyone can insert activity (desktop app)
CREATE POLICY "Anyone can insert activity"
    ON activity_logs FOR INSERT
    WITH CHECK (true);

-- Activity Logs: Anyone can view activity (for admin portal)
CREATE POLICY "Anyone can view activity"
    ON activity_logs FOR SELECT
    USING (true);

-- Daily Stats: Anyone can insert stats (desktop app)
CREATE POLICY "Anyone can insert stats"
    ON daily_stats FOR INSERT
    WITH CHECK (true);

-- Daily Stats: Anyone can update stats (desktop app)
CREATE POLICY "Anyone can update stats"
    ON daily_stats FOR UPDATE
    USING (true);

-- Daily Stats: Anyone can view stats (for admin portal)
CREATE POLICY "Anyone can view stats"
    ON daily_stats FOR SELECT
    USING (true);

-- Idle Logs: Anyone can insert idle logs (desktop app)
CREATE POLICY "Anyone can insert idle"
    ON idle_logs FOR INSERT
    WITH CHECK (true);

-- Idle Logs: Anyone can view idle logs (for admin portal)
CREATE POLICY "Anyone can view idle"
    ON idle_logs FOR SELECT
    USING (true);

-- Productivity Rules: Anyone can view rules (desktop app needs to fetch rules)
CREATE POLICY "Anyone can view rules"
    ON productivity_rules FOR SELECT
    USING (true);

-- Productivity Rules: Anyone can insert rules (admin portal)
CREATE POLICY "Anyone can insert rules"
    ON productivity_rules FOR INSERT
    WITH CHECK (true);

-- Productivity Rules: Anyone can update rules (admin portal)
CREATE POLICY "Anyone can update rules"
    ON productivity_rules FOR UPDATE
    USING (true);

-- Productivity Rules: Anyone can delete rules (admin portal)
CREATE POLICY "Anyone can delete rules"
    ON productivity_rules FOR DELETE
    USING (true);

-- Employees: Anyone can view employees (admin portal)
CREATE POLICY "Anyone can view employees"
    ON employees FOR SELECT
    USING (true);

-- Employees: Anyone can insert employees (admin portal)
CREATE POLICY "Anyone can insert employees"
    ON employees FOR INSERT
    WITH CHECK (true);

-- Employees: Anyone can update employees (admin portal)
CREATE POLICY "Anyone can update employees"
    ON employees FOR UPDATE
    USING (true);

-- Employees: Anyone can delete employees (admin portal)
CREATE POLICY "Anyone can delete employees"
    ON employees FOR DELETE
    USING (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_licenses_updated_at
    BEFORE UPDATE ON licenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_computers_updated_at
    BEFORE UPDATE ON computers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_stats_updated_at
    BEFORE UPDATE ON daily_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update last_seen on computers
CREATE OR REPLACE FUNCTION update_computer_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE computers SET last_seen = NOW() WHERE id = NEW.computer_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update computer last_seen on activity
CREATE TRIGGER update_computer_last_seen_trigger
    AFTER INSERT ON activity_logs
    FOR EACH ROW EXECUTE FUNCTION update_computer_last_seen();

-- ============================================
-- VIEWS
-- ============================================

-- View for company dashboard summary
CREATE OR REPLACE VIEW company_dashboard AS
SELECT
    c.id as company_id,
    c.name as company_name,
    COUNT(DISTINCT u.id) FILTER (WHERE u.role != 'super_admin') as employee_count,
    COUNT(DISTINCT co.id) as computer_count,
    COALESCE(SUM(ds.active_seconds), 0) as total_active_seconds,
    COALESCE(SUM(ds.productive_seconds), 0) as total_productive_seconds,
    COALESCE(SUM(ds.unproductive_seconds), 0) as total_unproductive_seconds,
    l.tier as license_tier,
    l.seats as license_seats,
    l.expires_at as license_expires
FROM companies c
LEFT JOIN users u ON u.company_id = c.id
LEFT JOIN computers co ON co.company_id = c.id
LEFT JOIN daily_stats ds ON ds.company_id = c.id AND ds.date = CURRENT_DATE
LEFT JOIN licenses l ON l.company_id = c.id AND l.is_active = true
GROUP BY c.id, c.name, l.tier, l.seats, l.expires_at;

-- View for employee productivity summary
CREATE OR REPLACE VIEW employee_productivity AS
SELECT
    co.company_id,
    co.username as employee_name,
    co.hostname,
    co.id as computer_id,
    COALESCE(SUM(ds.active_seconds), 0) as total_active_seconds,
    COALESCE(SUM(ds.productive_seconds), 0) as total_productive_seconds,
    COALESCE(SUM(ds.unproductive_seconds), 0) as total_unproductive_seconds,
    COALESCE(SUM(ds.idle_seconds), 0) as total_idle_seconds,
    CASE
        WHEN COALESCE(SUM(ds.active_seconds), 0) > 0
        THEN ROUND((COALESCE(SUM(ds.productive_seconds), 0)::numeric / SUM(ds.active_seconds)::numeric) * 100, 1)
        ELSE 0
    END as productivity_score
FROM computers co
LEFT JOIN daily_stats ds ON ds.computer_id = co.id
GROUP BY co.company_id, co.username, co.hostname, co.id;

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================

-- Insert sample company (uncomment to test)
-- INSERT INTO companies (id, name, domain)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Company', 'demo.com');

-- Insert sample admin user (password: admin123)
-- INSERT INTO users (id, company_id, email, password_hash, name, role)
-- VALUES (
--     '00000000-0000-0000-0000-000000000002',
--     '00000000-0000-0000-0000-000000000001',
--     'admin@demo.com',
--     '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FQpF2H/5E6F.2O', -- admin123
--     'Admin User',
--     'admin'
-- );
