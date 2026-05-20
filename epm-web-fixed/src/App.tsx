import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import {
  Activity, LayoutDashboard, Users, Monitor, Settings, LogOut,
  TrendingUp, Clock, BarChart3, ChevronRight, Menu, Bell, Search, RefreshCw, Eye,
  Laptop, Globe, AppWindow, Timer, Download, Tag
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { Plus, Trash2, Check, X as XIcon } from 'lucide-react';
import { supabase, getCurrentUser } from './lib/supabase';

// Supabase config
const SUPABASE_URL = 'https://fcfezhoaxqroubphzzfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZmV6aG9heHFyb3VicGh6emZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDc1NzAsImV4cCI6MjA5MzYyMzU3MH0.GXjaEpjuRCM39qMkpSCPHyhEoC1nxRg-1BpQ_39q4pc';

// Types
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  companyName: string;
  licenseTier: string;
  licenseSeats: number;
}

interface DbComputer {
  id: string;
  company_id: string;
  hostname: string;
  username: string;
  last_seen: string;
}

interface DbActivity {
  id: string;
  computer_id: string;
  "timestamp": string;
  app_name: string;
  app_title: string;
  url: string;
  category: string;
  duration_seconds: number;
}

interface DbDailyStats {
  id: string;
  computer_id: string;
  date: string;
  active_seconds: number;
  idle_seconds: number;
  productive_seconds: number;
  unproductive_seconds: number;
}

interface DbEmployee {
  id: string;
  name: string;
  email: string;
  department: string;
}

interface DbRule {
  id: string;
  name: string;
  category: 'productive' | 'unproductive' | 'neutral';
  type: 'app' | 'domain' | 'keyword';
  pattern: string;
}

// Context
const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
} | null>(null);

const DataContext = createContext<{
  computers: DbComputer[];
  activities: DbActivity[];
  dailyStats: DbDailyStats[];
  employees: DbEmployee[];
  rules: DbRule[];
  loading: boolean;
  refresh: () => void;
} | null>(null);

const useAuth = () => useContext(AuthContext)!;
const useData = () => useContext(DataContext)!;

// Login Page
const LoginPage = () => {
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const success = await login(email, password);
      if (!success) setError('Invalid credentials');
    } catch { setError('Login failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500 mb-4">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">EPM Commercial</h1>
          <p className="text-gray-400">Employee Productivity Monitor</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-6 text-white">Sign in</h2>
          {error && <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white pr-10" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"><Eye className="w-5 h-5" /></button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="text-center text-green-400 text-sm mt-4">Demo Mode: Enter any email and password to login</p>
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Data Provider
const DataProvider = ({ children, companyId }: { children: React.ReactNode; companyId: string }) => {
  const [computers, setComputers] = useState<DbComputer[]>([]);
  const [activities, setActivities] = useState<DbActivity[]>([]);
  const [dailyStats, setDailyStats] = useState<DbDailyStats[]>([]);
  const [employees, setEmployees] = useState<DbEmployee[]>([]);
  const [rules, setRules] = useState<DbRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const [c, a, d, e, r] = await Promise.all([
        supabase.from('computers').select('*').eq('company_id', companyId),
        supabase.from('activity_logs').select('*').eq('company_id', companyId).gte('timestamp', weekAgo.toISOString()).order('timestamp', { ascending: false }).limit(100),
        supabase.from('daily_stats').select('*').eq('company_id', companyId).gte('date', weekAgo.toISOString().split('T')[0]).order('date', { ascending: false }),
        supabase.from('employees').select('*').eq('company_id', companyId),
        supabase.from('productivity_rules').select('*').eq('company_id', companyId)
      ]);
      setComputers(c.data || []);
      setActivities(a.data || []);
      setDailyStats(d.data || []);
      setEmployees(e.data || []);
      setRules(r.data || []);
    } catch (err) { console.error('Fetch error:', err); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30000); return () => clearInterval(i); }, [fetchData]);

  return <DataContext.Provider value={{ computers, activities, dailyStats, employees, rules, loading, refresh: fetchData }}>{children}</DataContext.Provider>;
};

