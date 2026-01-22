import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { businessClientService } from '../../../services/businessClientService';
import { businessProjectService } from '../../../services/businessProjectService';
import { businessInvoiceService } from '../../../services/businessInvoiceService';
import {
    DollarSign,
    Users,
    Briefcase,
    TrendingUp,
    Clock,
    CheckCircle,
    AlertCircle,
    ArrowRight
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
            // Load clients
            const { clients } = await businessClientService.getClients(currentTenant.id);

            // Load projects
            const { projects } = await businessProjectService.getProjects(currentTenant.id);

            // Load invoices
            const { invoices } = await businessInvoiceService.getInvoices(currentTenant.id);

            // Calculate metrics
            const totalRevenue = invoices
                .filter(inv => inv.status === 'paid')
                .reduce((sum, inv) => sum + inv.total, 0);

            const pendingInvoices = invoices.filter(inv => inv.status !== 'paid').length;
            const activeProjects = projects.filter(p => p.status !== 'done').length;

            setMetrics({
                totalRevenue,
                totalClients: clients.length,
                activeProjects,
                pendingInvoices
            });

            // Generate revenue data for chart (last 6 months)
            const monthlyRevenue = generateMonthlyRevenue(invoices);
            setRevenueData(monthlyRevenue);

            // Recent activity
            const activity = [
                ...clients.slice(0, 3).map(c => ({ type: 'client', text: `New client: ${c.name}`, time: c.createdAt })),
                ...projects.slice(0, 3).map(p => ({ type: 'project', text: `Project updated: ${p.name}`, time: p.updatedAt })),
                ...invoices.slice(0, 3).map(i => ({ type: 'invoice', text: `Invoice ${i.invoiceNumber} ${i.status}`, time: i.createdAt }))
            ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);

            setRecentActivity(activity);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateMonthlyRevenue = (invoices: any[]) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        return months.map((month, index) => ({
            month,
            revenue: Math.random() * 10000 + 5000 // Placeholder - calculate from actual data
        }));
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
            {/* Read-Only Mode Banner */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                    <h4 className="text-blue-400 font-semibold text-sm mb-1">Dashboard in View-Only Mode</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">
                        Your dashboard is currently in read-only mode during setup. You can view all data, but adding or editing functionality is temporarily disabled. This will be enabled once your account setup is complete.
                    </p>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    label="Total Revenue"
                    value={`$${metrics.totalRevenue.toLocaleString()}`}
                    trend="+12%"
                    icon={DollarSign}
                    color="text-teal-400"
                />
                <MetricCard
                    label="Total Clients"
                    value={metrics.totalClients.toString()}
                    trend="+5"
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

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Chart */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-teal-400" />
                        Revenue Trend
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
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

                {/* Recent Activity */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-violet-400" />
                        Recent Activity
                    </h3>
                    <div className="space-y-3">
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
            </div>

            {/* Quick Actions */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <QuickActionButton
                        label="Add New Client"
                        icon={Users}
                        onClick={() => {/* Disabled in read-only mode */ }}
                        disabled={true}
                    />
                    <QuickActionButton
                        label="Create Project"
                        icon={Briefcase}
                        onClick={() => {/* Disabled in read-only mode */ }}
                        disabled={true}
                    />
                    <QuickActionButton
                        label="Send Invoice"
                        icon={DollarSign}
                        onClick={() => {/* Disabled in read-only mode */ }}
                        disabled={true}
                    />
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
        className={`flex items-center justify-between p-4 border rounded-xl transition-all group ${disabled
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
