import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Key, ShoppingCart, Settings, LogOut,
  Plus, RefreshCw, Eye, EyeOff, Copy, Check, AlertTriangle,
  TrendingUp, Users, Monitor, CreditCard, Shield, ChevronRight,
  Calendar, ToggleLeft, ToggleRight, X, Search, Filter, Download
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, isWithinInterval, addDays } from 'date-fns';
import {
  supabase, superAdminLogin, fetchPlans, fetchCompanies, fetchCompany,
  fetchLicenses, fetchPurchases, fetchComputers, createCompany, updateCompany,
  issueLicense, createPurchase, revokeLicense, fetchDashboardStats,
  generateLicenseKey,
  type SuperAdmin, type Plan, type Company, type License, type Purchase
} from './lib/supabase';

// ── Auth Context ───────────────────────────────────────────────────────────

interface AuthCtx { admin: SuperAdmin | null; login: (e: string, p: string) => Promise<string | null>; logout: () => void; }
const AuthContext = createContext<AuthCtx | null>(null);
const useAdmin = () => useContext(AuthContext)!;

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<SuperAdmin | null>(() => {
    const s = sessionStorage.getItem('epm_admin');
    return s ? JSON.parse(s) : null;
  });

  const login = async (email: string, password: string) => {
    const res = await superAdminLogin(email, password);
    if (!res.ok) return res.error!;
    setAdmin(res.admin!);
    sessionStorage.setItem('epm_admin', JSON.stringify(res.admin));
    return null;
  };

  const logout = () => { setAdmin(null); sessionStorage.removeItem('epm_admin'); };

  return <AuthContext.Provider value={{ admin, login, logout }}>{children}</AuthContext.Provider>;
}

// ── Utilities ──────────────────────────────────────────────────────────────

const TIER_COLOR: Record<string, string> = {
  trial: 'bg-gray-700 text-gray-300',
  starter: 'bg-blue-900 text-blue-300',
  professional: 'bg-purple-900 text-purple-300',
  enterprise: 'bg-amber-900 text-amber-300'
};

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-900 text-green-300',
  suspended: 'bg-red-900 text-red-300',
  trial: 'bg-yellow-900 text-yellow-300',
  churned: 'bg-gray-700 text-gray-400',
  expired: 'bg-red-900 text-red-300',
  cancelled: 'bg-gray-700 text-gray-400',
  pending: 'bg-yellow-900 text-yellow-300'
};

function Badge({ text, color }: { text: string; color: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${color}`}>{text}</span>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${className}`}>{children}</div>;
}

function StatCard({ label, value, sub, icon: Icon, color = 'indigo' }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string;
}) {
  const bg: Record<string, string> = {
    indigo: 'bg-indigo-500/10 text-indigo-400',
    green:  'bg-green-500/10 text-green-400',
    amber:  'bg-amber-500/10 text-amber-400',
    red:    'bg-red-500/10 text-red-400',
    purple: 'bg-purple-500/10 text-purple-400',
    blue:   'bg-blue-500/10 text-blue-400'
  };
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${bg[color] ?? bg.indigo}`}><Icon size={20} /></div>
      </div>
    </Card>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input {...props} className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 ${props.className ?? ''}`} />
    </div>
  );
}

function Select({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <select {...props} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">{children}</select>
    </div>
  );
}

