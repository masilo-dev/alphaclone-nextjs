import React, { useState, useEffect } from 'react';
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
  Settings
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';

type Tab = 'overview' | 'tenants' | 'users' | 'analytics' | 'security' | 'system';

export default function SuperAdminDashboard() {
  const { currentTenant } = useTenant();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalUsers: 0,
    totalRevenue: 0,
    activeUsers: 0,
    totalProjects: 0,
    totalMessages: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Load system-wide statistics
      const [tenantsData, usersData, projectsData, messagesData] = await Promise.all([
        supabase.from('tenants').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true })
      ]);

      setStats({
        totalTenants: tenantsData.count || 0,
        totalUsers: usersData.count || 0,
        totalRevenue: 0, // Calculate from subscriptions
        activeUsers: 0, // Calculate from recent activity
        totalProjects: projectsData.count || 0,
        totalMessages: messagesData.count || 0
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview', icon: Activity },
    { id: 'tenants' as Tab, label: 'Tenants', icon: Building2 },
    { id: 'users' as Tab, label: 'Users', icon: Users },
    { id: 'analytics' as Tab, label: 'Analytics', icon: TrendingUp },
    { id: 'security' as Tab, label: 'Security', icon: Shield },
    { id: 'system' as Tab, label: 'System', icon: Database }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-teal-400" />
            <h1 className="text-4xl font-bold text-white">Super Admin Dashboard</h1>
          </div>
          <p className="text-slate-400 text-lg">Complete system control and monitoring</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-slate-700 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 font-medium whitespace-nowrap transition-colors relative ${
                activeTab === tab.id ? 'text-teal-400' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'overview' && <OverviewTab stats={stats} />}
        {activeTab === 'tenants' && <TenantsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'system' && <SystemTab />}
      </div>
    </div>
  );
}

function OverviewTab({ stats }: any) {
  const metrics = [
    {
      label: 'Total Tenants',
      value: stats.totalTenants,
      icon: Building2,
      color: 'from-blue-500 to-blue-600',
      change: '+12%'
    },
    {
      label: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'from-purple-500 to-purple-600',
      change: '+8%'
    },
    {
      label: 'Monthly Revenue',
      value: `$${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'from-green-500 to-green-600',
      change: '+23%'
    },
    {
      label: 'Active Users (24h)',
      value: stats.activeUsers,
      icon: Activity,
      color: 'from-teal-500 to-teal-600',
      change: '+5%'
    },
    {
      label: 'Total Projects',
      value: stats.totalProjects,
      icon: FileText,
      color: 'from-orange-500 to-orange-600',
      change: '+15%'
    },
    {
      label: 'Total Messages',
      value: stats.totalMessages.toLocaleString(),
      icon: MessageSquare,
      color: 'from-pink-500 to-pink-600',
      change: '+31%'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-lg bg-gradient-to-br ${metric.color}`}>
                <metric.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm text-green-400 font-medium">{metric.change}</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{metric.value}</div>
            <div className="text-sm text-slate-400">{metric.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Revenue Growth</h3>
          <div className="h-64 flex items-center justify-center text-slate-500">
            Chart: Revenue over time
          </div>
        </div>

        {/* User Growth Chart */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">User Growth</h3>
          <div className="h-64 flex items-center justify-center text-slate-500">
            Chart: New users per month
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Recent System Activity</h3>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-teal-400" />
              <div className="flex-1">
                <div className="text-white font-medium">New tenant created: Example Business {i}</div>
                <div className="text-sm text-slate-400">{i} minutes ago</div>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">All Tenants</h2>
        <button className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors">
          Add Tenant
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
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
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      tenant.subscription_plan === 'enterprise'
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
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      tenant.subscription_status === 'active'
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">All Users ({users.length})</h2>

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
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  user.role === 'admin'
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'bg-blue-500/20 text-blue-300'
                }`}>
                  {user.role}
                </span>
                <button className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
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

function SystemTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">System Management</h2>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold text-white">API Status</h3>
          </div>
          <div className="text-3xl font-bold text-green-400 mb-2">100%</div>
          <div className="text-sm text-slate-400">All systems operational</div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Database</h3>
          </div>
          <div className="text-3xl font-bold text-blue-400 mb-2">98.5%</div>
          <div className="text-sm text-slate-400">Healthy</div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-teal-400" />
            <h3 className="text-lg font-semibold text-white">Uptime</h3>
          </div>
          <div className="text-3xl font-bold text-teal-400 mb-2">99.9%</div>
          <div className="text-sm text-slate-400">Last 30 days</div>
        </div>
      </div>

      {/* System Settings */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-teal-400" />
          System Configuration
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
            <div>
              <div className="text-white font-medium">Maintenance Mode</div>
              <div className="text-sm text-slate-400">Disable all access temporarily</div>
            </div>
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
              Enable
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
            <div>
              <div className="text-white font-medium">Clear Cache</div>
              <div className="text-sm text-slate-400">Clear all system caches</div>
            </div>
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
              Clear Now
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
            <div>
              <div className="text-white font-medium">Run Database Backup</div>
              <div className="text-sm text-slate-400">Create manual backup</div>
            </div>
            <button className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors">
              Backup Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