// Dashboard
const DashboardPage = () => {
  const { user } = useAuth();
  const { computers, activities, dailyStats, loading } = useData();

  const activeCount = computers.filter(c => c.last_seen && (Date.now() - new Date(c.last_seen).getTime()) < 1800000).length;
  const totalActive = dailyStats.reduce((s, d) => s + (d.active_seconds || 0), 0);
  const totalProd = dailyStats.reduce((s, d) => s + (d.productive_seconds || 0), 0);
  const totalUnprod = dailyStats.reduce((s, d) => s + (d.unproductive_seconds || 0), 0);
  const totalIdle = dailyStats.reduce((s, d) => s + (d.idle_seconds || 0), 0);
  const score = totalActive > 0 ? Math.round((totalProd / totalActive) * 100) : 0;

  const appMap: Record<string, { name: string; min: number; cat: string }> = {};
  activities.forEach(a => {
    const k = a.app_name || 'Unknown';
    if (!appMap[k]) appMap[k] = { name: k, min: 0, cat: a.category || 'neutral' };
    appMap[k].min += Math.floor((a.duration_seconds || 0) / 60);
  });
  const topApps = Object.values(appMap).sort((a, b) => b.min - a.min).slice(0, 6).map(a => ({ ...a, color: a.cat === 'productive' ? '#22c55e' : a.cat === 'unproductive' ? '#ef4444' : '#64748b' }));

  const chartData = dailyStats.slice().reverse().map(s => ({ day: new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' }), productive: Math.round((s.productive_seconds || 0) / 60), unproductive: Math.round((s.unproductive_seconds || 0) / 60) }));

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500" /></div>;

  return (
    <div>
      <div className="mb-8"><h1 className="text-2xl font-bold text-white">Dashboard</h1><p className="text-gray-400">Welcome, {user?.name}</p></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700"><div className="flex items-center gap-3 mb-2"><div className="p-2 rounded-lg bg-green-500/20"><Users className="w-5 h-5 text-green-500" /></div></div><div className="text-3xl font-bold text-white">{activeCount}</div><div className="text-gray-400 text-sm">Active Computers</div><div className="text-xs text-gray-500">of {computers.length} total</div></div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700"><div className="flex items-center gap-3 mb-2"><div className="p-2 rounded-lg bg-blue-500/20"><Clock className="w-5 h-5 text-blue-500" /></div></div><div className="text-3xl font-bold text-white">{Math.round(totalActive / 3600)}h</div><div className="text-gray-400 text-sm">Active Time</div></div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700"><div className="flex items-center gap-3 mb-2"><div className="p-2 rounded-lg bg-green-500/20"><TrendingUp className="w-5 h-5 text-green-500" /></div></div><div className="text-3xl font-bold text-white">{score}%</div><div className="text-gray-400 text-sm">Productivity</div></div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700"><div className="flex items-center gap-3 mb-2"><div className="p-2 rounded-lg bg-yellow-500/20"><Timer className="w-5 h-5 text-yellow-500" /></div></div><div className="text-3xl font-bold text-white">{Math.round(totalIdle / 3600)}h</div><div className="text-gray-400 text-sm">Idle Time</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4 text-white">Weekly Productivity</h3>
          {chartData.length > 0 ? (
            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="day" stroke="#64748b" fontSize={12} /><YAxis stroke="#64748b" fontSize={12} /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} /><Area type="monotone" dataKey="productive" stroke="#22c55e" fill="url(#g)" /></AreaChart></ResponsiveContainer></div>
          ) : <div className="h-64 flex items-center justify-center text-gray-500">No data yet</div>}
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-white">Time Distribution</h3>
          <div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ n: 'Productive', v: totalProd }, { n: 'Unproductive', v: totalUnprod }, { n: 'Idle', v: totalIdle }].filter(x => x.v > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="v">{[<Cell key="p" fill="#22c55e" />, <Cell key="u" fill="#ef4444" />, <Cell key="i" fill="#64748b" />]}</Pie><Tooltip formatter={v => `${Math.round(Number(v) / 60)}m`} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} /></PieChart></ResponsiveContainer></div>
          <div className="grid grid-cols-3 gap-2 mt-4">{[{ l: 'Productive', c: '#22c55e', v: totalProd }, { l: 'Unproductive', c: '#ef4444', v: totalUnprod }, { l: 'Idle', c: '#64748b', v: totalIdle }].map(x => <div key={x.l} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: x.c }} /><span className="text-sm text-gray-400">{x.l}</span><span className="text-sm ml-auto">{Math.round(x.v / 60)}m</span></div>)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-white">Recent Activity</h3>
          {activities.length > 0 ? activities.slice(0, 5).map(a => <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-900/50 mb-2"><div className={`w-2 h-2 rounded-full ${a.category === 'productive' ? 'bg-green-500' : a.category === 'unproductive' ? 'bg-red-500' : 'bg-gray-500'}`} /><div className="flex-1 min-w-0"><div className="text-sm text-white truncate">{computers.find(c => c.id === a.computer_id)?.username || 'Unknown'}</div><div className="text-xs text-gray-500 truncate">{a.app_name} - {a.app_title}</div></div><div className="text-xs text-gray-500">{formatTimeAgo(new Date(a.timestamp))}</div></div>) : <div className="text-center text-gray-500 py-8">No activity yet</div>}
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-white">Top Applications</h3>
          {topApps.length > 0 ? <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={topApps} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} /><XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={v => `${v}m`} /><YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} width={80} /><Tooltip formatter={v => `${v} minutes`} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} /><Bar dataKey="min" radius={[0, 4, 4, 0]}>{topApps.map((a, i) => <Cell key={i} fill={a.color} />)}</Bar></BarChart></ResponsiveContainer></div> : <div className="text-center text-gray-500 py-8">No app data yet</div>}
        </div>
      </div>
    </div>
  );
};

