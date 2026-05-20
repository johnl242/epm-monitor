import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = 'https://fcfezhoaxqroubphzzfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZmV6aG9heHFyb3VicGh6emZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDc1NzAsImV4cCI6MjA5MzYyMzU3MH0.GXjaEpjuRCM39qMkpSCPHyhEoC1nxRg-1BpQ_39q4pc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

// ── Types ──────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  slug: string;
  price_per_seat: number;
  max_seats: number | null;
  data_retention_days: number;
  features: string[];
  is_active: boolean;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  country: string | null;
  status: 'active' | 'suspended' | 'trial' | 'churned';
  license_tier: string;
  license_seats: number;
  license_expiry: string | null;
  created_at: string;
}

export interface License {
  id: string;
  company_id: string;
  license_key: string;
  tier: string;
  seats: number;
  is_active: boolean;
  expires_at: string | null;
  plan_id: string | null;
  purchase_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  company_id: string;
  plan_id: string;
  license_id: string | null;
  seats_purchased: number;
  amount_paid: number;
  currency: string;
  billing_cycle: 'monthly' | 'annual' | 'one_time';
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  started_at: string;
  expires_at: string | null;
  invoice_ref: string | null;
  notes: string | null;
  created_at: string;
}

export interface SuperAdmin {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function superAdminLogin(email: string, password: string) {
  const { data, error } = await supabase
    .from('super_admins')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .eq('is_active', true)
    .single();

  if (error || !data) return { ok: false, error: 'Invalid credentials' };

  const match = await bcrypt.compare(password, data.password_hash);
  if (!match) return { ok: false, error: 'Invalid credentials' };

  await supabase
    .from('super_admins')
    .update({ last_login: new Date().toISOString() })
    .eq('id', data.id);

  return { ok: true, admin: data as SuperAdmin };
}

// ── License key generator ──────────────────────────────────────────────────
// Format: <TIER_CHAR><YYYYMM><8 random hex> — 16 chars total, readable
export function generateLicenseKey(tier: string): string {
  const prefix = tier === 'enterprise' ? 'E' : tier === 'professional' ? 'P' : tier === 'trial' ? 'T' : 'S';
  const datePart = new Date().toISOString().slice(0, 7).replace('-', ''); // YYYYMM
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `${prefix}${datePart}${rand}`; // e.g. P2026058A3F2C1D — 15 chars
}

// ── Data helpers ───────────────────────────────────────────────────────────

export async function fetchPlans() {
  const { data, error } = await supabase.from('plans').select('*').order('price_per_seat');
  return { data: (data ?? []) as Plan[], error };
}

export async function fetchCompanies() {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: (data ?? []) as Company[], error };
}

export async function fetchCompany(id: string) {
  const { data, error } = await supabase.from('companies').select('*').eq('id', id).single();
  return { data: data as Company | null, error };
}

export async function fetchLicenses(companyId?: string) {
  let q = supabase.from('licenses').select('*').order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  return { data: (data ?? []) as License[], error };
}

export async function fetchPurchases(companyId?: string) {
  let q = supabase.from('purchases').select('*, plans(name,slug,price_per_seat)').order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  return { data: (data ?? []) as any[], error };
}

export async function fetchComputers(companyId?: string) {
  let q = supabase.from('computers').select('*').order('last_seen', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  return { data: (data ?? []) as any[], error };
}

export async function createCompany(payload: Partial<Company>) {
  const { data, error } = await supabase.from('companies').insert([payload]).select().single();
  return { data, error };
}

export async function updateCompany(id: string, payload: Partial<Company>) {
  const { data, error } = await supabase.from('companies').update(payload).eq('id', id).select().single();
  return { data, error };
}

export async function issueLicense(payload: {
  company_id: string;
  tier: string;
  seats: number;
  expires_at: string;
  plan_id: string;
  notes?: string;
  adminId: string;
}) {
  const license_key = generateLicenseKey(payload.tier);

  // Deactivate any existing active license for this company
  await supabase.from('licenses').update({ is_active: false }).eq('company_id', payload.company_id).eq('is_active', true);

  const { data: license, error: licErr } = await supabase
    .from('licenses')
    .insert([{
      company_id: payload.company_id,
      license_key,
      tier: payload.tier,
      seats: payload.seats,
      is_active: true,
      expires_at: payload.expires_at,
      plan_id: payload.plan_id,
      notes: payload.notes ?? null,
      issued_by: payload.adminId
    }])
    .select()
    .single();

  if (licErr) return { data: null, error: licErr };

  // Update company's license fields
  await supabase.from('companies').update({
    license_tier: payload.tier,
    license_seats: payload.seats,
    license_expiry: payload.expires_at,
    status: 'active'
  }).eq('id', payload.company_id);

  return { data: license as License, error: null };
}

export async function createPurchase(payload: {
  company_id: string;
  plan_id: string;
  license_id: string;
  seats_purchased: number;
  amount_paid: number;
  billing_cycle: 'monthly' | 'annual' | 'one_time';
  started_at: string;
  expires_at: string;
  invoice_ref?: string;
  notes?: string;
  adminId: string;
}) {
  const { data, error } = await supabase
    .from('purchases')
    .insert([{
      company_id: payload.company_id,
      plan_id: payload.plan_id,
      license_id: payload.license_id,
      seats_purchased: payload.seats_purchased,
      amount_paid: payload.amount_paid,
      billing_cycle: payload.billing_cycle,
      status: 'active',
      started_at: payload.started_at,
      expires_at: payload.expires_at,
      invoice_ref: payload.invoice_ref ?? null,
      notes: payload.notes ?? null,
      created_by: payload.adminId
    }])
    .select()
    .single();

  if (!error && data) {
    // back-link purchase to license
    await supabase.from('licenses').update({ purchase_id: data.id }).eq('id', payload.license_id);
  }

  return { data, error };
}

export async function revokeLicense(licenseId: string) {
  const { error } = await supabase.from('licenses').update({ is_active: false }).eq('id', licenseId);
  return { error };
}

export async function fetchDashboardStats() {
  const [companies, licenses, purchases, computers] = await Promise.all([
    supabase.from('companies').select('id, status, created_at'),
    supabase.from('licenses').select('id, tier, seats, is_active, expires_at'),
    supabase.from('purchases').select('id, amount_paid, status, seats_purchased'),
    supabase.from('computers').select('id, last_seen')
  ]);

  const now = new Date();
  const allCompanies = companies.data ?? [];
  const allLicenses  = licenses.data  ?? [];
  const allPurchases = purchases.data ?? [];
  const allComputers = computers.data ?? [];

  const activeCompanies  = allCompanies.filter(c => c.status === 'active').length;
  const activeLicenses   = allLicenses.filter(l => l.is_active).length;
  const expiringSoon     = allLicenses.filter(l => {
    if (!l.expires_at || !l.is_active) return false;
    const diff = (new Date(l.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 30;
  }).length;
  const totalRevenue     = allPurchases.filter(p => p.status === 'active').reduce((s, p) => s + Number(p.amount_paid), 0);
  const totalSeats       = allPurchases.filter(p => p.status === 'active').reduce((s, p) => s + p.seats_purchased, 0);
  const activeComputers  = allComputers.filter(c => {
    const diff = (now.getTime() - new Date(c.last_seen).getTime()) / (1000 * 60);
    return diff <= 15;
  }).length;

  return {
    totalCompanies: allCompanies.length,
    activeCompanies,
    activeLicenses,
    expiringSoon,
    totalRevenue,
    totalSeats,
    totalComputers: allComputers.length,
    activeComputers
  };
}
