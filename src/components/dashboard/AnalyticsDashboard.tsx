import React from 'react';
// Removed unused UI components
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, DollarSign, Activity } from 'lucide-react';

// TODO: Replace with real data from database
// This is demo data for visualization purposes
const data = [
    { name: 'Jan', revenue: 4000, projects: 24, amt: 2400 },
    { name: 'Feb', revenue: 3000, projects: 13, amt: 2210 },
    { name: 'Mar', revenue: 2000, projects: 98, amt: 2290 },
    { name: 'Apr', revenue: 2780, projects: 39, amt: 2000 },
    { name: 'May', revenue: 1890, projects: 48, amt: 2181 },
    { name: 'Jun', revenue: 2390, projects: 38, amt: 2500 },
    { name: 'Jul', revenue: 3490, projects: 43, amt: 2100 },
];

const pieData = [
    { name: 'Active', value: 400 },
    { name: 'Completed', value: 300 },
    { name: 'On Hold', value: 300 },
    { name: 'Pending', value: 200 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const AnalyticsDashboard: React.FC = () => {
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
                    {['Last 7 Days', 'Last 30 Days', 'This Year'].map((label, i) => (
                        <button key={label} className={`px-4 py-2 rounded-lg text-sm transition-all ${i === 2 ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Revenue', value: '$45,230.00', change: '+20.1%', trend: 'up', icon: DollarSign, color: 'teal', subtext: 'from last month' },
                    { label: 'Active Projects', value: '12', change: '+3 new', trend: 'up', icon: Activity, color: 'blue', subtext: 'this week' },
                    { label: 'Total Clients', value: '248', change: '+12%', trend: 'up', icon: Users, color: 'violet', subtext: 'new users' },
                    { label: 'Conversion Rate', value: '3.2%', change: '-0.4%', trend: 'down', icon: Activity, color: 'rose', subtext: 'from last week' },
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
                        <TrendingUp className="w-5 h-5 text-teal-400" /> Revenue Trend
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
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
                </div>

                <div className="glass-card p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-violet-500" /> Project Distribution
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" axisLine={false} tickLine={false} dy={10} />
                                <YAxis stroke="#64748b" axisLine={false} tickLine={false} dx={-10} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)', radius: 8 }}
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)', color: '#fff' }}
                                />
                                <Bar dataKey="revenue" fill="url(#colorProjects)" radius={[6, 6, 0, 0]} barSize={32}>
                                    {data.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#8b5cf6' : '#6366f1'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-card p-6 lg:col-span-2 rounded-2xl">
                    <h3 className="text-lg font-semibold text-white mb-6">Recent Activity</h3>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5 group cursor-pointer">
                                <div className="p-3 rounded-full bg-slate-800 text-teal-400 group-hover:scale-110 group-hover:bg-teal-500/20 group-hover:text-teal-300 transition-all">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-white font-medium group-hover:text-teal-200 transition-colors">New project "Alpha Redesign" created</div>
                                    <div className="text-xs text-slate-500 mt-1">2 hours ago by <span className="text-slate-400">Sarah Connor</span></div>
                                </div>
                                <div className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full">Just now</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="glass-card p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold text-white mb-6">Traffic Sources</h3>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
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
                        <div className="flex justify-center gap-4 text-xs text-slate-400 mt-4">
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#0088FE]"></div> Direct</div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#00C49F]"></div> Social</div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#FFBB28]"></div> Organic</div>
                        </div>
                    </div>
                </div>

                {/* Client Satisfaction Widget */}
                <div className="glass-card p-6 rounded-2xl lg:col-span-3">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-teal-400" /> Client Satisfaction
                        </h3>
                        <span className="text-2xl font-bold text-teal-400">4.8/5.0</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                            <div className="text-slate-400 text-sm mb-1">On-Time Delivery</div>
                            <div className="text-2xl font-bold text-white mb-2">94%</div>
                            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div className="bg-teal-500 h-full rounded-full" style={{ width: '94%' }}></div>
                            </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                            <div className="text-slate-400 text-sm mb-1">Project Success Rate</div>
                            <div className="text-2xl font-bold text-white mb-2">98%</div>
                            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full rounded-full" style={{ width: '98%' }}></div>
                            </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
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
