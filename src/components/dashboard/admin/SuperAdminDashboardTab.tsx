'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  AlertTriangle,
  ShieldCheck,
  UserCheck,
  UserMinus,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { userService } from '@/services/userService';

export const SuperAdminDashboardTab: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    const { metrics: data } = await userService.getAdminDashboardStats();
    if (data) setMetrics(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 font-medium">Loading Platform Executive Overview...</p>
        </div>
      </div>
    );
  }

  const users = metrics?.users || {};
  const workspaces = metrics?.workspaces || {};
  const platform = metrics?.platform || {};
  const warnings: string[] = platform.systemWarnings || [];
  const recentLogs: any[] = metrics?.security?.recentAuditLogs || [];

  return (
    <div className="space-y-6 animate-fade-in ac-enterprise-module">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-400" />
            Super Admin Control Center
          </h2>
          <p className="text-slate-400 text-sm">Platform-wide health & executive overview</p>
        </div>
        <button
          onClick={fetchMetrics}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-white/5 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Stats
        </button>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Users</span>
            <Users className="w-5 h-5 text-teal-400" />
          </div>
          <p className="text-3xl font-black text-white">{users.total || 0}</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400 font-bold">+{users.newToday || 0} today</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">+{users.newThisWeek || 0} this week</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active vs Suspended</span>
            <UserCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-white">{users.active || 0}</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400 font-bold">{users.active || 0} active</span>
            <span className="text-slate-500">•</span>
            <span className="text-orange-400 font-bold">{users.suspended || 0} suspended</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Workspaces</span>
            <Building2 className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-black text-white">{workspaces.total || 0}</p>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>+{workspaces.newThisWeek || 0} created this week</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Password Resets</span>
            <UserMinus className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-3xl font-black text-white">{users.pendingPasswordReset || 0}</p>
          <div className="flex items-center gap-2 text-xs text-purple-400">
            <span>Forced bootstrap resets</span>
          </div>
        </div>
      </div>

      {/* Actionable Warnings */}
      {warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-2">
          <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Platform System Warnings ({warnings.length})
          </h3>
          <ul className="space-y-1">
            {warnings.map((w, idx) => (
              <li key={idx} className="text-xs text-amber-200/90 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent Security & Admin Activity */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-400" />
          Recent Platform Audit Activity
        </h3>

        {recentLogs.length === 0 ? (
          <p className="text-xs text-slate-500">No audit events recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {recentLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="px-2 py-0.5 bg-slate-800 text-teal-300 font-mono text-[10px] rounded uppercase font-bold">
                    {log.action}
                  </span>
                  <p className="text-slate-300 font-medium">{log.resource_type} ({log.resource_id})</p>
                </div>
                <span className="text-slate-500 text-[11px]">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboardTab;