// Employees
const EmployeesPage = () => {
  const { employees, loading } = useData();
  return (
    <div>
      <div className="flex items-center justify-between mb-8"><div><h1 className="text-2xl font-bold text-white">Employees</h1><p className="text-gray-400">{employees.length} employees registered</p></div></div>
      {loading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500" /></div> : employees.length === 0 ? <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center"><Users className="w-12 h-12 text-gray-500 mx-auto mb-4" /><h3 className="text-lg font-semibold text-white mb-2">No employees yet</h3><p className="text-gray-400">Employees appear here when they install the desktop agent.</p></div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{employees.map(e => <div key={e.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold">{e.name.split(' ').map(n => n[0]).join('')}</div><div><h3 className="font-semibold text-white">{e.name}</h3><p className="text-sm text-gray-400">{e.department || 'No department'}</p></div></div></div>)}</div>}
    </div>
  );
};

// Computers
const ComputersPage = () => {
  const { computers, loading, refresh } = useData();
  const getStatus = (last: string | null) => { if (!last) return { s: 'offline', c: 'gray' }; const m = (Date.now() - new Date(last).getTime()) / 1000 / 60; if (m < 5) return { s: 'online', c: 'green' }; if (m < 30) return { s: 'online', c: 'green' }; if (m < 120) return { s: 'idle', c: 'yellow' }; return { s: 'offline', c: 'gray' }; };
  return (
    <div>
      <div className="flex items-center justify-between mb-8"><div><h1 className="text-2xl font-bold text-white">Computers</h1><p className="text-gray-400">{computers.length} computers registered</p></div><button onClick={refresh} className="px-4 py-2 bg-gray-700 text-white rounded-lg flex items-center gap-2"><RefreshCw className="w-4 h-4" />Refresh</button></div>
      {loading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500" /></div> : computers.length === 0 ? <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center"><Monitor className="w-12 h-12 text-gray-500 mx-auto mb-4" /><h3 className="text-lg font-semibold text-white mb-2">No computers yet</h3><p className="text-gray-400">Install desktop agent on employee PCs.</p></div> : <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"><table className="w-full"><thead><tr className="border-b border-gray-700"><th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">ID</th><th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Hostname</th><th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th><th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Status</th><th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Last Seen</th></tr></thead><tbody>{computers.map(c => { const st = getStatus(c.last_seen); return <tr key={c.id} className="border-b border-gray-800"><td className="py-3 px-4"><div className="flex items-center gap-2"><Monitor className="w-4 h-4 text-gray-500" /><span className="font-mono text-sm text-white">{c.id.slice(0, 8)}...</span></div></td><td className="py-3 px-4 text-sm text-white">{c.hostname}</td><td className="py-3 px-4 text-sm text-white">{c.username}</td><td className="py-3 px-4"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.c === 'green' ? 'bg-green-500/20 text-green-400' : st.c === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}><span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${st.c === 'green' ? 'bg-green-400' : st.c === 'yellow' ? 'bg-yellow-400' : 'bg-gray-400'}`}></span>{st.s}</span></td><td className="py-3 px-4 text-sm text-gray-400">{c.last_seen ? formatTimeAgo(new Date(c.last_seen)) : 'Never'}</td></tr>; })}</tbody></table></div>}
    </div>
  );
};

// Activity
const ActivityPage = () => {
  const { activities, computers, loading, refresh } = useData();
  return (
    <div>
      <div className="flex items-center justify-between mb-8"><div><h1 className="text-2xl font-bold text-white">Live Activity</h1><p className="text-gray-400">Real-time employee activity feed</p></div><button onClick={refresh} className="px-4 py-2 bg-gray-700 text-white rounded-lg flex items-center gap-2"><RefreshCw className="w-4 h-4" />Refresh</button></div>
      {loading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500" /></div> : activities.length === 0 ? <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center"><Activity className="w-12 h-12 text-gray-500 mx-auto mb-4" /><h3 className="text-lg font-semibold text-white mb-2">No activity yet</h3><p className="text-gray-400">Activity will appear when employees use their computers.</p></div> : <div className="space-y-3">{activities.map(a => <div key={a.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center gap-4"><div className={`p-2 rounded-lg ${a.category === 'productive' ? 'bg-green-500/20' : a.category === 'unproductive' ? 'bg-red-500/20' : 'bg-gray-500/20'}`}><AppWindow className={`w-5 h-5 ${a.category === 'productive' ? 'text-green-500' : a.category === 'unproductive' ? 'text-red-500' : 'text-gray-500'}`} /></div><div className="flex-1"><div className="flex items-center gap-2"><span className="font-medium text-white">{computers.find(c => c.id === a.computer_id)?.username || 'Unknown'}</span><span className="text-gray-500">•</span><span className="text-gray-400">{a.app_name}</span></div><div className="text-sm text-gray-500 mt-0.5">{a.app_title || a.url || 'No title'}</div></div><div className="text-right"><div className={`text-sm font-medium ${a.category === 'productive' ? 'text-green-500' : a.category === 'unproductive' ? 'text-red-500' : 'text-gray-400'}`}>{a.category || 'neutral'}</div><div className="text-xs text-gray-500">{formatTimeAgo(new Date(a.timestamp))}</div></div></div>)}</div>}
    </div>
  );
};

// Categories
const CategoriesPage = () => {
  const { rules, loading, refresh } = useData();
  const [tab, setTab] = useState<'productive' | 'unproductive' | 'neutral'>('productive');
  const [adding, setAdding] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', type: 'app', pattern: '' });

  const handleAdd = async () => {
    if (!newRule.name || !newRule.pattern) return;
    await supabase.from('productivity_rules').insert([{ name: newRule.name, category: tab, type: newRule.type, pattern: newRule.pattern, company_id: '00000000-0000-0000-0000-000000000001' }]);
    setNewRule({ name: '', type: 'app', pattern: '' }); setAdding(false); refresh();
  };

  const handleDelete = async (id: string) => { await supabase.from('productivity_rules').delete().eq('id', id); refresh(); };

  const colors = { productive: { bg: 'bg-green-500/20', text: 'text-green-400' }, unproductive: { bg: 'bg-red-500/20', text: 'text-red-400' }, neutral: { bg: 'bg-gray-500/20', text: 'text-gray-400' } };
  const filtered = rules.filter(r => r.category === tab);

  return (
    <div>
      <div className="mb-8"><h1 className="text-2xl font-bold text-white">Productivity Categories</h1><p className="text-gray-400">Define what apps count as productive</p></div>
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6 flex items-center gap-3"><Laptop className="w-5 h-5 text-blue-400" /><div><h3 className="font-medium text-white">Customize per company</h3><p className="text-sm text-gray-400">Apps not matching any rule default to "Neutral"</p></div></div>
      <div className="flex gap-2 mb-6">{(['productive', 'unproductive', 'neutral'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? `${colors[t].bg} ${colors[t].text}` : 'bg-gray-800 text-gray-400'}`}>{t} ({rules.filter(r => r.category === t).length})</button>)}</div>
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center"><span className="text-sm text-gray-400">{filtered.length} rules</span><button onClick={() => setAdding(true)} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium flex items-center gap-1"><Plus className="w-4 h-4" />Add Rule</button></div>
        {adding && <div className="p-4 bg-gray-900/50 border-b border-gray-700 flex items-center gap-3"><input placeholder="Name" value={newRule.name} onChange={e => setNewRule(p => ({ ...p, name: e.target.value }))} className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm" /><select value={newRule.type} onChange={e => setNewRule(p => ({ ...p, type: e.target.value }))} className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"><option value="app">App</option><option value="domain">Domain</option><option value="keyword">Keyword</option></select><input placeholder="Pattern" value={newRule.pattern} onChange={e => setNewRule(p => ({ ...p, pattern: e.target.value }))} className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm" /><button onClick={handleAdd} className="p-2 bg-green-500 text-white rounded-lg"><Check className="w-4 h-4" /></button><button onClick={() => setAdding(false)} className="p-2 bg-gray-700 text-white rounded-lg"><XIcon className="w-4 h-4" /></button></div>}
        <div>{filtered.length === 0 ? <div className="p-8 text-center text-gray-500">No rules defined</div> : filtered.map(r => <div key={r.id} className="p-4 flex items-center justify-between border-b border-gray-800"><div className="flex items-center gap-4"><div className={`p-2 rounded-lg ${colors[tab].bg}`}>{r.type === 'app' ? <AppWindow className={`w-4 h-4 ${colors[tab].text}`} /> : r.type === 'domain' ? <Globe className={`w-4 h-4 ${colors[tab].text}`} /> : <Search className={`w-4 h-4 ${colors[tab].text}`} />}</div><div><div className="font-medium text-white">{r.name}</div><div className="text-sm text-gray-500">{r.type}: {r.pattern}</div></div></div><button onClick={() => handleDelete(r.id)} className="p-2 text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></div>)}</div>
      </div>
    </div>
  );
};

// Settings
const SettingsPage = () => {
  const { user, logout } = useAuth();
  const { employees, computers } = useData();
  return (
    <div>
      <div className="mb-8"><h1 className="text-2xl font-bold text-white">Settings</h1><p className="text-gray-400">Manage your account</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700"><h3 className="text-lg font-semibold mb-4 text-white">Company</h3><div className="space-y-4"><div><label className="block text-sm text-gray-400 mb-2">Name</label><input defaultValue={user?.companyName} className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white" /></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm text-gray-400 mb-2">Employees</label><input defaultValue={employees.length} disabled className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white" /></div><div><label className="block text-sm text-gray-400 mb-2">Computers</label><input defaultValue={computers.length} disabled className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white" /></div></div></div></div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700"><h3 className="text-lg font-semibold mb-4 text-white">License</h3><div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg"><div><div className="text-sm text-gray-400">Plan</div><div className="text-xl font-bold text-green-500">{user?.licenseTier || 'Trial'}</div></div><div className="text-right"><div className="text-sm text-gray-400">Seats</div><div className="text-xl font-bold">{computers.length}/{user?.licenseSeats || 5}</div></div></div></div>
        </div>
        <div><div className="bg-gray-800 rounded-xl p-6 border border-gray-700"><h3 className="text-lg font-semibold mb-4 text-white">Profile</h3><div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-semibold">{user?.name?.split(' ').map(n => n[0]).join('')}</div><div><div className="font-medium text-white">{user?.name}</div><div className="text-sm text-gray-400">{user?.email}</div></div></div><button onClick={logout} className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"><LogOut className="w-4 h-4" />Sign Out</button></div></div>
      </div>
    </div>
  );
};

// Sidebar
const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const loc = useLocation();
  const { computers } = useData();
  const items = [
    { p: '/dashboard', i: LayoutDashboard, l: 'Dashboard' },
    { p: '/employees', i: Users, l: 'Employees' },
    { p: '/computers', i: Monitor, l: 'Computers' },
    { p: '/activity', i: Activity, l: 'Activity' },
    { p: '/categories', i: Tag, l: 'Categories' },
    { p: '/settings', i: Settings, l: 'Settings' }
  ];
  return (
    <>{isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
    <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gray-800 border-r border-gray-700 transform lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-gray-700"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center"><Activity className="w-5 h-5 text-white" /></div><div><div className="font-bold text-white">EPM</div><div className="text-xs text-gray-500">Commercial</div></div></div></div>
        <nav className="flex-1 p-4 space-y-1">{items.map(it => <Link key={it.p} to={it.p} onClick={onClose} className={`flex items-center gap-3 px-4 py-3 rounded-lg ${loc.pathname === it.p ? 'bg-green-500/20 text-green-500' : 'text-gray-400 hover:bg-gray-700'}`}><it.i className="w-5 h-5" /><span className="font-medium">{it.l}</span></Link>)}</nav>
        <div className="p-4 border-t border-gray-700"><div className="p-4 rounded-lg bg-gray-900"><div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="font-medium text-sm text-white">Active</span></div><div className="text-xs text-gray-500 mt-1">{computers.length} computers</div></div></div>
      </div>
    </aside></>
  );
};

// Layout
const Layout = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-gray-900 flex">
      <Sidebar isOpen={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b border-gray-800 bg-gray-800 flex items-center justify-between px-4 lg:px-6">
          <button onClick={() => setOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-700"><Menu className="w-5 h-5 text-white" /></button>
          <div className="hidden lg:flex items-center gap-4 flex-1"><div className="relative max-w-md flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input placeholder="Search..." className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500" /></div></div>
          <div className="flex items-center gap-4"><button className="p-2 rounded-lg hover:bg-gray-700 relative"><Bell className="w-5 h-5 text-gray-400" /><span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span></button><div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-medium">U</div></div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

// Helper
function formatTimeAgo(d: Date): string { const s = Math.floor((Date.now() - d.getTime()) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }

// App
const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const { user: u } = await getCurrentUser();
        if (u) {
          // Get company ID from demo company for now
          const demoCompanyId = '11111111-1111-1111-1111-111111111111';
          const { data: profile } = await supabase.from('users').select('*, companies(*)').eq('id', u.id).single();
          if (profile) {
            setUser({
              id: u.id, email: u.email || '', name: profile.name || u.email || 'User',
              role: profile.role || 'admin', companyId: profile.company_id || demoCompanyId,
              companyName: profile.companies?.name || 'Demo Company',
              licenseTier: profile.companies?.license_tier || 'Professional',
              licenseSeats: profile.companies?.license_seats || 50
            });
          }
        }
      } catch {
        // No existing user, show login page
      } finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Demo mode: accept any email with any password (for quick testing)
    if (!email || !password) return false;

    // Simple demo login - any credentials work
    const demoCompanyId = '11111111-1111-1111-1111-111111111111';
    const newUser = {
      id: 'demo-' + Date.now(),
      email: email,
      name: email === 'admin@demo.com' ? 'Admin User' : email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      role: 'admin',
      companyId: demoCompanyId,
      companyName: 'Demo Company',
      licenseTier: 'Professional',
      licenseSeats: 50
    };

    setUser(newUser);
    return true;
  };

  const logout = async () => { setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute><Layout><EmployeesPage /></Layout></ProtectedRoute>} />
          <Route path="/computers" element={<ProtectedRoute><Layout><ComputersPage /></Layout></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute><Layout><ActivityPage /></Layout></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute><Layout><CategoriesPage /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><SettingsPage /></Layout></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
};

export default App;
