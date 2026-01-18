import React from 'react';
import { Card } from '../ui/UIComponents';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Target } from 'lucide-react';

const mockForecastData = [
    { month: 'Jan', actual: 45000, projected: 48000 },
    { month: 'Feb', actual: 52000, projected: 50000 },
    { month: 'Mar', actual: 48000, projected: 55000 },
    { month: 'Apr', actual: 61000, projected: 58000 },
    { month: 'May', actual: 55000, projected: 62000 },
    { month: 'Jun', actual: 67000, projected: 65000 },
];

const pipelineData = [
    { stage: 'Discovery', count: 12, value: 120000 },
    { stage: 'Proposal', count: 8, value: 85000 },
    { stage: 'Negotiation', count: 5, value: 65000 },
    { stage: 'Closed Won', count: 18, value: 240000 },
];

const SalesForecastTab = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-white">Sales Forecast & Pipeline</h2>
                    <p className="text-slate-400">Projected revenue and deal flow analysis.</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-slate-900 border-slate-800 p-4">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-green-500/10 rounded-lg text-green-400"><DollarSign className="w-5 h-5" /></div>
                        <span className="text-xs text-green-400 flex items-center gap-1">+12.5% <TrendingUp className="w-3 h-3" /></span>
                    </div>
                    <div className="text-2xl font-bold text-white">$328,000</div>
                    <div className="text-xs text-slate-500">Projected Q3 Revenue</div>
                </Card>

                <Card className="bg-slate-900 border-slate-800 p-4">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Target className="w-5 h-5" /></div>
                        <span className="text-xs text-slate-400">82% to Goal</span>
                    </div>
                    <div className="text-2xl font-bold text-white">$400,000</div>
                    <div className="text-xs text-slate-500">Q3 Revenue Target</div>
                </Card>

                <Card className="bg-slate-900 border-slate-800 p-4">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><TrendingUp className="w-5 h-5" /></div>
                        <span className="text-xs text-green-400 flex items-center gap-1">+5.2% <TrendingUp className="w-3 h-3" /></span>
                    </div>
                    <div className="text-2xl font-bold text-white">68%</div>
                    <div className="text-xs text-slate-500">Win Rate</div>
                </Card>

                <Card className="bg-slate-900 border-slate-800 p-4">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400"><TrendingDown className="w-5 h-5" /></div>
                        <span className="text-xs text-rose-400 flex items-center gap-1">-2.1% <TrendingDown className="w-3 h-3" /></span>
                    </div>
                    <div className="text-2xl font-bold text-white">14 days</div>
                    <div className="text-xs text-slate-500">Avg. Sales Cycle</div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Forecast Chart */}
                <Card className="bg-slate-900 border-slate-800 p-6">
                    <h3 className="text-lg font-bold text-white mb-6">Revenue Forecast vs Actual</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={mockForecastData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                    itemStyle={{ color: '#f8fafc' }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="actual" name="Actual Revenue" stroke="#14b8a6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="projected" name="Projected" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} strokeDasharray="5 5" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Pipeline Distribution Chart */}
                <Card className="bg-slate-900 border-slate-800 p-6">
                    <h3 className="text-lg font-bold text-white mb-6">Deal Pipeline Value</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={pipelineData} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                                <YAxis dataKey="stage" type="category" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={80} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                />
                                <Bar dataKey="value" name="Pipeline Value" fill="#14b8a6" radius={[0, 4, 4, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default SalesForecastTab;