function Btn({ children, variant = 'primary', size = 'md', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-50';
  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  const v = variant === 'primary' ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : variant === 'danger' ? 'bg-red-600 hover:bg-red-500 text-white' : 'border border-gray-700 hover:bg-gray-800 text-gray-300';
  return <button {...props} className={`${base} ${sz} ${v} ${props.className ?? ''}`}>{children}</button>;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="text-gray-400 hover:text-white transition-colors" title="Copy">
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────

const NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/companies',   icon: Building2,       label: 'Companies' },
  { to: '/licenses',    icon: Key,             label: 'Licenses' },
  { to: '/purchases',   icon: ShoppingCart,    label: 'Purchases' },
  { to: '/plans',       icon: CreditCard,      label: 'Plans' },
];

function Sidebar() {
  const { admin, logout } = useAdmin();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside className="w-60 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col min-h-screen">
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">EPM Admin</p>
            <p className="text-xs text-gray-500">Super Console</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to !== '/' && pathname.startsWith(to));
          return (
            <Link key={to} to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-800">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs text-gray-300 font-medium">{admin?.name}</p>
          <p className="text-xs text-gray-500">{admin?.email}</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Login Page ─────────────────────────────────────────────────────────────

function LoginPage() {
  const { admin, login } = useAdmin();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@epm.io');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (admin) navigate('/'); }, [admin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const err = await login(email, password);
    setLoading(false);
    if (err) setError(err); else navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">EPM Super Admin</h1>
          <p className="text-gray-400 text-sm mt-1">Platform management console</p>
        </div>
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white pr-9 focus:outline-none focus:border-indigo-500" />
                <button type="button" onClick={() => setShowPwd(p => !p)} className="absolute right-2.5 top-2.5 text-gray-400">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-900 rounded-lg px-3 py-2">{error}</p>}
            <Btn type="submit" disabled={loading} className="w-full justify-center">
              {loading ? 'Signing in…' : 'Sign in'}
            </Btn>
          </form>
        </Card>
        <p className="text-center text-xs text-gray-600 mt-4">Default: admin@epm.io / password</p>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────

function DashboardPage() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchDashboardStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentCompanies, setRecentCompanies] = useState<Company[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, { data: cos }] = await Promise.all([fetchDashboardStats(), fetchCompanies()]);
    setStats(s);
    setRecentCompanies((cos ?? []).slice(0, 5));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="p-8">
      <PageHeader title="Dashboard" subtitle="Platform overview" action={<Btn variant="ghost" size="sm" onClick={load}><RefreshCw size={14} /> Refresh</Btn>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Companies"  value={stats?.totalCompanies ?? 0}  sub={`${stats?.activeCompanies} active`}   icon={Building2}     color="indigo" />
        <StatCard label="Active Licenses"  value={stats?.activeLicenses ?? 0}  sub={`${stats?.expiringSoon} expiring soon`} icon={Key}           color="purple" />
        <StatCard label="Total Seats Sold" value={stats?.totalSeats ?? 0}       sub="across all plans"                    icon={Users}         color="blue" />
        <StatCard label="Active Agents"    value={stats?.activeComputers ?? 0}  sub={`of ${stats?.totalComputers} total`}  icon={Monitor}       color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Building2 size={15} /> Recent Companies</h2>
          {recentCompanies.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No companies yet</p>
          ) : (
            <div className="space-y-2">
              {recentCompanies.map(c => (
                <Link key={c.id} to={`/companies/${c.id}`} className="flex items-center justify-between p-3 hover:bg-gray-800 rounded-lg transition-colors">
                  <div>
                    <p className="text-sm text-white font-medium">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.contact_email ?? c.domain ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge text={c.license_tier ?? 'trial'} color={TIER_COLOR[c.license_tier] ?? TIER_COLOR.trial} />
                    <ChevronRight size={14} className="text-gray-600" />
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Link to="/companies" className="text-xs text-indigo-400 hover:text-indigo-300 mt-3 block">View all companies →</Link>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><AlertTriangle size={15} className="text-amber-400" /> Expiring Soon (30 days)</h2>
          <ExpiringLicenses />
        </Card>
      </div>
    </div>
  );
}

function ExpiringLicenses() {
  const [items, setItems] = useState<License[]>([]);
  useEffect(() => {
    fetchLicenses().then(({ data }) => {
      const now = new Date();
      const thresh = addDays(now, 30);
      setItems((data ?? []).filter(l => {
        if (!l.is_active || !l.expires_at) return false;
        const exp = new Date(l.expires_at);
        return !isPast(exp) && isWithinInterval(exp, { start: now, end: thresh });
      }));
    });
  }, []);

  if (items.length === 0) return <p className="text-sm text-gray-500 text-center py-6">No licenses expiring in 30 days</p>;

  return (
    <div className="space-y-2">
      {items.map(l => (
        <div key={l.id} className="flex items-center justify-between p-3 bg-amber-900/10 border border-amber-900/30 rounded-lg">
          <div>
            <p className="text-xs font-mono text-amber-300">{l.license_key}</p>
            <p className="text-xs text-gray-400 mt-0.5">Expires {l.expires_at ? format(new Date(l.expires_at), 'dd MMM yyyy') : '—'}</p>
          </div>
          <Badge text={l.tier} color={TIER_COLOR[l.tier] ?? TIER_COLOR.trial} />
        </div>
      ))}
    </div>
  );
}

// ── Companies List ─────────────────────────────────────────────────────────

function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => { setLoading(true); const { data } = await fetchCompanies(); setCompanies(data); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contact_email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.domain ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <PageHeader
        title="Companies"
        subtitle={`${companies.length} total`}
        action={<Btn onClick={() => setShowCreate(true)}><Plus size={15} /> New Company</Btn>}
      />

      <div className="mb-4 relative">
        <Search size={15} className="absolute left-3 top-2.5 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies…" className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
      </div>

      {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                <th className="px-5 py-3 text-left">Company</th>
                <th className="px-5 py-3 text-left">Contact</th>
                <th className="px-5 py-3 text-left">Plan</th>
                <th className="px-5 py-3 text-left">Seats</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Expiry</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">No companies found</td></tr>
              )}
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.domain ?? '—'}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">{c.contact_email ?? '—'}</td>
                  <td className="px-5 py-3"><Badge text={c.license_tier ?? 'trial'} color={TIER_COLOR[c.license_tier] ?? TIER_COLOR.trial} /></td>
                  <td className="px-5 py-3 text-sm text-gray-300">{c.license_seats ?? '—'}</td>
                  <td className="px-5 py-3"><Badge text={c.status ?? 'active'} color={STATUS_COLOR[c.status] ?? STATUS_COLOR.active} /></td>
                  <td className="px-5 py-3 text-xs text-gray-400">{c.license_expiry ? format(new Date(c.license_expiry), 'dd MMM yyyy') : '—'}</td>
                  <td className="px-5 py-3">
                    <Link to={`/companies/${c.id}`} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">View <ChevronRight size={12} /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showCreate && <CreateCompanyModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateCompanyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', domain: '', contact_name: '', contact_email: '', contact_phone: '', address: '', country: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Company name is required'); return; }
    setLoading(true);
    const { error: err } = await createCompany({ ...form, status: 'trial', license_tier: 'trial', license_seats: 0 });
    setLoading(false);
    if (err) { setError(err.message); return; }
    onCreated();
  };

  return (
    <Modal title="New Company" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Company Name *" value={form.name} onChange={set('name')} placeholder="Acme Corp" required />
          <Input label="Domain" value={form.domain} onChange={set('domain')} placeholder="acme.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Contact Name" value={form.contact_name} onChange={set('contact_name')} placeholder="John Doe" />
          <Input label="Contact Email" type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="john@acme.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Phone" value={form.contact_phone} onChange={set('contact_phone')} placeholder="+1 555 000 0000" />
          <Input label="Country" value={form.country} onChange={set('country')} placeholder="India" />
        </div>
        <Input label="Address" value={form.address} onChange={set('address')} placeholder="123 Main St, City" />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Btn type="submit" disabled={loading} className="flex-1 justify-center">{loading ? 'Creating…' : 'Create Company'}</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ── Company Detail ─────────────────────────────────────────────────────────

function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { admin } = useAdmin();
  const [company, setCompany] = useState<Company | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [computers, setComputers] = useState<any[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIssue, setShowIssue] = useState(false);
  const [tab, setTab] = useState<'licenses' | 'purchases' | 'computers'>('licenses');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [co, lics, purs, comps, pls] = await Promise.all([
      fetchCompany(id), fetchLicenses(id), fetchPurchases(id), fetchComputers(id), fetchPlans()
    ]);
    setCompany(co.data);
    setLicenses(lics.data);
    setPurchases(purs.data);
    setComputers(comps.data);
    setPlans(pls.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleRevoke = async (licId: string) => {
    if (!confirm('Revoke this license? The company will lose access.')) return;
    await revokeLicense(licId);
    load();
  };

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>;
  if (!company) return <div className="p-8 text-red-400 text-sm">Company not found.</div>;

  const TABS = [
    { key: 'licenses', label: `Licenses (${licenses.length})` },
    { key: 'purchases', label: `Purchases (${purchases.length})` },
    { key: 'computers', label: `Agents (${computers.length})` }
  ] as const;

  return (
    <div className="p-8">
      <Link to="/companies" className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-4">← Companies</Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{company.name}</h1>
          <p className="text-sm text-gray-400">{company.contact_email ?? company.domain ?? '—'}</p>
        </div>
        <div className="flex gap-2">
          <Badge text={company.license_tier ?? 'trial'} color={TIER_COLOR[company.license_tier] ?? TIER_COLOR.trial} />
          <Badge text={company.status ?? 'active'} color={STATUS_COLOR[company.status] ?? STATUS_COLOR.active} />
          <Btn onClick={() => setShowIssue(true)}><Key size={14} /> Issue License</Btn>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card><p className="text-xs text-gray-500">Contact</p><p className="text-sm text-white mt-0.5">{company.contact_name ?? '—'}</p></Card>
        <Card><p className="text-xs text-gray-500">Phone</p><p className="text-sm text-white mt-0.5">{company.contact_phone ?? '—'}</p></Card>
        <Card><p className="text-xs text-gray-500">Country</p><p className="text-sm text-white mt-0.5">{company.country ?? '—'}</p></Card>
        <Card><p className="text-xs text-gray-500">Member Since</p><p className="text-sm text-white mt-0.5">{format(new Date(company.created_at), 'dd MMM yyyy')}</p></Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-indigo-500 text-indigo-300' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'licenses' && (
        <Card className="p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                <th className="px-5 py-3 text-left">License Key</th>
                <th className="px-5 py-3 text-left">Tier</th>
                <th className="px-5 py-3 text-left">Seats</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Expires</th>
                <th className="px-5 py-3 text-left">Notes</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {licenses.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">No licenses yet — issue one above</td></tr>}
              {licenses.map(l => (
                <tr key={l.id} className={`hover:bg-gray-800/40 transition-colors ${!l.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-indigo-300">{l.license_key}</span>
                      <CopyBtn text={l.license_key} />
                    </div>
                  </td>
                  <td className="px-5 py-3"><Badge text={l.tier} color={TIER_COLOR[l.tier] ?? TIER_COLOR.trial} /></td>
                  <td className="px-5 py-3 text-sm text-gray-300">{l.seats}</td>
                  <td className="px-5 py-3"><Badge text={l.is_active ? 'active' : 'revoked'} color={l.is_active ? STATUS_COLOR.active : STATUS_COLOR.cancelled} /></td>
                  <td className="px-5 py-3 text-xs text-gray-400">{l.expires_at ? format(new Date(l.expires_at), 'dd MMM yyyy') : '—'}</td>
                  <td className="px-5 py-3 text-xs text-gray-400 max-w-[160px] truncate">{l.notes ?? '—'}</td>
                  <td className="px-5 py-3">
                    {l.is_active && <Btn variant="danger" size="sm" onClick={() => handleRevoke(l.id)}>Revoke</Btn>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'purchases' && (
        <Card className="p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                <th className="px-5 py-3 text-left">Plan</th>
                <th className="px-5 py-3 text-left">Seats</th>
                <th className="px-5 py-3 text-left">Amount</th>
                <th className="px-5 py-3 text-left">Billing</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Period</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {purchases.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500">No purchases yet</td></tr>}
              {purchases.map(p => (
                <tr key={p.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-5 py-3 text-sm text-white font-medium">{p.plans?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-gray-300">{p.seats_purchased}</td>
                  <td className="px-5 py-3 text-sm text-green-400">${Number(p.amount_paid).toFixed(2)} {p.currency}</td>
                  <td className="px-5 py-3 text-xs text-gray-400 capitalize">{p.billing_cycle}</td>
                  <td className="px-5 py-3"><Badge text={p.status} color={STATUS_COLOR[p.status] ?? STATUS_COLOR.active} /></td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {format(new Date(p.started_at), 'dd MMM yy')} → {p.expires_at ? format(new Date(p.expires_at), 'dd MMM yy') : '∞'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'computers' && (
        <Card className="p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                <th className="px-5 py-3 text-left">Hostname</th>
                <th className="px-5 py-3 text-left">Username</th>
                <th className="px-5 py-3 text-left">OS</th>
                <th className="px-5 py-3 text-left">Last Seen</th>
                <th className="px-5 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {computers.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">No agents registered yet</td></tr>}
              {computers.map(c => {
                const online = (Date.now() - new Date(c.last_seen).getTime()) < 15 * 60 * 1000;
                return (
                  <tr key={c.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-5 py-3 text-sm text-white font-medium">{c.hostname}</td>
                    <td className="px-5 py-3 text-sm text-gray-300">{c.username}</td>
                    <td className="px-5 py-3 text-xs text-gray-400">{c.os ?? 'Windows'}</td>
                    <td className="px-5 py-3 text-xs text-gray-400">{formatDistanceToNow(new Date(c.last_seen), { addSuffix: true })}</td>
                    <td className="px-5 py-3"><Badge text={online ? 'online' : 'offline'} color={online ? STATUS_COLOR.active : 'bg-gray-700 text-gray-400'} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {showIssue && (
        <IssueLicenseModal
          company={company}
          plans={plans}
          adminId={admin?.id ?? ''}
          onClose={() => setShowIssue(false)}
          onIssued={() => { setShowIssue(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Issue License Modal ────────────────────────────────────────────────────

function IssueLicenseModal({ company, plans, adminId, onClose, onIssued }: {
  company: Company; plans: Plan[]; adminId: string;
  onClose: () => void; onIssued: () => void;
}) {
  const activePlans = plans.filter(p => p.is_active && p.slug !== 'trial');
  const [planId, setPlanId] = useState(activePlans[0]?.id ?? '');
  const selectedPlan = activePlans.find(p => p.id === planId);
  const [seats, setSeats] = useState(String(selectedPlan?.max_seats ? Math.min(5, selectedPlan.max_seats) : 5));
  const [billing, setBilling] = useState<'monthly' | 'annual' | 'one_time'>('monthly');
  const [months, setMonths] = useState('12');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');

  useEffect(() => { setPreview(generateLicenseKey(selectedPlan?.slug ?? 'starter')); }, [selectedPlan]);
  useEffect(() => { const p = activePlans.find(x => x.id === planId); if (p) setSeats(String(Math.min(5, p.max_seats ?? 5))); }, [planId]);

  const totalAmount = Number(seats) * (selectedPlan?.price_per_seat ?? 0) * (billing === 'annual' ? 12 : 1);
  const startDate = new Date();
  const expiresAt = new Date(startDate);
  expiresAt.setMonth(expiresAt.getMonth() + Number(months));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planId) { setError('Select a plan'); return; }
    setLoading(true); setError('');

    const { data: lic, error: licErr } = await issueLicense({
      company_id: company.id, tier: selectedPlan?.slug ?? 'starter',
      seats: Number(seats), expires_at: expiresAt.toISOString(),
      plan_id: planId, notes, adminId
    });

    if (licErr || !lic) { setError(licErr?.message ?? 'Failed to issue license'); setLoading(false); return; }

    await createPurchase({
      company_id: company.id, plan_id: planId, license_id: lic.id,
      seats_purchased: Number(seats), amount_paid: totalAmount,
      billing_cycle: billing, started_at: startDate.toISOString(),
      expires_at: expiresAt.toISOString(), invoice_ref: invoiceRef, notes, adminId
    });

    setLoading(false);
    onIssued();
  };

  return (
    <Modal title={`Issue License — ${company.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Select label="Plan" value={planId} onChange={e => setPlanId(e.target.value)}>
          {activePlans.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.price_per_seat}/seat/mo</option>)}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Seats" type="number" min="1" max="999" value={seats} onChange={e => setSeats(e.target.value)} />
          <Select label="Duration (months)" value={months} onChange={e => setMonths(e.target.value)}>
            {[1,3,6,12,24].map(m => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
          </Select>
        </div>

        <Select label="Billing Cycle" value={billing} onChange={e => setBilling(e.target.value as any)}>
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
          <option value="one_time">One-Time</option>
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Invoice Ref" value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="INV-0001" />
          <div>
            <label className="block text-xs text-gray-400 mb-1">Expires</label>
            <p className="text-sm text-white py-2">{format(expiresAt, 'dd MMM yyyy')}</p>
          </div>
        </div>

        <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes…" />

        {/* Preview */}
        <div className="bg-gray-800 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">License Key</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-indigo-300">{preview}</span>
              <CopyBtn text={preview} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Total Amount</span>
            <span className="text-sm text-green-400 font-semibold">${totalAmount.toFixed(2)} USD</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Period</span>
            <span className="text-xs text-gray-300">{format(startDate, 'dd MMM yyyy')} → {format(expiresAt, 'dd MMM yyyy')}</span>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Btn type="submit" disabled={loading} className="flex-1 justify-center">{loading ? 'Issuing…' : 'Issue License + Record Purchase'}</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ── Licenses Page ──────────────────────────────────────────────────────────

function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => { setLoading(true); const { data } = await fetchLicenses(); setLicenses(data); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = licenses.filter(l => {
    const matchSearch = l.license_key.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'active' && l.is_active) || (filter === 'revoked' && !l.is_active) || l.tier === filter;
    return matchSearch && matchFilter;
  });

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this license?')) return;
    await revokeLicense(id);
    load();
  };

  return (
    <div className="p-8">
      <PageHeader title="Licenses" subtitle={`${licenses.filter(l => l.is_active).length} active`} action={<Btn variant="ghost" size="sm" onClick={load}><RefreshCw size={14} /> Refresh</Btn>} />

      <div className="flex gap-3 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-2.5 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by key…" className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-64" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                <th className="px-5 py-3 text-left">License Key</th>
                <th className="px-5 py-3 text-left">Tier</th>
                <th className="px-5 py-3 text-left">Seats</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Expires</th>
                <th className="px-5 py-3 text-left">Issued</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">No licenses found</td></tr>}
              {filtered.map(l => {
                const expired = l.expires_at ? isPast(new Date(l.expires_at)) : false;
                return (
                  <tr key={l.id} className={`hover:bg-gray-800/40 transition-colors ${!l.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-indigo-300">{l.license_key}</span>
                        <CopyBtn text={l.license_key} />
                      </div>
                    </td>
                    <td className="px-5 py-3"><Badge text={l.tier} color={TIER_COLOR[l.tier] ?? TIER_COLOR.trial} /></td>
                    <td className="px-5 py-3 text-sm text-gray-300">{l.seats}</td>
                    <td className="px-5 py-3">
                      <Badge text={!l.is_active ? 'revoked' : expired ? 'expired' : 'active'} color={!l.is_active || expired ? STATUS_COLOR.expired : STATUS_COLOR.active} />
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">{l.expires_at ? format(new Date(l.expires_at), 'dd MMM yyyy') : '∞'}</td>
                    <td className="px-5 py-3 text-xs text-gray-400">{format(new Date(l.created_at), 'dd MMM yyyy')}</td>
                    <td className="px-5 py-3">
                      {l.is_active && !expired && <Btn variant="danger" size="sm" onClick={() => handleRevoke(l.id)}>Revoke</Btn>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Purchases Page ─────────────────────────────────────────────────────────

function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => { setLoading(true); const { data } = await fetchPurchases(); setPurchases(data); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const totalRevenue = purchases.filter(p => p.status === 'active').reduce((s, p) => s + Number(p.amount_paid), 0);
  const totalSeats   = purchases.filter(p => p.status === 'active').reduce((s, p) => s + p.seats_purchased, 0);

  const filtered = purchases.filter(p =>
    (p.plans?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.invoice_ref ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <PageHeader title="Purchases" subtitle="All billing records" action={<Btn variant="ghost" size="sm" onClick={load}><RefreshCw size={14} /> Refresh</Btn>} />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Revenue"  value={`$${totalRevenue.toFixed(2)}`} sub="active subscriptions" icon={CreditCard}   color="green" />
        <StatCard label="Total Seats"    value={totalSeats}                     sub="across all companies"  icon={Users}         color="indigo" />
        <StatCard label="Total Records"  value={purchases.length}               sub={`${purchases.filter(p => p.status === 'active').length} active`} icon={ShoppingCart} color="purple" />
      </div>

      <div className="mb-4 relative">
        <Search size={15} className="absolute left-3 top-2.5 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by plan or invoice…" className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-64" />
      </div>

      {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                <th className="px-5 py-3 text-left">Invoice</th>
                <th className="px-5 py-3 text-left">Plan</th>
                <th className="px-5 py-3 text-left">Seats</th>
                <th className="px-5 py-3 text-left">Amount</th>
                <th className="px-5 py-3 text-left">Billing</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Start</th>
                <th className="px-5 py-3 text-left">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-500">No purchases yet</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-5 py-3 text-xs text-gray-400 font-mono">{p.invoice_ref ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-white font-medium">{p.plans?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-gray-300">{p.seats_purchased}</td>
                  <td className="px-5 py-3 text-sm text-green-400 font-semibold">${Number(p.amount_paid).toFixed(2)}</td>
                  <td className="px-5 py-3 text-xs text-gray-400 capitalize">{p.billing_cycle}</td>
                  <td className="px-5 py-3"><Badge text={p.status} color={STATUS_COLOR[p.status] ?? STATUS_COLOR.active} /></td>
                  <td className="px-5 py-3 text-xs text-gray-400">{format(new Date(p.started_at), 'dd MMM yyyy')}</td>
                  <td className="px-5 py-3 text-xs text-gray-400">{p.expires_at ? format(new Date(p.expires_at), 'dd MMM yyyy') : '∞'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Plans Page ─────────────────────────────────────────────────────────────

function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setLoading(true); const { data } = await fetchPlans(); setPlans(data); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const togglePlan = async (plan: Plan) => {
    await supabase.from('plans').update({ is_active: !plan.is_active }).eq('id', plan.id);
    load();
  };

  return (
    <div className="p-8">
      <PageHeader title="Plans" subtitle="Product catalog" action={<Btn variant="ghost" size="sm" onClick={load}><RefreshCw size={14} /> Refresh</Btn>} />

      {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
          {plans.map(p => (
            <Card key={p.id} className={`relative ${!p.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <Badge text={p.slug} color={TIER_COLOR[p.slug] ?? TIER_COLOR.trial} />
                <button onClick={() => togglePlan(p)} className="text-gray-400 hover:text-white" title={p.is_active ? 'Deactivate' : 'Activate'}>
                  {p.is_active ? <ToggleRight size={22} className="text-green-400" /> : <ToggleLeft size={22} />}
                </button>
              </div>
              <h3 className="text-lg font-bold text-white">{p.name}</h3>
              <p className="text-2xl font-bold text-indigo-400 mt-1">
                {p.price_per_seat === 0 ? 'Free' : `$${p.price_per_seat}`}
                {p.price_per_seat > 0 && <span className="text-sm text-gray-400 font-normal">/seat/mo</span>}
              </p>
              <div className="mt-3 space-y-1 text-xs text-gray-400">
                <p>Max seats: {p.max_seats ?? 'Unlimited'}</p>
                <p>Data retention: {p.data_retention_days} days</p>
              </div>
              <ul className="mt-4 space-y-1.5">
                {(p.features ?? []).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                    <Check size={13} className="text-green-400 mt-0.5 shrink-0" />{f}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { admin } = useAdmin();
  if (!admin) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/companies" element={<RequireAuth><CompaniesPage /></RequireAuth>} />
          <Route path="/companies/:id" element={<RequireAuth><CompanyDetailPage /></RequireAuth>} />
          <Route path="/licenses" element={<RequireAuth><LicensesPage /></RequireAuth>} />
          <Route path="/purchases" element={<RequireAuth><PurchasesPage /></RequireAuth>} />
          <Route path="/plans" element={<RequireAuth><PlansPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
