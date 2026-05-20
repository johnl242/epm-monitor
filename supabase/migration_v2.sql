-- ============================================
-- EPM Commercial - Schema Migration v2
-- Run this in Supabase SQL Editor AFTER schema.sql
-- ============================================

-- ============================================
-- PLANS TABLE (product catalog)
-- ============================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  price_per_seat DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_seats INTEGER,
  data_retention_days INTEGER DEFAULT 7,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);

-- Seed default plans
INSERT INTO plans (name, slug, price_per_seat, max_seats, data_retention_days, features) VALUES
  ('Trial',        'trial',        0,     5,   14,  '["Basic activity monitoring","App usage tracking","14-day trial","Web dashboard"]'),
  ('Starter',      'starter',      5.00,  10,  7,   '["Basic activity monitoring","App usage tracking","7-day data retention","Web dashboard"]'),
  ('Professional', 'professional', 10.00, 50,  30,  '["Full activity monitoring","Browser URL tracking","30-day data retention","Advanced reports","Productivity rules","CSV export"]'),
  ('Enterprise',   'enterprise',   15.00, 999, 365, '["Everything in Professional","Unlimited data retention","Uninstall protection","Priority support","Custom integrations","API access"]')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- SUPER ADMINS TABLE (platform-level admins)
-- ============================================
CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email);

-- Default super admin: email=admin@epm.io  password=Admin@123
-- Hash generated with bcrypt 12 rounds — change this password immediately after setup
INSERT INTO super_admins (email, password_hash, name) VALUES
  ('admin@epm.io',
   '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'EPM Super Admin')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- PURCHASES TABLE (billing records)
-- ============================================
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
  seats_purchased INTEGER NOT NULL DEFAULT 1,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  billing_cycle VARCHAR(20) DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'annual', 'one_time')),
  status VARCHAR(50) DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  invoice_ref VARCHAR(100),
  notes TEXT,
  created_by UUID REFERENCES super_admins(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_company  ON purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_purchases_license  ON purchases(license_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status   ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_plan     ON purchases(plan_id);

-- ============================================
-- ALTER EXISTING TABLES — add missing columns
-- ============================================

-- companies: contact & status fields
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_name  VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address       TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country       VARCHAR(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS status        VARCHAR(50) DEFAULT 'active'
  CHECK (status IN ('active', 'suspended', 'trial', 'churned'));

-- licenses: link to plan and purchase
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS plan_id     UUID REFERENCES plans(id);
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES purchases(id);
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS notes       TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS issued_by   UUID REFERENCES super_admins(id);

-- computers: os column (the supabase-client.js already sends it but column may be missing)
ALTER TABLE computers ADD COLUMN IF NOT EXISTS os VARCHAR(100) DEFAULT 'Windows';
ALTER TABLE computers ADD COLUMN IF NOT EXISTS license_key VARCHAR(50);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases    ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read plans"        ON plans        FOR SELECT USING (true);
CREATE POLICY "Public can read purchases"    ON purchases    FOR SELECT USING (true);
CREATE POLICY "Public can insert purchases"  ON purchases    FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update purchases"  ON purchases    FOR UPDATE USING (true);
CREATE POLICY "Public can read super_admins" ON super_admins FOR SELECT USING (true);
CREATE POLICY "Public can update super_admins" ON super_admins FOR UPDATE USING (true);
CREATE POLICY "Public can insert plans"      ON plans        FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update plans"      ON plans        FOR UPDATE USING (true);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER VIEWS
-- ============================================

-- Platform-wide dashboard view (used by super admin panel)
CREATE OR REPLACE VIEW admin_overview AS
SELECT
  c.id                                            AS company_id,
  c.name                                          AS company_name,
  c.contact_email,
  c.status                                        AS company_status,
  c.created_at                                    AS company_created_at,
  l.license_key,
  l.tier,
  l.seats,
  l.is_active                                     AS license_active,
  l.expires_at                                    AS license_expires_at,
  p.name                                          AS plan_name,
  p.price_per_seat,
  pu.seats_purchased,
  pu.amount_paid,
  pu.billing_cycle,
  pu.status                                       AS purchase_status,
  pu.started_at,
  pu.expires_at                                   AS purchase_expires_at,
  COUNT(DISTINCT co.id)                           AS computers_registered,
  COUNT(DISTINCT u.id) FILTER (WHERE u.role != 'super_admin') AS admin_users
FROM companies c
LEFT JOIN licenses     l  ON l.company_id = c.id  AND l.is_active = true
LEFT JOIN plans        p  ON p.id = l.plan_id
LEFT JOIN purchases    pu ON pu.license_id = l.id AND pu.status = 'active'
LEFT JOIN computers    co ON co.company_id = c.id
LEFT JOIN users        u  ON u.company_id = c.id
GROUP BY c.id, c.name, c.contact_email, c.status, c.created_at,
         l.license_key, l.tier, l.seats, l.is_active, l.expires_at,
         p.name, p.price_per_seat,
         pu.seats_purchased, pu.amount_paid, pu.billing_cycle,
         pu.status, pu.started_at, pu.expires_at;
