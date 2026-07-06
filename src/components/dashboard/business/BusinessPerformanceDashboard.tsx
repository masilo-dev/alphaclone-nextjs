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
  RefreshCcw, 
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
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Business OS</h2>
          <p className="text-[#c0c0c0] mt-1">Real-time performance metrics across your entire ecosystem.</p>
        </div>
        <button 
          onClick={fetchData}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-[#f5f5f5] rounded-xl border border-white/5 transition-all disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium">Sync Engine</span>
        </button>
      </div>

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
                  <div className="mt-1 p-1.5 rounded-full bg-[#00f0ff]/10 text-[#00f0ff]">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#f5f5f5]">Revenue Momentum +12%</p>
                    <p className="text-xs text-[#94a3b8] mt-1">Growth is outpacing project volume, suggesting higher average deal value.</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex gap-3">
                  <div className="mt-1 p-1.5 rounded-full bg-[#ffb347]/10 text-[#facc15]">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#f5f5f5]">7 Stagnant Leads</p>
                    <p className="text-xs text-[#94a3b8] mt-1">Leads identified with zero activity for 7+ days. Automated follow-up recommended.</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex gap-3">
                  <div className="mt-1 p-1.5 rounded-full bg-[#adebb3]/10 text-[#adebb3]">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#f5f5f5]">Automation Scaling</p>
                    <p className="text-xs text-[#94a3b8] mt-1">System handled 240+ runs today with 98% success. Throughput is healthy.</p>
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
