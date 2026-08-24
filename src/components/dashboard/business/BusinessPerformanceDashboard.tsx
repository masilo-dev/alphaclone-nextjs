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
import { StandardStatCard } from '@/components/ui/design-system';
import { EnterprisePageHeader } from '@/components/dashboard/responsive/EnterpriseModuleChrome';

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
        <div className="w-12 h-12 border-4 border-[#adebb3]/20 border-t-[#adebb3] rounded-full animate-spin" />
        <p className="text-[#c0c0c0] animate-pulse">Syncing Business Intelligence...</p>
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
              </div>
            </div>
          </div>
          
          <div className="mb-8">
             <h3 className="text-xl font-bold text-[#f5f5f5] mb-1">Revenue Momentum</h3>
             <p className="text-sm text-[#94a3b8]">Trailing 30-day performance snapshot.</p>
          </div>

          <div className="h-[350px] w-full">
            <ChartContainer className="h-full">
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
                    fontSize={12} 
                    tickFormatter={(val: any) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#c0c0c0" 
                    fontSize={12} 
                    axisLine={false} 
                    tickLine={false}
                    tickFormatter={(val: any) => `$${val > 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(2, 6, 23, 0.94)', border: '1px solid rgba(148, 163, 184, 0.16)', borderRadius: '12px', color: '#f5f5f5' }}
                    itemStyle={{ color: '#f5f5f5' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#adebb3" 
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
                  </div>
                </div>
              </div>

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
                  </div>
                </div>
              </div>

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
                  </div>
                </div>
              </div>
            </div>
            
            <button className="w-full mt-6 py-3 px-4 bg-[#3eb489] hover:bg-[#adebb3] text-[#0f172a] font-bold rounded-xl flex items-center justify-center gap-2 transition-all">
              Launch Orchestrator <ArrowRight className="w-4 h-4" />
            </button>
          </Card>

          {/* Activity Log Snapshot */}
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
              ].map((ev, i) => (
                <div key={i} className="flex gap-4">
                  <div className="relative">
                    <div className={`w-3 h-3 rounded-full ${ev.color} mt-1`} />
                    {i < 3 && <div className="absolute top-4 left-[5.5px] bottom-[-24px] w-[1px] bg-white/5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-bold text-[#f5f5f5]">{ev.label}</p>
                      <span className="text-[10px] text-[#94a3b8] font-bold uppercase">{ev.time}</span>
                    </div>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{ev.desc}</p>
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
