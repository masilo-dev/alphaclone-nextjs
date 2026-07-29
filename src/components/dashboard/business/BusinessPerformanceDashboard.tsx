'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Activity, 
  DollarSign, 
  Users, 
  Share2, 
<<<<<<< HEAD
=======
  RefreshCcw, 
>>>>>>> origin/main
  ShieldCheck, 
  AlertCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Card } from '../../ui/UIComponents';
import { analyticsService, AnalyticsData } from '../../../services/analyticsService';
import { useCurrency } from '../../../hooks/useCurrency';
import { useTenant } from '@/contexts/TenantContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer } from '../../ui/ChartContainer';
<<<<<<< HEAD
import { StandardStatCard } from '@/components/ui/design-system';
import { EnterprisePageHeader } from '@/components/dashboard/responsive/EnterpriseModuleChrome';
=======
>>>>>>> origin/main

const BusinessPerformanceDashboard: React.FC = () => {
  const { currentTenant: tenant } = useTenant();
  const { format: formatCurrency } = useCurrency();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const defaultData = {
    revenue: {
      thisMonth: 0,
      trend: 0,
      byPeriod: [],
    },
    businessOS: {
      pipeline: {
        stats: [],
        weightedValue: 0,
      },
      automation: {
        successRate: 100,
        totalRuns: 0,
        statusCounts: {
          completed: 0,
          failed: 0,
        },
      },
    },
  };

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const analyticsRes = await analyticsService.getAnalytics('30d');
      const osData = await analyticsService.getBusinessOSData();
      
      const analyticsData = (analyticsRes?.data || {}) as any;
      const businessOSData = (osData || {}) as any;

      setData({
        revenue: {
          ...defaultData.revenue,
          ...(analyticsData.revenue || {}),
        },
        businessOS: {
          pipeline: {
            ...defaultData.businessOS.pipeline,
            ...(businessOSData.pipeline || {}),
          },
          automation: {
            ...defaultData.businessOS.automation,
            ...(businessOSData.automation || {}),
            statusCounts: {
              ...defaultData.businessOS.automation.statusCounts,
              ...(businessOSData.automation?.statusCounts || {}),
            },
          },
        },
      });
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setData(defaultData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenant?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
<<<<<<< HEAD
        <div className="w-12 h-12 border-4 border-[#adebb3]/20 border-t-[#adebb3] rounded-full animate-spin" />
        <p className="text-[#c0c0c0] animate-pulse">Syncing Business Intelligence...</p>
=======
        <div className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
        <p className="text-slate-400 animate-pulse">Syncing Business Intelligence...</p>
>>>>>>> origin/main
      </div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
<<<<<<< HEAD
    <div className="space-y-8 pb-12 ac-scroll-full ac-enterprise-module">
      <EnterprisePageHeader
        moduleKey="analytics"
        meta={{ title: 'Performance', description: 'Real-time performance metrics across your workspace.' }}
        secondaryActions={[{
          label: refreshing ? 'Syncing…' : 'Sync Engine',
          onClick: fetchData,
          disabled: refreshing,
        }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StandardStatCard
          label="Revenue Today"
          value={formatCurrency(data?.revenue?.thisMonth ?? 0)}
          themeColor="emerald"
          icon={DollarSign}
          interactive={false}
          comparisonText={`Trend: ${(data?.revenue?.trend ?? 0) >= 0 ? '+' : ''}${(data?.revenue?.trend ?? 0).toFixed(1)}%`}
        />
        <StandardStatCard
          label="Social Summary"
          value="12.4K"
          themeColor="purple"
          icon={Share2}
          interactive={false}
          comparisonText="Impressions · +14%"
        />
        <StandardStatCard
          label="Finance"
          value={formatCurrency(data?.revenue?.thisMonth ?? 0)}
          themeColor="teal"
          icon={DollarSign}
          interactive={false}
          comparisonText={`+${(data?.revenue?.trend ?? 0).toFixed(1)}% Monthly Revenue`}
        />
        <StandardStatCard
          label="Automation"
          value={`${(data?.businessOS?.automation?.successRate ?? 0).toFixed(1)}%`}
          themeColor="amber"
          icon={Zap}
          interactive={false}
          comparisonText={`${data?.businessOS?.automation?.totalRuns ?? 0} Runs (24h)`}
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Performance Chart */}
        <Card className="lg:col-span-2 p-8 border-white/5 bg-white/5 backdrop-blur-md overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#adebb3]" />
                <span className="text-xs text-[#c0c0c0]">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#00f0ff]" />
                <span className="text-xs text-[#c0c0c0]">Projects</span>
=======
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Business OS</h2>
          <p className="text-slate-400 mt-1">Real-time performance metrics across your entire ecosystem.</p>
        </div>
        <button 
          onClick={fetchData}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 transition-all disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium">Sync Engine</span>
        </button>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {/* Pipeline Health */}
        <motion.div variants={item}>
          <Card className="p-6 relative overflow-hidden group border-slate-800 bg-slate-900/40 backdrop-blur-md">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users className="w-12 h-12 text-blue-400" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-medium text-slate-300">Pipeline Health</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-2xl font-bold text-white">{(data?.businessOS?.pipeline?.stats || []).reduce((s: any, c: any) => s + (c?.dealCount || 0), 0)}</span>
                <span className="text-xs text-slate-400 mb-1">Active Deals</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Weighted Value</span>
                <span className="text-blue-400 font-mono font-bold">{formatCurrency(data?.businessOS?.pipeline?.weightedValue ?? 0)}</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: '65%' }} />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Social Engagement */}
        <motion.div variants={item}>
          <Card className="p-6 relative overflow-hidden group border-slate-800 bg-slate-900/40 backdrop-blur-md">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Share2 className="w-12 h-12 text-purple-400" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Share2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-medium text-slate-300">Social Summary</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-2xl font-bold text-white">12.4K</span>
                <div className="flex items-center gap-1 text-teal-400 text-xs font-bold mb-1">
                  <TrendingUp className="w-3 h-3" /> 14%
                </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Impressions</span>
                <span className="text-purple-400 font-bold">Live</span>
              </div>
              <div className="flex gap-1 mt-4">
                {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                  <div key={i} className="flex-1 bg-purple-500/20 rounded-t-sm self-end" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Finance Snapshot */}
        <motion.div variants={item}>
          <Card className="p-6 relative overflow-hidden group border-slate-800 bg-slate-900/40 backdrop-blur-md">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <DollarSign className="w-12 h-12 text-teal-400" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-medium text-slate-300">Finance</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-2xl font-bold text-white">{formatCurrency(data?.revenue?.thisMonth ?? 0)}</span>
                <span className="text-xs text-teal-400 font-bold mb-1">+{(data?.revenue?.trend ?? 0).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Monthly Revenue</span>
                <span className="text-slate-400">Paid Invoices</span>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800/50 flex justify-between">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Burn</p>
                  <p className="text-xs text-red-400 font-mono">-$2.4k</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Net</p>
                  <p className="text-xs text-teal-400 font-mono">+$8.1k</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Automation Health */}
        <motion.div variants={item}>
          <Card className="p-6 relative overflow-hidden group border-slate-800 bg-slate-900/40 backdrop-blur-md">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Zap className="w-12 h-12 text-yellow-400" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-medium text-slate-300">Automation</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-2xl font-bold text-white">{(data?.businessOS?.automation?.successRate ?? 0).toFixed(1)}%</span>
                <span className="text-xs text-yellow-400 font-bold mb-1">Health</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">{data?.businessOS?.automation?.totalRuns ?? 0} Runs (24h)</span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-green-400">Active</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <div className="flex-1 bg-slate-800 rounded-lg p-2 text-center">
                   <p className="text-[10px] text-slate-500 font-bold uppercase">Success</p>
                   <p className="text-xs text-white font-mono">{data?.businessOS?.automation?.statusCounts?.completed ?? 0}</p>
                </div>
                <div className="flex-1 bg-slate-800 rounded-lg p-2 text-center">
                   <p className="text-[10px] text-slate-500 font-bold uppercase">Fail</p>
                   <p className="text-xs text-red-400 font-mono">{data?.businessOS?.automation?.statusCounts?.failed ?? 0}</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Performance Chart */}
        <Card className="lg:col-span-2 p-8 border-slate-800 bg-slate-900/40 backdrop-blur-md overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-teal-500" />
                <span className="text-xs text-slate-400">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs text-slate-400">Projects</span>
