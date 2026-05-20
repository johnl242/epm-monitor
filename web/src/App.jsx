import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Activity, LayoutDashboard, Users, Monitor, Settings, LogOut,
  TrendingUp, Clock, AlertCircle, CheckCircle, BarChart3,
  ChevronRight, Menu, X, Bell, Search, RefreshCw, Eye, EyeOff,
  Laptop, Globe, AppWindow, Timer, Download
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area
} from 'recharts';

// Auth Context
const AuthContext = createContext(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'https://api.epm-commercial.com';

// Demo data for showcase
const DEMO_DATA = {
  company: {
    name: 'Acme Corporation',
    employees: 47,
    computers: 52,
    licenseTier: 'Professional',
    licenseSeats: 50,
    licenseExpiry: '2025-12-31'
  },
  todayStats: {
    activeEmployees: 42,
    totalActiveMinutes: 12840,
    productiveMinutes: 8450,
    unproductiveMinutes: 2340,
    neutralMinutes: 2050,
    idleMinutes: 3200,
    productivityScore: 66,
    topApp: 'Microsoft Visual Studio Code',
    topWebsite: 'github.com'
  },
  weeklyData: [
    { day: 'Mon', productive: 85, unproductive: 10, idle: 5 },
    { day: 'Tue', productive: 78, unproductive: 12, idle: 10 },
    { day: 'Wed', productive: 82, unproductive: 8, idle: 10 },
    { day: 'Thu', productive: 75, unproductive: 15, idle: 10 },
    { day: 'Fri', productive: 65, unproductive: 20, idle: 15 },
    { day: 'Sat', productive: 30, unproductive: 40, idle: 30 },
    { day: 'Sun', productive: 20, unproductive: 30, idle: 50 }
  ],
  appUsage: [
    { name: 'VS Code', minutes: 420, category: 'productive', color: '#22c55e' },
    { name: 'Chrome', minutes: 380, category: 'mixed', color: '#3b82f6' },
    { name: 'Slack', minutes: 180, category: 'productive', color: '#22c55e' },
    { name: 'Teams', minutes: 150, category: 'productive', color: '#22c55e' },
    { name: 'Excel', minutes: 120, category: 'productive', color: '#22c55e' },
    { name: 'YouTube', minutes: 90, category: 'unproductive', color: '#ef4444' },
    { name: 'Twitter', minutes: 60, category: 'unproductive', color: '#ef4444' },
    { name: 'Other', minutes: 200, category: 'neutral', color: '#64748b' }
  ],
  employees: [
    { id: 1, name: 'John Smith', department: 'Engineering', score: 92, status: 'active', computer: 'WS-001' },
    { id: 2, name: 'Sarah Johnson', department: 'Marketing', score: 78, status: 'active', computer: 'WS-015' },
    { id: 3, name: 'Michael Chen', department: 'Engineering', score: 88, status: 'idle', computer: 'WS-008' },
    { id: 4, name: 'Emily Davis', department: 'Sales', score: 71, status: 'active', computer: 'WS-022' },
    { id: 5, name: 'Robert Wilson', department: 'HR', score: 65, status: 'away', computer: 'WS-031' },
    { id: 6, name: 'Lisa Anderson', department: 'Engineering', score: 95, status: 'active', computer: 'WS-012' },
    { id: 7, name: 'David Martinez', department: 'Finance', score: 82, status: 'active', computer: 'WS-019' },
    { id: 8, name: 'Jennifer Brown', department: 'Marketing', score: 74, status: 'idle', computer: 'WS-027' }
  ],
  recentActivity: [
    { id: 1, user: 'John Smith', app: 'VS Code', title: 'Editing main.ts', time: '2 min ago', category: 'productive' },
    { id: 2, user: 'Sarah Johnson', app: 'Chrome', title: 'Working on campaign.doc', time: '5 min ago', category: 'productive' },
    { id: 3, user: 'Michael Chen', app: 'Slack', title: '#engineering channel', time: '12 min ago', category: 'productive' },
    { id: 4, user: 'Emily Davis', app: 'Excel', title: 'Sales Report Q4', time: '18 min ago', category: 'productive' },
    { id: 5, user: 'Lisa Anderson', app: 'Chrome', title: 'github.com/pr', time: '25 min ago', category: 'productive' },
    { id: 6, user: 'David Martinez', app: 'Chrome', title: 'youtube.com/watch', time: '32 min ago', category: 'unproductive' }
  ],
  computers: [
    { id: 'WS-001', hostname: 'JOHN-DESK-01', user: 'John Smith', status: 'online', lastSeen: 'Just now', os: 'Windows 11' },
    { id: 'WS-015', hostname: 'SARAH-LAPTOP', user: 'Sarah Johnson', status: 'online', lastSeen: '5 min ago', os: 'Windows 10' },
    { id: 'WS-008', hostname: 'MICHAEL-PC', user: 'Michael Chen', status: 'idle', lastSeen: '15 min ago', os: 'Windows 11' },
    { id: 'WS-022', hostname: 'EMILY-DESK', user: 'Emily Davis', status: 'online', lastSeen: 'Just now', os: 'Windows 11' },
    { id: 'WS-031', hostname: 'ROBERT-LAPTOP', user: 'Robert Wilson', status: 'offline', lastSeen: '2 hours ago', os: 'Windows 10' }
  ]
};

// Auth Provider
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token
    const token = localStorage.getItem('epm_token');
    if (token) {
      // In production, validate token with server
      setUser({ email: 'admin@acme.com', name: 'Admin User', role: 'admin', company: DEMO_DATA.company });
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // Demo login
    if (email && password) {
      const token = 'demo_token_' + Date.now();
      localStorage.setItem('epm_token', token);
      setUser({ email, name: 'Admin User', role: 'admin', company: DEMO_DATA.company });
      return true;
    }
    throw new Error('Invalid credentials');
  };

  const logout = () => {
    localStorage.removeItem('epm_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-200 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Login Page
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500 mb-4">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">EPM Commercial</h1>
          <p className="text-gray-400">Employee Productivity Monitor</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="admin@company.com"
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-center text-gray-500 text-sm">
              Demo credentials: any email/password
            </p>
          </div>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          © 2024 EPM Commercial. All rights reserved.
        </p>
      </div>
    </div>
  );
};

// Dashboard Page
const DashboardPage = () => {
  const { user } = useAuth();
  const stats = DEMO_DATA.todayStats;
  const weeklyData = DEMO_DATA.weeklyData;

  const COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#64748b'];

  return (
    <div className="animate-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Welcome back, {user?.name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-primary-500/20">
              <Users className="w-5 h-5 text-primary-500" />
            </div>
            <span className="text-green-500 text-sm font-medium">+5%</span>
          </div>
          <div className="text-3xl font-bold text-white">{stats.activeEmployees}</div>
          <div className="text-gray-400 text-sm">Active Employees</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-green-500 text-sm font-medium">+12%</span>
          </div>
          <div className="text-3xl font-bold text-white">{Math.round(stats.totalActiveMinutes / 60)}h</div>
          <div className="text-gray-400 text-sm">Total Active Time</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-green-500 text-sm font-medium">+8%</span>
          </div>
          <div className="text-3xl font-bold text-white">{stats.productivityScore}%</div>
          <div className="text-gray-400 text-sm">Productivity Score</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Timer className="w-5 h-5 text-yellow-500" />
            </div>
            <span className="text-red-500 text-sm font-medium">-3%</span>
          </div>
          <div className="text-3xl font-bold text-white">{Math.round(stats.idleMinutes / 60)}h</div>
          <div className="text-gray-400 text-sm">Idle Time</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Productivity Trend */}
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Weekly Productivity Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="productive" stroke="#22c55e" fillOpacity={1} fill="url(#colorProd)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Time Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Time Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Productive', value: stats.productiveMinutes },
                    { name: 'Unproductive', value: stats.unproductiveMinutes },
                    { name: 'Neutral', value: stats.neutralMinutes },
                    { name: 'Idle', value: stats.idleMinutes }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => `${Math.round(value / 60)} min`}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {[
              { label: 'Productive', color: '#22c55e', value: stats.productiveMinutes },
              { label: 'Unproductive', color: '#ef4444', value: stats.unproductiveMinutes },
              { label: 'Neutral', color: '#64748b', value: stats.neutralMinutes },
              { label: 'Idle', color: '#f59e0b', value: stats.idleMinutes }
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-sm text-gray-400">{item.label}</span>
                <span className="text-sm font-medium ml-auto">{Math.round(item.value / 60)}m</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity & Top Apps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
            <Link to="/activity" className="text-primary-500 text-sm hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {DEMO_DATA.recentActivity.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg bg-dark-300/50 hover:bg-dark-300 transition-colors">
                <div className={`w-2 h-2 rounded-full ${activity.category === 'productive' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{activity.user}</div>
                  <div className="text-xs text-gray-500 truncate">{activity.app} - {activity.title}</div>
                </div>
                <div className="text-xs text-gray-500">{activity.time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Applications */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Top Applications</h3>
            <Link to="/reports" className="text-primary-500 text-sm hover:underline">View reports</Link>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DEMO_DATA.appUsage.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}m`} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} width={80} />
                <Tooltip
                  formatter={(value) => `${value} minutes`}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                />
                <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                  {DEMO_DATA.appUsage.slice(0, 6).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// Employees Page
const EmployeesPage = () => {
  const [employees] = useState(DEMO_DATA.employees);
  const [filter, setFilter] = useState('all');

  const filteredEmployees = filter === 'all'
    ? employees
    : employees.filter(e => e.status === filter);

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Employees</h1>
          <p className="text-gray-400 mt-1">{employees.length} employees monitored</p>
        </div>
        <button className="btn btn-primary">
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {['all', 'active', 'idle', 'away'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === status
                ? 'bg-primary-500 text-white'
                : 'bg-dark-100 text-gray-400 hover:bg-dark-300'
            }`}
          >
            {status} ({status === 'all' ? employees.length : employees.filter(e => e.status === status).length})
          </button>
        ))}
      </div>

      {/* Employee Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredEmployees.map((employee) => (
          <div key={employee.id} className="card hover:border-gray-700 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold">
                {employee.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">{employee.name}</h3>
                <p className="text-sm text-gray-400">{employee.department}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    employee.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    employee.status === 'idle' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                      employee.status === 'active' ? 'bg-green-400' :
                      employee.status === 'idle' ? 'bg-yellow-400' :
                      'bg-gray-400'
                    }`}></span>
                    {employee.status}
                  </span>
                  <span className="text-xs text-gray-500">{employee.computer}</span>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${
                  employee.score >= 80 ? 'text-green-500' :
                  employee.score >= 60 ? 'text-yellow-500' :
                  'text-red-500'
                }`}>{employee.score}%</div>
                <div className="text-xs text-gray-500">Productivity</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Computer</span>
                <span className="text-gray-300">{employee.computer}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Computers Page
const ComputersPage = () => {
  const [computers] = useState(DEMO_DATA.computers);

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Computers</h1>
          <p className="text-gray-400 mt-1">{computers.length} computers registered</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Computer ID</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Hostname</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">OS</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {computers.map((computer) => (
              <tr key={computer.id} className="border-b border-gray-800 hover:bg-dark-300/50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-gray-500" />
                    <span className="font-mono text-sm">{computer.id}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm">{computer.hostname}</td>
                <td className="py-3 px-4 text-sm">{computer.user}</td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    computer.status === 'online' ? 'bg-green-500/20 text-green-400' :
                    computer.status === 'idle' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                      computer.status === 'online' ? 'bg-green-400' :
                      computer.status === 'idle' ? 'bg-yellow-400' :
                      'bg-gray-400'
                    }`}></span>
                    {computer.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-gray-400">{computer.os}</td>
                <td className="py-3 px-4 text-sm text-gray-400">{computer.lastSeen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Reports Page
const ReportsPage = () => {
  const [dateRange, setDateRange] = useState('7d');

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-gray-400 mt-1">Generate and view productivity reports</p>
        </div>
        <div className="flex gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="input w-auto"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button className="btn btn-primary">
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Weekly Overview */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-4">Weekly Overview</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={DEMO_DATA.weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              />
              <Bar dataKey="productive" stackId="a" fill="#22c55e" name="Productive" />
              <Bar dataKey="unproductive" stackId="a" fill="#ef4444" name="Unproductive" />
              <Bar dataKey="idle" stackId="a" fill="#64748b" name="Idle" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Application Usage */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Application Usage Breakdown</h3>
        <div className="space-y-4">
          {DEMO_DATA.appUsage.map((app, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{app.name}</span>
                <span className="text-sm text-gray-400">{app.minutes} min</span>
              </div>
              <div className="h-2 bg-dark-300 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(app.minutes / 500) * 100}%`,
                    backgroundColor: app.color
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Activity Page
const ActivityPage = () => {
  const [activities] = useState(DEMO_DATA.recentActivity);

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Activity</h1>
          <p className="text-gray-400 mt-1">Real-time employee activity feed</p>
        </div>
        <button className="btn btn-secondary">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="card flex items-center gap-4">
            <div className={`p-2 rounded-lg ${
              activity.category === 'productive' ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
              <AppWindow className={`w-5 h-5 ${
                activity.category === 'productive' ? 'text-green-500' : 'text-red-500'
              }`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{activity.user}</span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-400">{activity.app}</span>
              </div>
              <div className="text-sm text-gray-500 mt-0.5">{activity.title}</div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-medium ${
                activity.category === 'productive' ? 'text-green-500' : 'text-red-500'
              }`}>
                {activity.category}
              </div>
              <div className="text-xs text-gray-500">{activity.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Settings Page
const SettingsPage = () => {
  const { user, logout } = useAuth();
  const company = DEMO_DATA.company;

  return (
    <div className="animate-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account and company settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Company Settings */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Company Information</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Company Name</label>
                <input type="text" defaultValue={company.name} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Employees</label>
                  <input type="text" defaultValue={company.employees} className="input" disabled />
                </div>
                <div>
                  <label className="label">Computers</label>
                  <input type="text" defaultValue={company.computers} className="input" disabled />
                </div>
              </div>
              <button className="btn btn-primary">Save Changes</button>
            </div>
          </div>

          {/* License Info */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">License Information</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-dark-300 rounded-lg">
                <div>
                  <div className="text-sm text-gray-400">Current Plan</div>
                  <div className="text-xl font-bold text-primary-500">{company.licenseTier}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">Seats</div>
                  <div className="text-xl font-bold">{company.computers}/{company.licenseSeats}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-400">License Expires</div>
                  <div className="font-medium">{company.licenseExpiry}</div>
                </div>
                <button className="btn btn-primary">Upgrade Plan</button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User Profile */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Profile</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
                {user?.name?.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div className="font-medium">{user?.name}</div>
                <div className="text-sm text-gray-400">{user?.email}</div>
              </div>
            </div>
            <button onClick={logout} className="btn btn-danger w-full justify-center">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          {/* Quick Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Hours This Week</span>
                <span className="font-medium">328h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Avg. Daily Productivity</span>
                <span className="font-medium">76%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Top Performer</span>
                <span className="font-medium text-primary-500">Lisa Anderson</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sidebar Component
const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/employees', icon: Users, label: 'Employees' },
    { path: '/computers', icon: Monitor, label: 'Computers' },
    { path: '/activity', icon: Activity, label: 'Live Activity' },
    { path: '/reports', icon: BarChart3, label: 'Reports' },
    { path: '/settings', icon: Settings, label: 'Settings' }
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-dark-100 border-r border-gray-800
        transform transition-transform duration-300 lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-white">EPM</div>
                <div className="text-xs text-gray-500">Commercial</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive
                      ? 'bg-primary-500/20 text-primary-500'
                      : 'text-gray-400 hover:bg-dark-300 hover:text-white'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom */}
          <div className="p-4 border-t border-gray-800">
            <div className="p-4 rounded-lg bg-dark-300">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-medium">License Active</span>
              </div>
              <div className="text-xs text-gray-500">
                Professional Plan • 52/50 seats
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

// Main Layout
const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-dark-200 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-gray-800 bg-dark-100 flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-dark-300"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden lg:flex items-center gap-4 flex-1">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search employees, computers..."
                className="input pl-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 rounded-lg hover:bg-dark-300 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
              A
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute><Layout><EmployeesPage /></Layout></ProtectedRoute>} />
          <Route path="/computers" element={<ProtectedRoute><Layout><ComputersPage /></Layout></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute><Layout><ActivityPage /></Layout></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Layout><ReportsPage /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><SettingsPage /></Layout></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
