import React, { useState, useEffect } from 'react';
import { analyticsService, AnalyticsData } from '../../services/analyticsService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import { TableSkeleton } from '../ui/Skeleton';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const AnalyticsDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<AnalyticsData | null>(null);
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '1y'>('30d');

    useEffect(() => {
        loadData();
    }, [dateRange]);

    const loadData = async () => {
        setLoading(true);
        const { data, error } = await analyticsService.getAnalytics(dateRange);
        if (data) {
            setStats(data);
        } else {
            console.error('Failed to load analytics:', error);
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />)}
                </div>
                <div className="h-96 bg-slate-800/50 rounded-2xl animate-pulse" />
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
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-violet-500 flex items-center gap-3">
                        <Activity className="w-8 h-8 text-teal-400 animate-pulse" />
                        Analytics Overview
                    </h2>
                    <p className="text-slate-400 mt-2 text-sm">Real-time insights and performance metrics</p>
                </div>
                <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-slate-800 backdrop-blur-sm">
                    {(['7d', '30d', '1y'] as const).map((label) => (
                        <button
                            key={label}
                            onClick={() => setDateRange(label)}
                            className={`px-4 py-2 rounded-lg text-sm transition-all ${dateRange === label ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        >
                            {label === '1y' ? 'This Year' : `Last ${label}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Revenue', value: `$${stats?.revenue.total.toLocaleString()}`, change: `${stats?.revenue.trend.toFixed(1)}%`, trend: (stats?.revenue.trend || 0) >= 0 ? 'up' : 'down', icon: DollarSign, color: 'teal', subtext: 'vs last month' },
                    { label: 'Active Projects', value: stats?.projects.active.toString(), change: 'Live', trend: 'up', icon: Activity, color: 'blue', subtext: 'projects' },
                    { label: 'Client Growth', value: stats?.users.clients.toString(), change: `+${stats?.users.growth || 0}%`, trend: 'up', icon: Users, color: 'violet', subtext: 'this month' },
                    { label: 'On-Time Delivery', value: `${stats?.performance.onTimeDelivery}%`, change: 'Avg', trend: 'up', icon: Activity, color: 'rose', subtext: 'completion rate' },
                ].map((stat, i) => (
                    <div key={i} className="glass-card rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1">
                        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity bg-${stat.color}-500 blur-2xl w-24 h-24 rounded-full -mr-8 -mt-8`}></div>
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <div className="text-slate-400 text-sm font-medium">{stat.label}</div>
                                <div className="text-3xl font-bold text-white mt-2 tracking-tight">{stat.value}</div>
                                <div className={`text-xs mt-2 flex items-center gap-1.5 font-medium ${stat.trend === 'up' ? 'text-teal-400' : 'text-rose-400'}`}>
                                    <TrendingUp className={`w-3.5 h-3.5 ${stat.trend === 'down' ? 'rotate-180' : ''}`} />
                                    {stat.change} <span className="text-slate-500 font-normal">{stat.subtext}</span>
                                </div>
                            </div>
                            <div className={`p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-${stat.color}-400 group-hover:scale-110 transition-transform`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Chart Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
                <div className="glass-card p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-teal-400" /> Revenue & Projects Trend
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="99%" height={300}>
                            <AreaChart data={chartData}>
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
                                <XAxis dataKey="name" stroke="#64748b" axisLine={false} tickLine={false} dy={10} />
                                <YAxis yAxisId="left" stroke="#64748b" axisLine={false} tickLine={false} dx={-10} />
                                <YAxis yAxisId="right" orientation="right" stroke="#64748b" axisLine={false} tickLine={false} dx={10} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                    cursor={{ stroke: '#2dd4bf', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#2dd4bf" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue ($)" />
                                <Area yAxisId="right" type="monotone" dataKey="projects" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorProjects)" name="Projects" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-violet-500" /> Project Status Distribution
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="99%" height={300}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-400 mt-4">
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
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-teal-400" /> Client Satisfaction & Performance
                        </h3>
                        <span className="text-2xl font-bold text-teal-400">{stats?.performance.clientSatisfaction}/5.0</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                            <div className="text-slate-400 text-sm mb-1">On-Time Delivery</div>
                            <div className="text-2xl font-bold text-white mb-2">{stats?.performance.onTimeDelivery}%</div>
                            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div className="bg-teal-500 h-full rounded-full" style={{ width: `${stats?.performance.onTimeDelivery}%` }}></div>
                            </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                            <div className="text-slate-400 text-sm mb-1">Avg Project Duration</div>
                            <div className="text-2xl font-bold text-white mb-2">{stats?.performance.avgProjectDuration} Days</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                            {/* Placeholder for NPS or other metric */}
                            <div className="text-slate-400 text-sm mb-1">Net Promoter Score</div>
                            <div className="text-2xl font-bold text-white mb-2">+72</div>
                            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div className="bg-violet-500 h-full rounded-full" style={{ width: '85%' }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
