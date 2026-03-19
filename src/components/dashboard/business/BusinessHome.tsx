'use client';

import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { businessClientService } from '../../../services/businessClientService';
import { dailyService } from '../../../services/dailyService';
import { supabase } from '../../../lib/supabase';
import {
    DollarSign,
    Users,
    Briefcase,
    TrendingUp,
    Clock,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    Calendar,
    BarChart2,
    Target,
    Video,
    CheckSquare,
    FileText,
    UserPlus,
    Zap,
    Sun,
    Sunset,
    Moon,
    Star,
    XCircle,
    Loader2
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ─── Greeting Helpers ────────────────────────────────────────────────
function getGreeting(): { text: string; Icon: React.FC<any> } {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return { text: 'Good morning', Icon: Sun };
    if (h >= 12 && h < 17) return { text: 'Good afternoon', Icon: Sun };
    if (h >= 17 && h < 21) return { text: 'Good evening', Icon: Sunset };
    return { text: 'Good night', Icon: Moon };
}

interface InvoiceStats {
    overdue: number;
    dueSoon: number;
    inProgress: number;
    totalActive: number;
    loadingInvoices: boolean;
}

interface BusinessHomeProps {
    user: User;
    stats?: any;
}

const BusinessHome: React.FC<BusinessHomeProps> = ({ user, stats }) => {
    const { currentTenant } = useTenant();
    const [metrics, setMetrics] = useState({
        totalRevenue: stats?.totalRevenue || 0,
        totalClients: stats?.clientCount || 0,
        activeProjects: stats?.activeProjects || 0,
        pendingInvoices: stats?.pendingInvoices || 0,
        overdueInvoices: stats?.overdueInvoices || 0,
        weightedPipeline: stats?.weightedPipeline || 0,
        salesForecast: stats?.salesForecast || 0
    });
    const [revenueData, setRevenueData] = useState<any[]>(stats?.monthlyRevenue || []);
    const [pipelineData, setPipelineData] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>(stats?.recentActivity || []);
    const [loading, setLoading] = useState(!stats);
    const [invoiceStats, setInvoiceStats] = useState<InvoiceStats>({
        overdue: 0, dueSoon: 0, inProgress: 0, totalActive: 0, loadingInvoices: true
    });
    const greeting = getGreeting();
    const firstName = (user.name || user.email || 'there').split(' ')[0];

    const mapPipelineData = (pipeline: Record<string, number>) => {
        const stageLabels: Record<string, string> = {
            lead: 'Leads',
            qualified: 'Qualified',
            proposal: 'Proposal',
            negotiation: 'Negotiation',
            closed_won: 'Won',
            closed_lost: 'Lost'
        };

        const chartData = Object.entries(pipeline).map(([stage, count]) => ({
            stage: stageLabels[stage] || stage,
            count: count as number,
            originalStage: stage
        }));

        const order = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
        chartData.sort((a, b) => order.indexOf(a.originalStage) - order.indexOf(b.originalStage));

        setPipelineData(chartData);
    };

    useEffect(() => {
        if (stats) {
            setMetrics({
                totalRevenue: stats.totalRevenue || 0,
                totalClients: stats.clientCount || 0,
                activeProjects: stats.activeProjects || 0,
                pendingInvoices: stats.pendingInvoices || 0,
                overdueInvoices: stats.overdueInvoices || 0,
                weightedPipeline: stats.weightedPipeline || 0,
                salesForecast: stats.salesForecast || 0
            });
            setRevenueData(stats.monthlyRevenue || []);
            setRecentActivity(stats.recentActivity || []);
            if (stats.pipeline) {
                mapPipelineData(stats.pipeline);
            }
            setLoading(false);
        }
    }, [stats]);

    // Fetch live invoice stats
    useEffect(() => {
        const fetchInvoiceStats = async () => {
            if (!currentTenant?.id) return;
            try {
                const today = new Date().toISOString().split('T')[0];
                const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                const { data: invoices, error } = await supabase
                    .from('business_invoices')
                    .select('status, due_date')
                    .eq('tenant_id', currentTenant.id);

                if (error || !invoices) throw error;

                let overdue = 0, dueSoon = 0, inProgress = 0, totalActive = 0;
                for (const inv of invoices) {
                    const st = (inv.status || '').toLowerCase();
                    if (st === 'paid' || st === 'cancelled') continue;
                    totalActive++;
                    if (st === 'sent' || st === 'pending') {
                        if (inv.due_date && inv.due_date < today) overdue++;
                        else if (inv.due_date && inv.due_date <= sevenDaysLater) dueSoon++;
                    }
                    if (st === 'draft' || st === 'in_progress' || st === 'sent') inProgress++;
                }
                setInvoiceStats({ 
                    overdue: stats?.overdueInvoices || overdue, 
                    dueSoon, 
                    inProgress, 
                    totalActive, 
                    loadingInvoices: false 
                });
            } catch {
                setInvoiceStats(prev => ({ ...prev, loadingInvoices: false }));
            }
        };
        fetchInvoiceStats();
    }, [currentTenant?.id]);

    // Always render — stats default to 0 and update when the async fetch resolves.
    // Removing the loading guard so the dashboard is never stuck on "Loading dashboard..."

    const calendlyConfig = (currentTenant?.settings as any)?.calendly;
    const isConnected = calendlyConfig?.enabled && calendlyConfig?.accessToken;

    return (
        <div className="space-y-6">

            {/* ─── Personalized Greeting Banner ─── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/80 via-slate-900/60 to-teal-900/20 border border-slate-700/50 p-6 md:p-8">
                {/* Background glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-transparent to-violet-500/5 pointer-events-none" />
                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <greeting.Icon className="w-5 h-5 text-amber-400" />
                            <span className="text-slate-400 text-sm font-medium">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                            {greeting.text}, <span className="text-teal-400">{firstName}</span>
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">
                            {invoiceStats.overdue > 0
                                ? `You have ${invoiceStats.overdue} overdue invoice${invoiceStats.overdue !== 1 ? 's' : ''} that need your attention.`
                                : 'Everything looks great. No overdue invoices today.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-teal-500/30 ring-2 ring-teal-500/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={user.avatar || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.email || user.name}`}
                                alt={firstName}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect width='48' height='48' fill='%230f766e'/><text x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dominant-baseline='central' font-family='sans-serif'>${firstName.charAt(0).toUpperCase()}</text></svg>`)}`; }}
                            />
                        </div>
                    </div>
                </div>

                {/* Invoice Stats Row */}
                <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        {
                            label: 'Overdue',
                            value: invoiceStats.overdue,
                            icon: XCircle,
                            color: invoiceStats.overdue > 0 ? 'text-red-400' : 'text-slate-500',
                            bg: invoiceStats.overdue > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-slate-800/40 border-slate-700/30',
                            pulse: invoiceStats.overdue > 0,
                        },
                        {
                            label: 'Due Soon',
                            value: invoiceStats.dueSoon,
                            icon: Clock,
                            color: invoiceStats.dueSoon > 0 ? 'text-amber-400' : 'text-slate-500',
                            bg: invoiceStats.dueSoon > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-slate-800/40 border-slate-700/30',
                            pulse: false,
                        },
                        {
                            label: 'In Progress',
                            value: invoiceStats.inProgress,
                            icon: TrendingUp,
                            color: 'text-blue-400',
                            bg: 'bg-blue-500/10 border-blue-500/20',
                            pulse: false,
                        },
                        {
                            label: 'Total Active',
                            value: invoiceStats.totalActive,
                            icon: FileText,
                            color: 'text-teal-400',
                            bg: 'bg-teal-500/10 border-teal-500/20',
                            pulse: false,
                        },
                    ].map(({ label, value, icon: Icon, color, bg, pulse }) => (
                        <div key={label} className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${bg}`}>
                            <div className={`shrink-0 ${pulse ? 'animate-pulse' : ''}`}>
                                <Icon className={`w-5 h-5 ${color}`} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-slate-400 text-xs font-medium truncate">{label}</p>
                                {invoiceStats.loadingInvoices
                                    ? <Loader2 className="w-4 h-4 text-slate-600 animate-spin mt-0.5" />
                                    : <p className={`text-xl font-bold ${color} leading-none mt-0.5`}>{value}</p>
                                }
                            </div>
                        </div>
                    ))}
                </div>
            </div>

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
                    label="Weighted Pipeline"
                    value={`$${metrics.weightedPipeline.toLocaleString()}`}
                    icon={BarChart2}
                    color="text-blue-400"
                />
                <MetricCard
                    label="Sales Forecast"
                    value={`$${metrics.salesForecast.toLocaleString()}`}
                    icon={Target}
                    color="text-orange-400"
                />
            </div>

            {/* Charts & Upcoming Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-transparent border-t border-white/5 pt-6 lg:col-span-2">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-teal-400" />
                        Revenue Trend
                    </h3>
                    <div className="h-[250px] w-full min-h-[250px]">
                        <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={250} debounce={50}>
                            <LineChart data={revenueData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                    labelStyle={{ color: '#94a3b8' }}
                                />
                                <Line type="monotone" dataKey="amount" stroke="#2dd4bf" strokeWidth={3} dot={{ fill: '#2dd4bf', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Sales Pipeline Widget */}
                <div className="bg-transparent border-t border-white/5 pt-6 lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <BarChart2 className="w-5 h-5 text-violet-400" />
                            Sales Pipeline
                        </h3>
                        <button
                            onClick={() => window.location.href = '/dashboard/business/sales'}
                            className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 group"
                        >
                            See Deals <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    <div className="h-[250px] w-full min-h-[250px]">
                        {pipelineData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={250} debounce={50}>
                                <BarChart data={pipelineData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis
                                        dataKey="stage"
                                        stroke="#64748b"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        angle={-15}
                                        textAnchor="end"
                                    />
                                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    />
                                    <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                                        {pipelineData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={
                                                    entry.originalStage === 'closed_won' ? '#10b981' :
                                                        entry.originalStage === 'closed_lost' ? '#ef4444' :
                                                            `url(#pipelineGradient-${index})`
                                                }
                                            />
                                        ))}
                                    </Bar>
                                    <defs>
                                        {pipelineData.map((_, index) => (
                                            <linearGradient key={`gradient-${index}`} id={`pipelineGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#8b5cf6" />
                                                <stop offset="100%" stopColor="#4f46e5" />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3 border border-dashed border-slate-800 rounded-xl">
                                <Target className="w-10 h-10 opacity-20" />
                                <p className="text-sm">No pipeline data available</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {pipelineData.map((item, idx) => (
                            <div key={idx} className="text-center">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 truncate">{item.stage}</p>
                                <p className="text-lg font-bold text-white">{item.count}</p>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Bottom Row: Recent Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Activity */}
                <div className="bg-transparent border-t border-white/5 pt-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-violet-400" />
                        Recent Activity
                    </h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                        {recentActivity.length === 0 ? (
                            <div className="flex items-center justify-center py-10 text-slate-500 text-sm">
                                No recent activity yet.
                            </div>
                        ) : recentActivity.map((activity, index) => {
                            const iconMap: Record<string, { Icon: any; color: string; bg: string }> = {
                                client: { Icon: UserPlus, color: 'text-teal-400', bg: 'bg-teal-500/10' },
                                lead: { Icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                                project: { Icon: Briefcase, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                                project_update: { Icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                                invoice: { Icon: DollarSign, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                                invoice_status: { Icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                                payment: { Icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                                meeting: { Icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                                booking: { Icon: Calendar, color: 'text-sky-400', bg: 'bg-sky-500/10' },
                                task: { Icon: CheckSquare, color: 'text-green-400', bg: 'bg-green-500/10' },
                                task_check: { Icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                                contract: { Icon: FileText, color: 'text-pink-400', bg: 'bg-pink-500/10' },
                                contract_update: { Icon: FileText, color: 'text-rose-400', bg: 'bg-rose-500/10' },
                                lead_conversion: { Icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                            };
                            const { Icon, color, bg } = iconMap[activity.type] || iconMap.client;
                            const label = activity.text || activity.title || 'Activity';
                            return (
                                <div key={index} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors">
                                    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                                        <Icon className={`w-4 h-4 ${color}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-200 truncate">{label}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {activity.time || activity.date ? new Date(activity.time || activity.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Recent'}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-transparent border-t border-white/5 pt-6">
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
