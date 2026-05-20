-- EPM Landing site supporting tables
-- Run via Supabase Management API or SQL Editor

-- Purchase leads (from landing page buy modal)
CREATE TABLE IF NOT EXISTS purchase_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  email text NOT NULL,
  plan text NOT NULL,
  seats integer NOT NULL DEFAULT 1,
  payment_method text,
  amount_monthly numeric(10,2),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Download releases (managed from admin panel)
CREATE TABLE IF NOT EXISTS download_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'windows',
  version text NOT NULL,
  download_url text NOT NULL,
  is_latest boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- App settings (key-value store for admin panel)
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add contact fields to companies if not already present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='contact_phone') THEN
    ALTER TABLE companies ADD COLUMN contact_phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='status') THEN
    ALTER TABLE companies ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- Add price_per_seat to licenses if not already present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licenses' AND column_name='price_per_seat') THEN
    ALTER TABLE licenses ADD COLUMN price_per_seat numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licenses' AND column_name='plan_id') THEN
    ALTER TABLE licenses ADD COLUMN plan_id text;
  END IF;
END $$;

-- RLS policies for landing page tables
ALTER TABLE purchase_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert purchase leads (from landing page)
DROP POLICY IF EXISTS "insert_leads" ON purchase_leads;
CREATE POLICY "insert_leads" ON purchase_leads FOR INSERT WITH CHECK (true);

-- Allow anyone to read download releases (public download links)
DROP POLICY IF EXISTS "read_releases" ON download_releases;
CREATE POLICY "read_releases" ON download_releases FOR SELECT USING (true);

-- Allow insert/update for download_releases (admin panel uses service role or anon for now)
DROP POLICY IF EXISTS "manage_releases" ON download_releases;
CREATE POLICY "manage_releases" ON download_releases FOR ALL USING (true);

-- Allow app_settings access for admin
DROP POLICY IF EXISTS "manage_settings" ON app_settings;
CREATE POLICY "manage_settings" ON app_settings FOR ALL USING (true);

-- Seed initial download release (update URL when EXE is available)
INSERT INTO download_releases (platform, version, download_url, is_latest)
VALUES ('windows', '1.0.0', 'https://github.com/your-org/epm-monitor/releases/download/v1.0.0/EPM-Monitor-Setup-1.0.0.exe', true)
ON CONFLICT DO NOTHING;
