'use client';

import { Select as AlphaCloneSelect } from '@/components/ui/select';


import React, { useState, useEffect } from 'react';
import { User, ProjectStage } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import toast from 'react-hot-toast';
import { businessClientService } from '../../../services/businessClientService';
import { projectService } from '../../../services/projectService';
import { businessInvoiceService } from '../../../services/businessInvoiceService';
import { supabase } from '../../../lib/supabase';
import {
    TrendingUp,
    Download,
    Calendar,
    DollarSign,
    Users,
    Briefcase,
    BrainCircuit,
    AlertTriangle
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ModuleIntelligenceCard } from '../ModuleIntelligenceCard';
import { WrapChart } from '@/lib/chartWrapper';
import { StandardStatCard, StandardLineChart, StandardDonutChart, type CardTheme } from '@/components/ui/design-system';
import { EnterprisePageHeader } from '@/components/dashboard/responsive/EnterpriseModuleChrome';

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
    const [isExporting, setIsExporting] = useState(false);
    const [exportCategory, setExportCategory] = useState<'revenue' | 'clients' | 'activity'>('revenue');
    const [intelligenceModule, setIntelligenceModule] = useState('overall');
    const [intelligencePoints, setIntelligencePoints] = useState<Array<{ timestamp: string; score: number; confidence: number }>>([]);
    const [intelligenceSummary, setIntelligenceSummary] = useState<{ topActions: string[]; systemicRisks: string[] } | null>(null);

    const handleExport = async (type: 'pdf' | 'xlsx', category: string) => {
        if (!currentTenant?.id) {
            toast.error("Tenant information unavailable");
            return;
        }

        setIsExporting(true);
        try {
            const url = `/api/reports/export?type=${type}&category=${category}&tenantId=${currentTenant.id}`;
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
        if (currentTenant) {
            loadReportData();
            void loadIntelligenceData();
        }
    }, [currentTenant, dateRange]);

    useEffect(() => {
        if (currentTenant) {
            void loadIntelligenceData();
        }
    }, [currentTenant, intelligenceModule, dateRange]);

    const loadReportData = async () => {
        if (!currentTenant) return;

        setLoading(true);
        try {
            const days = parseInt(dateRange);
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            const cutoffISO = cutoff.toISOString();

            const { clients } = await businessClientService.getClients(currentTenant.id);
            const { projects } = await projectService.getProjects(user.id, user.role);
            const { invoices: allInvoices } = await businessInvoiceService.getInvoices(currentTenant.id);

            // Filter invoices by date range
            const invoices = allInvoices.filter(inv => new Date(inv.issueDate) >= cutoff);

            // Fetch real expense data for date range
            const { data: expenses } = await supabase
                .from('expenses')
                .select('amount, tax_amount, total, date, status')
                .eq('tenant_id', currentTenant.id)
                .gte('date', cutoff.toISOString().split('T')[0]);

            // Calculate stats
            const totalRevenue = Math.round(invoices
                .filter(inv => inv.status === 'paid')
                .reduce((sum, inv) => sum + (inv.total || 0), 0) * 100) / 100;

            const activeProjects = projects.filter(p => p.status === 'Active' || p.status === 'Pending').length;
            const completedProjects = projects.filter(p => p.status === 'Completed').length;

            setStats({
                totalRevenue,
                totalClients: clients.length,
                activeProjects,
                completedProjects
            });

            // Dynamic chart: number of months based on date range
            const numMonths = days <= 30 ? 1 : days <= 90 ? 3 : days <= 180 ? 6 : 12;
            const chartMonths = Array.from({ length: numMonths }, (_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - (numMonths - 1 - i));
                return {
                    month: d.toLocaleString('default', { month: 'short', year: numMonths > 6 ? '2-digit' : undefined }),
                    year: d.getFullYear(),
                    monthIndex: d.getMonth(),
                    revenue: 0,
                    expenses: 0
                };
            });

            invoices.filter(inv => inv.status === 'paid').forEach(inv => {
                const invDate = new Date(inv.issueDate);
                const monthEntry = chartMonths.find(m => m.monthIndex === invDate.getMonth() && m.year === invDate.getFullYear());
                if (monthEntry) {
                    monthEntry.revenue = Math.round((monthEntry.revenue + inv.total) * 100) / 100;
                }
            });

            (expenses || []).forEach((exp: any) => {
                const expDate = new Date(exp.date);
                const monthEntry = chartMonths.find(m => m.monthIndex === expDate.getMonth() && m.year === expDate.getFullYear());
                if (monthEntry) {
                    monthEntry.expenses = Math.round((monthEntry.expenses + (exp.total ?? exp.amount)) * 100) / 100;
                }
            });

            setRevenueData(chartMonths);

            // Client stage distribution
            const stages = ['lead', 'prospect', 'customer', 'lost'];
            const clientStages = stages.map(stage => ({
                name: stage.charAt(0).toUpperCase() + stage.slice(1),
                value: clients.filter(c => c.salesStage === stage).length
            }));
            setClientData(clientStages);

            // Project status distribution (mapped to stages)
            const projectStages: ProjectStage[] = ['Initiation', 'Planning', 'Execution', 'Review', 'Closure'];
            const projectStatuses = projectStages.map(stage => ({
                name: stage,
                value: projects.filter(p => p.currentStage === stage).length
            }));
            setProjectData(projectStatuses);

        } catch (error) {
            console.error('Error loading report data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadIntelligenceData = async () => {
        if (!currentTenant?.id) return;
        try {
            const trendUrl = intelligenceModule === 'overall'
                ? `/api/intelligence/trends?tenantId=${encodeURIComponent(currentTenant.id)}&limit=30`
                : `/api/intelligence/trends?tenantId=${encodeURIComponent(currentTenant.id)}&module=${encodeURIComponent(intelligenceModule)}&limit=30`;
            const trendRes = await fetch(trendUrl);
            const trendPayload = await trendRes.json().catch(() => ({}));
            if (trendRes.ok) {
                setIntelligencePoints(trendPayload?.data?.points || []);
            }

            const drillUrl = intelligenceModule === 'overall'
                ? `/api/intelligence/system?tenantId=${encodeURIComponent(currentTenant.id)}`
                : `/api/intelligence/system?tenantId=${encodeURIComponent(currentTenant.id)}&module=${encodeURIComponent(intelligenceModule)}`;
            const drillRes = await fetch(drillUrl);
            const drillPayload = await drillRes.json().catch(() => ({}));
            if (drillRes.ok) {
                const data = drillPayload?.data;
                setIntelligenceSummary({
                    topActions: Array.isArray(data?.topActions) ? data.topActions.slice(0, 5) : [],
                    systemicRisks: Array.isArray(data?.systemicRisks) ? data.systemicRisks.slice(0, 5) : []
                });
            }
        } catch (error) {
            console.error('Error loading intelligence data:', error);
        }
    };

    const handleExportPDF = () => {
        handleExport('pdf', 'revenue');
    };

    const handleExportExcel = () => {
        handleExport('xlsx', 'revenue');
    };

    const COLORS = ['var(--success-500)', 'var(--brand-blue-400)', 'var(--brand-violet-500)', 'var(--warning-500)', 'var(--error-500)'];

    if (loading) {
        return (
            <div className="ac-scroll-full ac-enterprise-module min-h-0 flex items-center justify-center py-12">
                <div className="text-[var(--border-default)]">Loading reports...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 ac-scroll-full ac-enterprise-module">
            <EnterprisePageHeader moduleKey="reports">
                <div className="flex flex-wrap gap-3">
                    <AlphaCloneSelect
                        value={exportCategory}
                        onChange={(e) => setExportCategory(e.target.value as any)}
                        className="px-4 py-2"
                    >
                        <option value="revenue">Revenue Data</option>
                        <option value="clients">Client List</option>
                        <option value="activity">Activity Logs</option>
                    </AlphaCloneSelect>
                    <AlphaCloneSelect
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="px-4 py-2"
                    >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="365">Last year</option>
                    </AlphaCloneSelect>
                    <button
                        onClick={() => handleExport('pdf', exportCategory)}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--ws-hover)] hover:bg-[var(--ws-hover)] border border-[var(--ws-border)] rounded-lg transition-colors disabled:opacity-50"
                        title="Export PDF"
                        disabled={isExporting}
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Export PDF</span>
                    </button>
                    <button
                        onClick={() => handleExport('xlsx', exportCategory)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-[var(--text-inverse)] rounded-lg transition-colors disabled:opacity-50"
                        title="Export Excel"
                        disabled={isExporting}
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Export Excel</span>
                    </button>
                </div>
            </EnterprisePageHeader>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StandardStatCard
                    label="Total Revenue"
                    value={`$${stats.totalRevenue.toLocaleString()}`}
                    icon={DollarSign}
                    themeColor="teal"
                    interactive={false}
                />
                <StandardStatCard
                    label="Total Clients"
                    value={stats.totalClients.toString()}
                    icon={Users}
                    themeColor="purple"
                    interactive={false}
                />
                <StandardStatCard
                    label="Active Projects"
                    value={stats.activeProjects.toString()}
                    icon={Briefcase}
                    themeColor="blue"
                    interactive={false}
                />
                <StandardStatCard
                    label="Completed"
                    value={stats.completedProjects.toString()}
                    icon={TrendingUp}
                    themeColor="emerald"
                    interactive={false}
                />
            </div>

            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <BrainCircuit className="w-5 h-5 text-[var(--success-500)]" />
                            Intelligence Trajectory
                        </h3>
                        <p className="type-card-description text-[var(--border-default)]">Module-level trend and drilldown actions for operators</p>
                    </div>
                    <AlphaCloneSelect
                        value={intelligenceModule}
                        onChange={(e) => setIntelligenceModule(e.target.value)}
                        className="px-4 py-2"
                    >
                        <option value="overall">Overall system</option>
                        <option value="crm">CRM</option>
                        <option value="invoicingRevenue">Invoicing and Revenue</option>
                        <option value="emailInbox">Email and Inbox</option>
                        <option value="taskManagement">Task Management</option>
                        <option value="socialMedia">Social Media</option>
                        <option value="aiProposals">AI Proposals</option>
                        <option value="analyticsDashboard">Analytics and Dashboard</option>
                        <option value="teamCollaboration">Team Collaboration</option>
                        <option value="automationWorkflows">Automation and Workflows</option>
                        <option value="customerSuccess">Customer Success</option>
                    </AlphaCloneSelect>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-[var(--ws-hover)] border border-[var(--ws-border)] rounded-2xl p-5">
                        <h4 className="type-ui font-semibold text-[var(--ws-border)] mb-3">Score Trend</h4>
                        <StandardLineChart
                            data={intelligencePoints.map((point) => ({
                                ...point,
                                label: new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                                value: point.score,
                            }))}
                            xKey="label"
                            yKey="value"
                            name="Score"
                            color="var(--success-500)"
                            height={220}
                        />
                    </div>
                    <div className="space-y-3">
                        <ModuleIntelligenceCard
                            moduleKey={intelligenceModule === 'overall' ? 'analyticsDashboard' : intelligenceModule}
                            title="Module Snapshot"
                        />
                        {intelligenceSummary && (
                            <div className="bg-[var(--ws-hover)] border border-[var(--ws-border)] rounded-2xl p-3 space-y-3">
                                <div>
                            <div className="type-caption text-[var(--success-500)] font-semibold mb-1">Top Actions</div>
                                    <ul className="space-y-1">
                                        {(Array.isArray(intelligenceSummary.topActions) ? intelligenceSummary.topActions : []).slice(0, 2).map((item) => (
                                            <li key={item} className="type-caption text-[var(--ws-border)] line-clamp-2">{item}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                            <div className="type-caption text-[var(--warning-500)] font-semibold mb-1 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        Top Risks
                                    </div>
                                    <ul className="space-y-1">
                                        {(Array.isArray(intelligenceSummary.systemicRisks) ? intelligenceSummary.systemicRisks : []).slice(0, 2).map((item) => (
                                            <li key={item} className="type-caption text-[var(--ws-border)] line-clamp-2">{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Chart */}
                            <div className="bg-[var(--ws-hover)] border border-[var(--ws-border)] rounded-2xl p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-[var(--surface-secondary)] mb-4">Revenue & Expenses</h3>
                    <WrapChart height={300}>
                        <BarChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" className="dashboard-chart-grid" vertical={false} />
                            <XAxis dataKey="month" stroke="var(--border-default)" />
                            <YAxis stroke="var(--border-default)" />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                                labelStyle={{ color: 'var(--border-default)', fontSize: 'var(--type-caption-size)', fontWeight: 'bold' }}
                                itemStyle={{ color: 'var(--surface-secondary)', fontSize: 'var(--type-caption-size)' }}
                            />
                            <Legend />
                            <Bar dataKey="revenue" fill="var(--success-500)" name="Revenue" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expenses" fill="var(--error-500)" name="Expenses" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </WrapChart>
                </div>

                {/* Client Distribution */}
                <div className="bg-[var(--ws-hover)] border border-[var(--ws-border)] rounded-2xl p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-[var(--surface-secondary)] mb-4">Client Distribution</h3>
                    <StandardDonutChart
                        data={clientData.map((entry, index) => ({
                            name: entry.name,
                            value: entry.value,
                            color: COLORS[index % COLORS.length]
                        }))}
                        height={300}
                    />
                </div>

                {/* Project Status */}
                <div className="bg-[var(--ws-hover)] border border-[var(--ws-border)] rounded-2xl p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-[var(--surface-secondary)] mb-4">Project Status</h3>
                    <WrapChart height={300}>
                        <BarChart data={projectData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="dashboard-chart-grid" vertical={false} />
                            <XAxis type="number" stroke="var(--border-default)" />
                            <YAxis dataKey="name" type="category" stroke="var(--border-default)" width={100} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                                labelStyle={{ color: 'var(--border-default)', fontSize: 'var(--type-caption-size)', fontWeight: 'bold' }}
                                itemStyle={{ color: 'var(--surface-secondary)', fontSize: 'var(--type-caption-size)' }}
                            />
                            <Bar dataKey="value" fill="var(--brand-violet-500)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </WrapChart>
                </div>

                {/* Revenue Trend */}
                <div className="bg-[var(--ws-hover)] border border-[var(--ws-border)] rounded-2xl p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-[var(--surface-secondary)] mb-4">Revenue Trend</h3>
                    <StandardLineChart
                        data={revenueData.map((d) => ({
                            ...d,
                            label: d.month,
                            value: d.revenue
                        }))}
                        xKey="label"
                        yKey="value"
                        name="Revenue"
                        color="var(--success-500)"
                        valuePrefix="$"
                        height={300}
                    />
                </div>
            </div>
        </div>
    );
};

export default ReportsPage;
