'use client';

import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { businessClientService } from '../../../services/businessClientService';
import { dailyService } from '../../../services/dailyService';
import {
    DollarSign,
    Users,
    Briefcase,
    TrendingUp,
    Clock,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    Calendar
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BusinessHomeProps {
    user: User;
}

const BusinessHome: React.FC<BusinessHomeProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const [metrics, setMetrics] = useState({
        totalRevenue: 0,
        totalClients: 0,
        activeProjects: 0,
        pendingInvoices: 0
    });
    const [revenueData, setRevenueData] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentTenant) {
            loadDashboardData();
        }
    }, [currentTenant]);

    const loadDashboardData = async () => {
        if (!currentTenant) return;

        setLoading(true);
        try {
            // Fetch aggregated stats from RPC
            const { stats, error } = await businessClientService.getDashboardStats(currentTenant.id);

            if (error || !stats) {
                console.error('Failed to load dashboard stats:', error);
                return;
            }

            setMetrics({
                totalRevenue: stats.totalRevenue || 0,
                totalClients: stats.totalClients || 0,
                activeProjects: stats.activeProjects || 0,
                pendingInvoices: stats.pendingInvoices || 0
            });

            setRevenueData(stats.monthlyRevenue || []);
            setRecentActivity(stats.recentActivity || []);


        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-slate-400">Loading dashboard...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    label="Total Revenue"
                    value={`$${metrics.totalRevenue.toLocaleString()}`}
                    icon={DollarSign}
                    color="text-teal-400"
                />
                <MetricCard
                    label="Total Clients"
                    value={metrics.totalClients.toString()}
                    icon={Users}
                    color="text-violet-400"
                />
                <MetricCard
                    label="Active Projects"
                    value={metrics.activeProjects.toString()}
                    trend={`${metrics.activeProjects} ongoing`}
                    icon={Briefcase}
                    color="text-blue-400"
                />
                <MetricCard
                    label="Pending Invoices"
                    value={metrics.pendingInvoices.toString()}
                    icon={AlertCircle}
                    color="text-orange-400"
                />
            </div>

            {/* Charts & Upcoming Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Chart */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-sm lg:col-span-2">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-teal-400" />
                        Revenue Trend
                    </h3>
                    <ResponsiveContainer width="100%" height={250} minWidth={0}>
                        <LineChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="month" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                                labelStyle={{ color: '#94a3b8' }}
                            />
                            <Line type="monotone" dataKey="revenue" stroke="#2dd4bf" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

            </div>

            {/* Bottom Row: Recent Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-violet-400" />
                        Recent Activity
                    </h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                        {recentActivity.map((activity, index) => (
                            <div key={index} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                                <div className={`w-2 h-2 rounded-full mt-2 ${activity.type === 'client' ? 'bg-teal-400' :
                                    activity.type === 'project' ? 'bg-violet-400' :
                                        'bg-orange-400'
                                    }`} />
                                <div className="flex-1">
                                    <p className="text-sm text-slate-300">{activity.text}</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {new Date(activity.time).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-1 gap-3">
                        <QuickActionButton
                            label="Add New Client"
                            icon={Users}
                            onClick={() => window.location.href = '/dashboard/business/clients'}
                            disabled={false}
                        />
                        <QuickActionButton
                            label="Create Project"
                            icon={Briefcase}
                            onClick={() => window.location.href = '/dashboard/business/projects'}
                            disabled={false}
                        />
                        <QuickActionButton
                            label="Send Invoice"
                            icon={DollarSign}
                            onClick={() => window.location.href = '/dashboard/business/billing'}
                            disabled={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ label, value, trend, icon: Icon, color }: any) => (
    <div className="bg-slate-900/50 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-slate-900/50 group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-slate-700 transition-colors ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            {trend && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-teal-500/10 text-teal-400' : 'bg-slate-700 text-slate-400'
                    }`}>
                    {trend}
                </span>
            )}
        </div>
        <div className="space-y-1">
            <h3 className="text-slate-400 text-sm font-medium">{label}</h3>
            <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        </div>
    </div>
);

const QuickActionButton = ({ label, icon: Icon, onClick, disabled = false }: any) => (
    <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`flex items-center justify-between p-4 border rounded-2xl transition-all group ${disabled
            ? 'bg-slate-800/30 border-slate-700/50 cursor-not-allowed opacity-50'
            : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700 hover:border-teal-500/50'
            }`}
    >
        <div className="flex items-center gap-3">
            <Icon className={`w-5 h-5 transition-colors ${disabled ? 'text-slate-600' : 'text-slate-400 group-hover:text-teal-400'}`} />
            <span className={`font-medium transition-colors ${disabled ? 'text-slate-600' : 'text-slate-300 group-hover:text-white'}`}>{label}</span>
        </div>
        <ArrowRight className={`w-4 h-4 transition-colors ${disabled ? 'text-slate-700' : 'text-slate-600 group-hover:text-teal-400'}`} />
    </button>
);

export default BusinessHome;
