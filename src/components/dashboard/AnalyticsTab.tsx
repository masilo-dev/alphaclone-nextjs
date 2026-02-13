'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/UIComponents';
import { Activity, Users, DollarSign, Server, Cpu, TrendingUp, TrendingDown } from 'lucide-react';
import { analyticsService, AnalyticsData } from '../../services/analyticsService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format } from 'date-fns';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '../ui/UIComponents';
import { Download, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';

const AnalyticsTab: React.FC = () => {
    const { currentTenant: tenant } = useTenant();
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async (type: 'pdf' | 'xlsx', category: string) => {
        if (!tenant?.id) {
            toast.error("Tenant information unavailable");
            return;
        }

        setIsExporting(true);
        try {
            const url = `/api/reports/export?type=${type}&category=${category}&tenantId=${tenant.id}`;
            const response = await fetch(url);

            if (!response.ok) throw new Error("Export failed");

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `report_${category}_${new Date().toISOString().split('T')[0]}.${type}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast.success(`${category.charAt(0).toUpperCase() + category.slice(1)} report exported`);
        } catch (err) {
            console.error("Export error:", err);
            toast.error("Failed to export report");
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);
            setError(null);
            const { data, error: err } = await analyticsService.getAnalytics(dateRange);
            if (err) {
                setError(err);
            } else if (data) {
                setAnalytics(data);
            }
            setLoading(false);
        };

        fetchAnalytics();
    }, [dateRange]);

    if (loading) {
        return (
            <div className="p-10 text-center text-slate-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400 mb-4"></div>
                <p>Loading Live Analytics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-10 text-center">
                <p className="text-red-400 mb-4">Error loading analytics: {error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!analytics) {
        return <div className="p-10 text-center text-slate-500">No analytics data available</div>;
    }

    const revenueTrend = analytics.revenue.trend >= 0;
    const userGrowth = analytics.users.growth >= 0;

    // Format chart data
    const revenueChartData = analytics.revenue.byPeriod.map(item => ({
        date: format(new Date(item.date), 'MMM dd'),
        revenue: item.revenue,
        projects: item.projects,
    }));

    const projectStatusData = analytics.projects.byStatus.map(item => ({
        name: item.status,
        value: item.count,
    }));

    const COLORS = ['#2dd4bf', '#8b5cf6', '#3b82f6', '#f59e0b', '#ef4444'];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400" /> Live Operations
                </h2>
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-slate-800">
                        {(['7d', '30d', '90d', '1y'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setDateRange(range)}
                                className={`px-4 py-2 rounded-lg text-sm transition-all ${dateRange === range
                                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : '1 Year'}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleExport('pdf', 'revenue')}
                            isLoading={isExporting}
                            icon={<FileDown className="w-4 h-4" />}
                        >
                            PDF
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleExport('xlsx', 'revenue')}
                            isLoading={isExporting}
                            icon={<Download className="w-4 h-4" />}
                        >
                            Excel
                        </Button>
                    </div>
                </div>
            </div>

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                            <Users className="w-6 h-6" />
                        </div>
                        <div className={`flex items-center gap-1 text-xs font-bold ${userGrowth ? 'text-teal-400' : 'text-red-400'}`}>
                            {userGrowth ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(analytics.users.growth).toFixed(1)}%
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">{analytics.users.total}</h3>
                        <p className="text-xs sm:text-sm text-slate-500">Total Users</p>
                        <p className="text-xs text-slate-600 mt-1">{analytics.users.newThisMonth} new this month</p>
                    </div>
                </Card>

                <Card className="p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
                            <Server className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                            Live
                        </span>
                    </div>
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">{analytics.projects.active}</h3>
                        <p className="text-xs sm:text-sm text-slate-500">Active Projects</p>
                        <p className="text-xs text-slate-600 mt-1">{analytics.projects.total} total</p>
                    </div>
                </Card>

                <Card className="p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-xl bg-green-500/10 text-green-400">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div className={`flex items-center gap-1 text-xs font-bold ${revenueTrend ? 'text-teal-400' : 'text-red-400'}`}>
                            {revenueTrend ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(analytics.revenue.trend).toFixed(1)}%
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">${analytics.revenue.thisMonth.toLocaleString()}</h3>
                        <p className="text-xs sm:text-sm text-slate-500">Revenue (This Month)</p>
                        <p className="text-xs text-slate-600 mt-1">${analytics.revenue.total.toLocaleString()} total</p>
                    </div>
                </Card>

                <Card className="p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400">
                            <Cpu className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                            Online
                        </span>
                    </div>
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">{analytics.performance.onTimeDelivery}%</h3>
                        <p className="text-xs sm:text-sm text-slate-500">On-Time Delivery</p>
                        <p className="text-xs text-slate-600 mt-1">Avg: {analytics.performance.avgProjectDuration} days</p>
                    </div>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-teal-400" /> Revenue & Projects Trend
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height={300} minWidth={0}>
                            <AreaChart data={revenueChartData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorProjects" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                                <XAxis dataKey="date" stroke="#64748b" axisLine={false} tickLine={false} dy={10} />
                                <YAxis stroke="#64748b" axisLine={false} tickLine={false} dx={-10} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                    cursor={{ stroke: '#2dd4bf', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#2dd4bf" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                                <Area type="monotone" dataKey="projects" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorProjects)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-violet-500" /> Project Status Distribution
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height={300} minWidth={0}>
                            <PieChart>
                                <Pie
                                    data={projectStatusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {projectStatusData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)', color: '#fff' }}
                                />
                                <Legend
                                    wrapperStyle={{ color: '#fff', fontSize: '12px' }}
                                    iconType="circle"
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Performance Metrics */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <Users className="w-5 h-5 text-teal-400" /> Performance Metrics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <div className="text-slate-400 text-sm mb-1">On-Time Delivery</div>
                        <div className="text-2xl font-bold text-white mb-2">{analytics.performance.onTimeDelivery}%</div>
                        <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div className="bg-teal-500 h-full rounded-full" style={{ width: `${analytics.performance.onTimeDelivery}%` }}></div>
                        </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <div className="text-slate-400 text-sm mb-1">Avg Project Duration</div>
                        <div className="text-2xl font-bold text-white mb-2">{analytics.performance.avgProjectDuration} days</div>
                        <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full rounded-full" style={{ width: '75%' }}></div>
                        </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <div className="text-slate-400 text-sm mb-1">Client Satisfaction</div>
                        <div className="text-2xl font-bold text-white mb-2">{analytics.performance.clientSatisfaction}/5.0</div>
                        <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div className="bg-violet-500 h-full rounded-full" style={{ width: `${(analytics.performance.clientSatisfaction / 5) * 100}%` }}></div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default AnalyticsTab;
