import React, { useState, useEffect, useCallback } from 'react';
import { analyticsService, AnalyticsData } from '../../services/analyticsService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { WrapChart } from '../../lib/chartWrapper';
import { TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import { TableSkeleton } from '../ui/Skeleton';

const COLORS = ['#adebb3', '#00f0ff', '#7f00ff', '#f87171'];

const AnalyticsDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);
    const [stats, setStats] = useState<AnalyticsData | null>(null);
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '1y'>('30d');

    const loadData = useCallback(async () => {
        setLoading(true);
        const { data, error } = await analyticsService.getAnalytics(dateRange);
        if (data) {
            setStats(data);
        } else {
            console.error('Failed to load analytics:', error);
        }
        setLoading(false);
    }, [dateRange]);

    useEffect(() => {
        setIsMounted(true);
        loadData();
    }, [loadData]);

    if (loading || !isMounted) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />)}
                </div>
                <div className="h-96 bg-white/5 rounded-2xl animate-pulse" />
            </div>
        );
    }

    // Transform data for charts
    const chartData = stats?.revenue.byPeriod.map(p => {
        // Find matching project count for this date
        const proj = stats.projects.byPeriod.find(pp => pp.date === p.date);
        return {
            name: p.date, // Format if needed
            revenue: p.revenue,
            projects: proj ? proj.count : 0
        };
    }) || [];

    const pieData = stats?.projects.byStatus.map(s => ({
        name: s.status,
        value: s.count
    })) || [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#adebb3] to-[#7f00ff] flex items-center gap-3">
                        <Activity className="w-8 h-8 text-[#adebb3] animate-pulse" />
                        Analytics Overview
                    </h2>
                    <p className="text-[#c0c0c0] mt-2 text-sm">Real-time insights and performance metrics</p>
                </div>
                <div className="flex gap-2 bg-white/5 p-1.5 rounded-xl border border-white/5 backdrop-blur-sm">
                    {(['7d', '30d', '1y'] as const).map((label) => (
                        <button
                            key={label}
                            onClick={() => setDateRange(label)}
                            className={`px-4 py-2 rounded-lg text-sm transition-all ${dateRange === label ? 'bg-[#adebb3] text-[#0f172a] shadow-lg shadow-[#adebb3]/20' : 'text-[#c0c0c0] hover:text-[#f5f5f5] hover:bg-white/5'}`}
                        >
                            {label === '1y' ? 'This Year' : `Last ${label}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Revenue', value: `$${stats?.revenue.total.toLocaleString()}`, change: `${stats?.revenue.trend.toFixed(1)}%`, trend: (stats?.revenue.trend || 0) >= 0 ? 'up' : 'down', icon: DollarSign, color: '#adebb3', subtext: 'vs last month', ring: 'rgba(173,235,179,0.18)', iconBg: 'rgba(173,235,179,0.10)' },
                    { label: 'Active Projects', value: stats?.projects.active.toString(), change: 'Live', trend: 'up', icon: Activity, color: '#00f0ff', subtext: 'projects', ring: 'rgba(0,240,255,0.18)', iconBg: 'rgba(0,240,255,0.10)' },
                    { label: 'Client Growth', value: stats?.users.clients.toString(), change: `+${stats?.users.growth || 0}%`, trend: 'up', icon: Users, color: '#7f00ff', subtext: 'this month', ring: 'rgba(127,0,255,0.18)', iconBg: 'rgba(127,0,255,0.10)' },
                    { label: 'On-Time Delivery', value: `${stats?.performance.onTimeDelivery}%`, change: 'Avg', trend: 'up', icon: Activity, color: '#f87171', subtext: 'completion rate', ring: 'rgba(248,113,113,0.18)', iconBg: 'rgba(248,113,113,0.10)' },
                ].map((stat, i) => (
                    <div key={i} className="dashboard-panel rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1">
                        <div className="absolute top-0 right-0 p-4 opacity-100 group-hover:opacity-100 transition-opacity blur-2xl w-24 h-24 rounded-full -mr-8 -mt-8" style={{ backgroundColor: stat.ring }} />
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <div className="text-[#c0c0c0] text-sm font-medium">{stat.label}</div>
                                <div className="text-3xl font-bold text-[#f5f5f5] mt-2 tracking-tight">{stat.value}</div>
                                <div className={`text-xs mt-2 flex items-center gap-1.5 font-medium ${stat.trend === 'up' ? 'text-[#adebb3]' : 'text-[#f87171]'}`}>
                                    <TrendingUp className={`w-3.5 h-3.5 ${stat.trend === 'down' ? 'rotate-180' : ''}`} />
                                    {stat.change} <span className="text-[#94a3b8] font-normal">{stat.subtext}</span>
                                </div>
                            </div>
                            <div className="p-3 rounded-xl border border-white/5 group-hover:scale-110 transition-transform" style={{ backgroundColor: stat.iconBg, color: stat.color }}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Chart Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
                <div className="dashboard-panel p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold text-[#f5f5f5] mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-[#adebb3]" /> Revenue & Projects Trend
                    </h3>
                    <div className="h-[300px] w-full min-h-[300px]">
                        <WrapChart height={300}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#adebb3" stopOpacity={0.34} />
                                        <stop offset="95%" stopColor="#adebb3" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorProjects" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#7f00ff" stopOpacity={0.34} />
                                        <stop offset="95%" stopColor="#7f00ff" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="dashboard-chart-grid" vertical={false} />
                                <XAxis dataKey="name" stroke="#c0c0c0" axisLine={false} tickLine={false} dy={10} />
                                <YAxis yAxisId="left" stroke="#c0c0c0" axisLine={false} tickLine={false} dx={-10} />
                                <YAxis yAxisId="right" orientation="right" stroke="#c0c0c0" axisLine={false} tickLine={false} dx={10} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(2, 6, 23, 0.94)', borderColor: 'rgba(148, 163, 184, 0.16)', borderRadius: '12px', backdropFilter: 'blur(8px)', color: '#f5f5f5' }}
                                    itemStyle={{ color: '#f5f5f5' }}
                                    cursor={{ stroke: '#adebb3', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#adebb3" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue ($)" />
                                <Area yAxisId="right" type="monotone" dataKey="projects" stroke="#7f00ff" strokeWidth={3} fillOpacity={1} fill="url(#colorProjects)" name="Projects" />
                            </AreaChart>
                        </WrapChart>
                    </div>
                </div>

                <div className="dashboard-panel p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold text-[#f5f5f5] mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-[#7f00ff]" /> Project Status Distribution
                    </h3>
                    <div className="h-[300px]">
                        <WrapChart height={300}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#00f0ff"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(2, 6, 23, 0.94)', borderColor: 'rgba(148, 163, 184, 0.16)', color: '#f5f5f5' }}
                                />
                            </PieChart>
                        </WrapChart>
                        <div className="flex flex-wrap justify-center gap-4 text-xs text-[#c0c0c0] mt-4">
                            {pieData.map((entry, index) => (
                                <div key={entry.name} className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    {entry.name} ({entry.value})
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Client Satisfaction Widget */}
                <div className="glass-card p-6 rounded-2xl lg:col-span-3">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-[#f5f5f5] flex items-center gap-2">
                            <Users className="w-5 h-5 text-[#adebb3]" /> Client Satisfaction & Performance
                        </h3>
                        <span className="text-2xl font-bold text-[#adebb3]">{stats?.performance.clientSatisfaction}/5.0</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                            <div className="text-[#c0c0c0] text-sm mb-1">On-Time Delivery</div>
                            <div className="text-2xl font-bold text-[#f5f5f5] mb-2">{stats?.performance.onTimeDelivery}%</div>
                            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                <div className="bg-[#adebb3] h-full rounded-full" style={{ width: `${stats?.performance.onTimeDelivery}%` }}></div>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                            <div className="text-[#c0c0c0] text-sm mb-1">Avg Project Duration</div>
                            <div className="text-2xl font-bold text-[#f5f5f5] mb-2">{stats?.performance.avgProjectDuration} Days</div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                            {/* Placeholder for NPS or other metric */}
                            <div className="text-[#c0c0c0] text-sm mb-1">Net Promoter Score</div>
                            <div className="text-2xl font-bold text-[#f5f5f5] mb-2">+72</div>
                            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                <div className="bg-[#7f00ff] h-full rounded-full" style={{ width: '85%' }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