>>>>>>> origin/main
              </div>
            </div>
          </div>
          
          <div className="mb-8">
<<<<<<< HEAD
             <h3 className="text-xl font-bold text-[#f5f5f5] mb-1">Revenue Momentum</h3>
             <p className="text-sm text-[#94a3b8]">Trailing 30-day performance snapshot.</p>
=======
             <h3 className="text-xl font-bold text-white mb-1">Revenue Momentum</h3>
             <p className="text-sm text-slate-500">Trailing 30-day performance snapshot.</p>
>>>>>>> origin/main
          </div>

          <div className="h-[350px] w-full">
            <ChartContainer className="h-full">
<<<<<<< HEAD
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={350}>
                <AreaChart data={data?.revenue?.byPeriod || []}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#adebb3" stopOpacity={0.34} />
                      <stop offset="95%" stopColor="#adebb3" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="dashboard-chart-grid" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#c0c0c0" 
=======
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.revenue?.byPeriod || []}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#475569" 
>>>>>>> origin/main
                    fontSize={12} 
                    tickFormatter={(val: any) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
<<<<<<< HEAD
                    stroke="#c0c0c0" 
=======
                    stroke="#475569" 
>>>>>>> origin/main
                    fontSize={12} 
                    axisLine={false} 
                    tickLine={false}
                    tickFormatter={(val: any) => `$${val > 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                  />
                  <Tooltip 
<<<<<<< HEAD
                    contentStyle={{ backgroundColor: 'rgba(2, 6, 23, 0.94)', border: '1px solid rgba(148, 163, 184, 0.16)', borderRadius: '12px', color: '#f5f5f5' }}
                    itemStyle={{ color: '#f5f5f5' }}
=======
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
>>>>>>> origin/main
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
<<<<<<< HEAD
                    stroke="#adebb3" 
=======
                    stroke="#14b8a6" 
>>>>>>> origin/main
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#revenueGrad)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </Card>

        {/* Sidebar Insights */}
        <div className="space-y-6">
          {/* Strategic Insights */}
<<<<<<< HEAD
          <Card className="p-6 border-white/5 bg-white/5 backdrop-blur-md">
            <h3 className="text-lg font-bold text-[#f5f5f5] mb-6 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#adebb3]" /> Executive Insights
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex gap-3">
                  <div className="mt-1 p-1.5 rounded-full bg-teal-500/10 text-teal-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#f5f5f5]">
                      Revenue momentum{' '}
                      {data?.revenue?.trend == null
                        ? 'unavailable'
                        : `${data.revenue.trend >= 0 ? '+' : ''}${Number(data.revenue.trend).toFixed(1)}%`}
                    </p>
                    <p className="text-xs text-[#94a3b8] mt-1">
                      Based on paid revenue for the selected analytics period versus the prior period.
                    </p>
=======
          <Card className="p-6 border-slate-800 bg-slate-900/40 backdrop-blur-md">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-400" /> Executive Insights
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="flex gap-3">
                  <div className="mt-1 p-1.5 rounded-full bg-blue-500/10 text-blue-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Revenue Momentum +12%</p>
                    <p className="text-xs text-slate-500 mt-1">Growth is outpacing project volume, suggesting higher average deal value.</p>
>>>>>>> origin/main
                  </div>
                </div>
              </div>

<<<<<<< HEAD
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex gap-3">
                  <div className="mt-1 p-1.5 rounded-full bg-amber-500/10 text-amber-400">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#f5f5f5]">Pipeline health</p>
                    <p className="text-xs text-[#94a3b8] mt-1">
                      Review deals and follow-ups in Sales for stagnant opportunities. Counts are not estimated on this panel.
                    </p>
=======
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="flex gap-3">
                  <div className="mt-1 p-1.5 rounded-full bg-yellow-500/10 text-yellow-400">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">7 Stagnant Leads</p>
                    <p className="text-xs text-slate-500 mt-1">Leads identified with zero activity for 7+ days. Automated follow-up recommended.</p>
>>>>>>> origin/main
                  </div>
                </div>
              </div>

<<<<<<< HEAD
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex gap-3">
                  <div className="mt-1 p-1.5 rounded-full bg-emerald-500/10 text-emerald-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#f5f5f5]">
                      Automation runs:{' '}
                      {Number(data?.businessOS?.automation?.totalRuns ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-[#94a3b8] mt-1">
                      Success rate:{' '}
                      {Number(data?.businessOS?.automation?.successRate ?? 0).toFixed(0)}% from recorded workflow runs.
                    </p>
=======
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="flex gap-3">
                  <div className="mt-1 p-1.5 rounded-full bg-green-500/10 text-green-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Automation Scaling</p>
                    <p className="text-xs text-slate-500 mt-1">System handled 240+ runs today with 98% success. Throughput is healthy.</p>
>>>>>>> origin/main
                  </div>
                </div>
              </div>
            </div>
            
<<<<<<< HEAD
            <button className="w-full mt-6 py-3 px-4 bg-[#3eb489] hover:bg-[#adebb3] text-[#0f172a] font-bold rounded-xl flex items-center justify-center gap-2 transition-all">
=======
            <button className="w-full mt-6 py-3 px-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all">
>>>>>>> origin/main
              Launch Orchestrator <ArrowRight className="w-4 h-4" />
            </button>
          </Card>

          {/* Activity Log Snapshot */}
<<<<<<< HEAD
          <Card className="p-6 border-white/5 bg-white/5 backdrop-blur-md">
            <h3 className="text-lg font-bold text-[#f5f5f5] mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#c0c0c0]" /> Recent Events
            </h3>
            <div className="space-y-6">
              {[
                { label: 'Deal Won', desc: 'AlphaCorp Enterprise', time: '12m ago', color: 'bg-[#adebb3]' },
                { label: 'Automation', desc: 'Email Sequence #4 sent', time: '45m ago', color: 'bg-[#00f0ff]' },
                { label: 'Invoice', desc: 'Sent to BetaSystems', time: '2h ago', color: 'bg-[#adebb3]' },
                { label: 'Lead', desc: 'New lead from LinkedIn', time: '4h ago', color: 'bg-[#7f00ff]' },
=======
          <Card className="p-6 border-slate-800 bg-slate-900/40 backdrop-blur-md">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" /> Recent Events
            </h3>
            <div className="space-y-6">
              {[
                { label: 'Deal Won', desc: 'AlphaCorp Enterprise', time: '12m ago', color: 'bg-green-500' },
                { label: 'Automation', desc: 'Email Sequence #4 sent', time: '45m ago', color: 'bg-blue-500' },
                { label: 'Invoice', desc: 'Sent to BetaSystems', time: '2h ago', color: 'bg-teal-500' },
                { label: 'Lead', desc: 'New lead from LinkedIn', time: '4h ago', color: 'bg-purple-500' },
>>>>>>> origin/main
              ].map((ev, i) => (
                <div key={i} className="flex gap-4">
                  <div className="relative">
                    <div className={`w-3 h-3 rounded-full ${ev.color} mt-1`} />
<<<<<<< HEAD
                    {i < 3 && <div className="absolute top-4 left-[5.5px] bottom-[-24px] w-[1px] bg-white/5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-bold text-[#f5f5f5]">{ev.label}</p>
                      <span className="text-[10px] text-[#94a3b8] font-bold uppercase">{ev.time}</span>
                    </div>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{ev.desc}</p>
=======
                    {i < 3 && <div className="absolute top-4 left-[5.5px] bottom-[-24px] w-[1px] bg-slate-800" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-bold text-white">{ev.label}</p>
                      <span className="text-[10px] text-slate-600 font-bold uppercase">{ev.time}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{ev.desc}</p>
>>>>>>> origin/main
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BusinessPerformanceDashboard;
