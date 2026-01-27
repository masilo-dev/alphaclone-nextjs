import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { businessClientService } from '../../../services/businessClientService';
import { businessProjectService } from '../../../services/businessProjectService';
import { businessInvoiceService } from '../../../services/businessInvoiceService';
import {
    TrendingUp,
    Download,
    Calendar,
    DollarSign,
    Users,
    Briefcase
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ReportsPageProps {
    user: User;
}

const ReportsPage: React.FC<ReportsPageProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const [dateRange, setDateRange] = useState('30');
    const [revenueData, setRevenueData] = useState<any[]>([]);
    const [clientData, setClientData] = useState<any[]>([]);
    const [projectData, setProjectData] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalClients: 0,
        activeProjects: 0,
        completedProjects: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentTenant) {
            loadReportData();
        }
    }, [currentTenant, dateRange]);

    const loadReportData = async () => {
        if (!currentTenant) return;

        setLoading(true);
        try {
            const { clients } = await businessClientService.getClients(currentTenant.id);
            const { projects } = await businessProjectService.getProjects(currentTenant.id);
            const { invoices } = await businessInvoiceService.getInvoices(currentTenant.id);

            // Calculate stats
            const totalRevenue = invoices
                .filter(inv => inv.status === 'paid')
                .reduce((sum, inv) => sum + inv.total, 0);

            const activeProjects = projects.filter(p => p.status !== 'done').length;
            const completedProjects = projects.filter(p => p.status === 'done').length;

            setStats({
                totalRevenue,
                totalClients: clients.length,
                activeProjects,
                completedProjects
            });

            // Generate revenue data (last 6 months)
            const last6Months = Array.from({ length: 6 }, (_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - (5 - i));
                return {
                    month: d.toLocaleString('default', { month: 'short' }),
                    year: d.getFullYear(),
                    monthIndex: d.getMonth(),
                    revenue: 0,
                    expenses: 0 // No expenses table yet, showing 0
                };
            });

            invoices.filter(inv => inv.status === 'paid').forEach(inv => {
                const invDate = new Date(inv.issueDate);
                const monthEntry = last6Months.find(m => m.monthIndex === invDate.getMonth() && m.year === invDate.getFullYear());
                if (monthEntry) {
                    monthEntry.revenue += inv.total;
                }
            });

            setRevenueData(last6Months);

            // Client stage distribution
            const stages = ['lead', 'prospect', 'customer', 'lost'];
            const clientStages = stages.map(stage => ({
                name: stage.charAt(0).toUpperCase() + stage.slice(1),
                value: clients.filter(c => c.stage === stage).length
            }));
            setClientData(clientStages);

            // Project status distribution
            const statuses = ['backlog', 'todo', 'in_progress', 'review', 'done'];
            const projectStatuses = statuses.map(status => ({
                name: status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                value: projects.filter(p => p.status === status).length
            }));
            setProjectData(projectStatuses);

        } catch (error) {
            console.error('Error loading report data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = () => {
        alert('Export to PDF functionality - In production, generate comprehensive PDF report');
    };

    const handleExportExcel = () => {
        alert('Export to Excel functionality - In production, generate Excel spreadsheet');
    };

    const COLORS = ['#2dd4bf', '#8b5cf6', '#3b82f6', '#f59e0b', '#ef4444'];

    if (loading) {
        return <div className="flex items-center justify-center h-full"><div className="text-slate-400">Loading reports...</div></div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Business Reports</h2>
                    <p className="text-slate-400 mt-1">Analytics and insights</p>
                </div>
                <div className="flex gap-3">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                    >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="365">Last year</option>
                    </select>
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Export PDF
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard
                    label="Total Revenue"
                    value={`$${stats.totalRevenue.toLocaleString()}`}
                    icon={DollarSign}
                    color="text-teal-400"
                />
                <MetricCard
                    label="Total Clients"
                    value={stats.totalClients.toString()}
                    icon={Users}
                    color="text-violet-400"
                />
                <MetricCard
                    label="Active Projects"
                    value={stats.activeProjects.toString()}
                    icon={Briefcase}
                    color="text-blue-400"
                />
                <MetricCard
                    label="Completed"
                    value={stats.completedProjects.toString()}
                    icon={TrendingUp}
                    color="text-green-400"
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Chart */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold mb-4">Revenue & Expenses</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="month" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                                labelStyle={{ color: '#94a3b8' }}
                            />
                            <Legend />
                            <Bar dataKey="revenue" fill="#2dd4bf" name="Revenue" />
                            <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Client Distribution */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold mb-4">Client Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={clientData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {clientData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Project Status */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold mb-4">Project Status</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={projectData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis type="number" stroke="#94a3b8" />
                            <YAxis dataKey="name" type="category" stroke="#94a3b8" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                                labelStyle={{ color: '#94a3b8' }}
                            />
                            <Bar dataKey="value" fill="#8b5cf6" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Revenue Trend */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
                    <ResponsiveContainer width="100%" height={300}>
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
        </div>
    );
};

const MetricCard = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg bg-slate-950 border border-slate-800 ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            <p className="text-sm text-slate-400">{label}</p>
        </div>
        <p className="text-2xl font-bold">{value}</p>
    </div>
);

export default ReportsPage;
