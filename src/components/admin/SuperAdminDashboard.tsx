import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Users,
  Building2,
  DollarSign,
  Activity,
  TrendingUp,
  Map,
  Globe,
  Shield,
  Database,
  Zap,
  MessageSquare,
  FileText,
  Settings,
  Trash2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';

type Tab = 'overview' | 'tenants' | 'users' | 'analytics' | 'security' | 'system' | 'growth';

interface SuperAdminDashboardProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export default function SuperAdminDashboard({ activeTab: externalTab, setActiveTab: externalSetTab }: SuperAdminDashboardProps) {
  const { currentTenant } = useTenant();
  // Use external tab if provided (from Sidebar), otherwise fallback to internal
  const [internalTab, setInternalTab] = useState<Tab>('overview');
  const activeTab = (externalTab as Tab) || internalTab;
  const setActiveTab = externalSetTab || ((t: string) => setInternalTab(t as Tab));

  const [stats, setStats] = useState({
    totalTenants: 0,
    totalUsers: 0,
    totalRevenue: 0,
    activeUsers: 0,
    newUsers30d: 0,
    totalProjects: 0,
    totalMessages: 0
  });

  const loadStats = async () => {
    try {
      // Get current timestamp for relative calculations
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Load system-wide statistics
      const [
        tenantsData,
        usersData,
        activeUsersData,
        newUsersData,
        projectsData,
        messagesData,
        revenueData
      ] = await Promise.all([
        supabase.from('tenants').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('last_seen', twentyFourHoursAgo),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('created_at', thirtyDaysAgo),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('invoices').select('amount').eq('status', 'paid')
      ]);

      const totalRevenue = revenueData.data?.reduce((sum: number, inv: { amount: number | string }) => sum + Number(inv.amount), 0) || 0;

      setStats({
        totalTenants: tenantsData.count || 0,
        totalUsers: usersData.count || 0,
        totalRevenue: totalRevenue,
        activeUsers: activeUsersData.count || 0,
        newUsers30d: newUsersData.count || 0,
        totalProjects: projectsData.count || 0,
        totalMessages: messagesData.count || 0
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-7 h-7 text-teal-400" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Super Admin Dashboard</h1>
        </div>
        <p className="text-slate-400 text-sm">Complete system control and monitoring</p>
      </div>

      {/* Content — no horizontal tabs, driven by sidebar */}
      {activeTab === 'overview' && <OverviewTab stats={stats} />}
      {activeTab === 'tenants' && <TenantsTab />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'analytics' && <AnalyticsTab />}
      {activeTab === 'security' && <SecurityTab />}
      {activeTab === 'system' && <SystemTab />}
      {activeTab === 'growth' && <GrowthTab />}
    </div>
  );
}


function SystemTab() {
  const [showAddRole, setShowAddRole] = useState(false);

  const handleSaveRole = async () => {
    // Placeholder for Role Saving
    toast.success('Role saved (simulation)');
    setShowAddRole(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Global Settings</h2>
        <button
          onClick={() => setShowAddRole(true)}
          className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Settings className="w-4 h-4" /> Add Role
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Platform Roles</h3>
          <div className="space-y-2">
            {['Super Admin', 'Tenant Admin', 'Staff', 'Client'].map(role => (
              <div key={role} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                <span className="text-white font-medium">{role}</span>
                <span className="text-xs text-slate-500 uppercase">System Default</span>
              </div>
            ))}
            {/* Mock User Added Role */}
            <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-teal-500/20">
              <span className="text-white font-medium">Support Agent</span>
              <div className="flex gap-2">
                <button className="text-teal-400 text-xs hover:underline">Edit</button>
                <button className="text-red-400 text-xs hover:underline">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddRole && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Add New Global Role</h3>
            <input type="text" placeholder="Role Name" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowAddRole(false)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">Cancel</button>
              <button onClick={handleSaveRole} className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg">Save Role</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GrowthTab() {
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateLeads = async () => {
    if (!industry || !location) {
      setError('Please enter both industry and location');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const { generateLeads } = await import('../../services/unifiedAIService');
      // Pass empty string for Google API key if not managed here
      const { leads: results } = await generateLeads(industry, location, undefined, 'admin');
      setLeads(results);
    } catch (err: any) {
      setError(err.message || 'Failed to generate leads');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Lead Generation & Growth</h2>
        <div className="flex items-center gap-2 px-3 py-1 bg-teal-500/10 border border-teal-500/20 rounded-full">
          <Zap className="w-4 h-4 text-teal-400" />
          <span className="text-xs font-medium text-teal-400">AlphaClone AI Engine</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Find New Targets</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Industry</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. Solar Energy, Law Firms"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. New York, London, Remote"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <button
                onClick={handleGenerateLeads}
                disabled={isGenerating}
                className="w-full py-3 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Finding Leads...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    Find Leads
                  </>
                )}
              </button>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
            <h4 className="text-blue-400 font-bold text-sm mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Premium Data Search
            </h4>
            <p className="text-slate-300 text-xs">
              Our AI engine provides real, enriched business data including contact details and social links
              for high-precision targeting.
            </p>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 h-full min-h-[400px]">
            <h3 className="text-lg font-semibold text-white mb-6">Generated Leads ({leads.length})</h3>

            {leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-center">
                <TrendingUp className="w-12 h-12 text-slate-700 mb-4" />
                <p className="text-slate-500">Run a search to find new business opportunities.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {leads.map((lead, idx) => (
                  <div key={idx} className="bg-slate-900/50 border border-slate-700 p-4 rounded-lg hover:border-teal-500/30 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-white font-bold truncate pr-2">{lead.businessName}</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${lead.leadSource === 'AlphaClone Premium' ? 'bg-teal-500/20 text-teal-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                        {lead.leadSource === 'AlphaClone Premium' ? 'AlphaClone Premium' : lead.leadSource}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-slate-400 truncate">
                        <Map className="w-3 h-3 flex-shrink-0" />
                        {lead.location}
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 truncate">
                        <MessageSquare className="w-3 h-3 flex-shrink-0" />
                        {lead.email || 'No email found'}
                      </div>
                      {lead.outreachHook && (
                        <div className="mt-2 text-[11px] text-teal-400/80 italic line-clamp-1 border-l border-teal-500/30 pl-2">
                          "{lead.outreachHook}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ stats }: { stats: any }) {
  const metrics = [
    {
      label: 'Total Tenants',
      value: stats.totalTenants,
      icon: Building2,
      color: 'from-blue-500/20 to-blue-600/20',
      iconColor: 'text-blue-400',
      borderColor: 'border-blue-500/20',
      change: '+12%',
      trend: 'up'
    },
    {
      label: 'Platform Users',
      value: stats.totalUsers,
      subValue: `${stats.newUsers30d} new this month`,
      icon: Users,
      color: 'from-purple-500/20 to-purple-600/20',
      iconColor: 'text-purple-400',
      borderColor: 'border-purple-500/20',
      change: '+8%',
      trend: 'up'
    },
    {
      label: 'Total Revenue',
      value: `$${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'from-green-500/20 to-green-600/20',
      iconColor: 'text-green-400',
      borderColor: 'border-green-500/20',
      change: '+23%',
      trend: 'up'
    },
    {
      label: 'Active (24h)',
      value: stats.activeUsers,
      icon: Activity,
      color: 'from-teal-500/20 to-teal-600/20',
      iconColor: 'text-teal-400',
      borderColor: 'border-teal-500/20',
      change: '+5%',
      trend: 'up'
    },
    {
      label: 'Total Projects',
      value: stats.totalProjects,
      icon: FileText,
      color: 'from-orange-500/20 to-orange-600/20',
      iconColor: 'text-orange-400',
      borderColor: 'border-orange-500/20',
      change: '+15%',
      trend: 'up'
    },
    {
      label: 'Total Messages',
      value: stats.totalMessages.toLocaleString(),
      icon: MessageSquare,
      color: 'from-indigo-500/20 to-indigo-600/20',
      iconColor: 'text-indigo-400',
      borderColor: 'border-indigo-500/20',
      change: '+31%',
      trend: 'up'
    }
  ];

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className={`group relative bg-slate-900/40 border ${metric.borderColor} rounded-2xl p-6 hover:bg-slate-800/40 transition-all duration-300 backdrop-blur-sm overflow-hidden`}
          >
            {/* Background Glow */}
            <div className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${metric.color} blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

            <div className="flex items-start justify-between relative z-10">
              <div className={`p-3 rounded-xl bg-slate-900/80 border ${metric.borderColor} shadow-inner`}>
                <metric.icon className={`w-6 h-6 ${metric.iconColor}`} />
              </div>
              <div className="flex flex-col items-end">
                <span className={`flex items-center gap-1 text-xs font-bold py-1 px-2 rounded-full ${metric.trend === 'up' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                  <TrendingUp className="w-3 h-3" />
                  {metric.change}
                </span>
                {metric.subValue && <span className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold">{metric.subValue}</span>}
              </div>
            </div>

            <div className="mt-6 relative z-10">
              <div className="text-4xl font-black text-white tracking-tight mb-1">
                {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
              </div>
              <div className="text-sm font-medium text-slate-400 uppercase tracking-widest">{metric.label}</div>
            </div>

            {/* Progress Bar (Visual Only) */}
            <div className="mt-4 h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${metric.color.replace('/20', '')} rounded-full`}
                style={{ width: `${Math.min(100, (index + 1) * 15 + 40)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        {/* Revenue Chart */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6 lg:p-8 backdrop-blur-md relative group min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 min-w-0">
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400 shrink-0" />
                Revenue Trajectory
              </h3>
              <p className="text-slate-500 text-sm">Monthly performance across all tenants</p>
            </div>
            <select className="bg-slate-800 border-none text-xs text-white rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-teal-500 w-full sm:w-auto shrink-0">
              <option>Last 6 Months</option>
              <option>Last Year</option>
            </select>
          </div>
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
            <TrendingUp className="w-12 h-12 text-slate-800 mb-4" />
            <p className="text-slate-600 font-medium">Accumulating Data Insights...</p>
            <p className="text-slate-700 text-xs mt-1 italic">Visual analytics will initialize as payments scale</p>
          </div>
        </div>

        {/* User Growth Chart */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6 lg:p-8 backdrop-blur-md relative group min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 min-w-0">
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400 shrink-0" />
                Ecosystem Expansion
              </h3>
              <p className="text-slate-500 text-sm">User acquisition and retention metrics</p>
            </div>
            <select className="bg-slate-800 border-none text-xs text-white rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-teal-500 w-full sm:w-auto shrink-0">
              <option>Last 30 Days</option>
              <option>Total History</option>
            </select>
          </div>
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
            <Activity className="w-12 h-12 text-slate-800 mb-4" />
            <p className="text-slate-600 font-medium">Visualizing User Lifecycle...</p>
            <p className="text-slate-700 text-xs mt-1 italic">Real-time cohort analysis in progress</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6 lg:p-8 backdrop-blur-md min-w-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 min-w-0">
          <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-teal-400 shrink-0" />
            System Pulse
          </h3>
          <button type="button" className="text-xs text-teal-400 hover:text-teal-300 font-bold uppercase tracking-widest self-start sm:self-auto">
            View All Logs
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-slate-800/30 border border-white/5 rounded-xl hover:bg-slate-800/50 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
                <Globe className="w-5 h-5 text-teal-500" />
              </div>
              <div className="flex-1">
                <div className="text-white text-sm font-semibold">Security audit completion for Tenant {i * 102}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500 uppercase font-black">{i * 2}h ago</span>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <span className="text-[10px] text-teal-500/70 font-bold uppercase">Success</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TenantsTab() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const { data } = await supabase
        .from('tenants')
        .select(`
          *,
          tenant_users (count)
        `)
        .order('created_at', { ascending: false });

      setTenants(data || []);
    } catch (error) {
      console.error('Failed to load tenants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <h2 className="text-xl sm:text-2xl font-bold text-white">All Tenants</h2>
        <button type="button" className="px-4 py-2.5 sm:py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors w-full sm:w-auto shrink-0">
          Add Tenant
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="bg-slate-900/50 border-b border-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Business Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Slug</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Plan</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Users</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Created</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            ) : tenants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                  No tenants yet
                </td>
              </tr>
            ) : (
              tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center text-white font-bold">
                        {tenant.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-white font-medium">{tenant.name}</div>
                        <div className="text-xs text-slate-400">{tenant.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="px-2 py-1 bg-slate-900 rounded text-teal-400 text-sm">
                      {tenant.slug}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${tenant.subscription_plan === 'enterprise'
                      ? 'bg-purple-500/20 text-purple-300'
                      : tenant.subscription_plan === 'professional'
                        ? 'bg-blue-500/20 text-blue-300'
                        : tenant.subscription_plan === 'starter'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-slate-600 text-slate-300'
                      }`}>
                      {tenant.subscription_plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white">
                    {tenant.tenant_users?.[0]?.count || 0}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${tenant.subscription_status === 'active'
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-red-500/20 text-red-300'
                      }`}>
                      {tenant.subscription_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <button className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors">
                      Manage
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      setUsers(data || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);

    // Preview the data
    try {
      const { fileImportService } = await import('../../services/fileImportService');
      const { contacts, error } = await fileImportService.importFromExcel(file);

      if (error) {
        toast.error('Error reading file: ' + error);
        return;
      }

      setImportPreview(contacts.slice(0, 5)); // Show first 5 for preview
    } catch (err) {
      console.error('Preview error:', err);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    try {
      const { fileImportService } = await import('../../services/fileImportService');
      const { contacts, error } = await fileImportService.importFromExcel(importFile);

      if (error) {
        toast.error('Import failed: ' + error);
        return;
      }

      // Import users to database
      let successCount = 0;
      for (const contact of contacts) {
        try {
          // Create user profile (simplified - in production you'd use proper auth)
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              name: contact.name,
              email: contact.email,
              phone: contact.phone,
              industry: contact.industry || '', // Use industry field
              location: contact.location || '',
              role: 'client',
              created_at: new Date().toISOString()
            });

          if (!insertError) successCount++;
        } catch (err) {
          console.error('Failed to import user:', contact.email, err);
        }
      }

      toast.success(`Successfully imported ${successCount} out of ${contacts.length} users`);
      setShowImportModal(false);
      setImportFile(null);
      setImportPreview([]);
      loadUsers(); // Reload the list
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">All Users ({users.length})</h2>
        <button
          onClick={() => setShowImportModal(true)}
          className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Import CSV/XLS
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {user.name?.charAt(0) || '?'}
                </div>
                <div>
                  <div className="text-white font-medium">{user.name || 'Unknown'}</div>
                  <div className="text-sm text-slate-400">{user.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.role === 'admin'
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'bg-blue-500/20 text-blue-300'
                  }`}>
                  {user.role}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => toast('Suspend user logic here')}
                    className="px-2 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs rounded transition-colors border border-orange-500/20"
                  >
                    Suspend
                  </button>
                  <button
                    onClick={() => toast('Block user logic here')}
                    className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded transition-colors border border-red-500/20"
                  >
                    Block
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete user?')) toast('Delete logic here');
                    }}
                    className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                    title="Delete User"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Import Users from CSV/XLS</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportPreview([]);
                }}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h4 className="text-blue-400 font-bold text-sm mb-2">Supported Columns</h4>
                <p className="text-slate-300 text-sm">
                  <strong>Required:</strong> Name, Email<br />
                  <strong>Optional:</strong> Phone, Industry, Location, Value (number)
                </p>
              </div>

              <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <svg className="w-12 h-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <div>
                    <p className="text-white font-medium">
                      {importFile ? importFile.name : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-slate-400 text-sm">CSV, XLS, or XLSX</p>
                  </div>
                </label>
              </div>

              {importPreview.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="text-white font-bold mb-3">Preview (first 5 rows)</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {importPreview.map((contact, idx) => (
                      <div key={idx} className="bg-slate-900 p-3 rounded text-sm">
                        <div className="text-white font-medium">{contact.name}</div>
                        <div className="text-slate-400">{contact.email}</div>
                        {contact.phone && <div className="text-slate-500 text-xs">Phone: {contact.phone}</div>}
                        {contact.industry && <div className="text-slate-500 text-xs">Industry: {contact.industry}</div>}
                        {contact.location && <div className="text-slate-500 text-xs">Location: {contact.location}</div>}
                        {contact.value > 0 && <div className="text-green-400 text-xs">Value: ${contact.value}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportPreview([]);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!importFile || isImporting}
                  className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing...' : `Import ${importPreview.length > 0 ? importPreview.length : ''} Users`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Analytics & Insights</h2>

      {/* User Location Map */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Map className="w-5 h-5 text-teal-400" />
          User Locations
        </h3>
        <div className="h-96 flex items-center justify-center text-slate-500 border border-slate-700 rounded-lg">
          World Map: User distribution by IP geolocation
        </div>
      </div>

      {/* Usage Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Most Active Tenants</h3>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                <span className="text-white">Tenant {i}</span>
                <span className="text-teal-400 font-medium">{1000 - i * 100} actions/day</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Top Features Used</h3>
          <div className="space-y-3">
            {['Projects', 'Messages', 'Tasks', 'CRM', 'Analytics'].map((feature, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                <span className="text-white">{feature}</span>
                <span className="text-teal-400 font-medium">{90 - i * 10}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Security & Monitoring</h2>

      {/* Security Alerts */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Recent Security Events</h3>
        <div className="space-y-3">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-red-400 mt-0.5" />
              <div className="flex-1">
                <div className="text-red-300 font-medium">Failed Login Attempts</div>
                <div className="text-sm text-red-400/70 mt-1">5 failed attempts from IP 192.168.1.1</div>
                <div className="text-xs text-red-500/50 mt-1">2 minutes ago</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* IP Tracking */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Active Sessions by IP</h3>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-slate-400" />
                <span className="text-white font-mono text-sm">192.168.{i}.{i}</span>
                <span className="text-slate-400 text-sm">• United States</span>
              </div>
              <span className="text-slate-400 text-sm">{i} active sessions</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


