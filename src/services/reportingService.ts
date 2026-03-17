import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { format, startOfDay, endOfDay } from 'date-fns';

export interface ReportConfig {
    name: string;
    description?: string;
    type: 'project' | 'financial' | 'client' | 'team' | 'custom';
    dateRange: {
        from: Date;
        to: Date;
    };
    filters: {
        status?: string[];
        category?: string[];
        userId?: string;
        projectId?: string;
    };
    groupBy?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    metrics: string[];
    format: 'pdf' | 'excel' | 'csv' | 'json';
}

export interface ReportTemplate {
    id: string;
    name: string;
    description: string;
    type: string;
    config: ReportConfig;
    createdBy: string;
    createdAt: string;
}

export interface ReportData {
    summary: {
        totalProjects: number;
        totalRevenue: number;
        totalClients: number;
        averageProjectDuration: number;
    };
    charts: Array<{
        type: 'line' | 'bar' | 'pie' | 'area';
        title: string;
        data: any[];
    }>;
    tables: Array<{
        title: string;
        headers: string[];
        rows: any[][];
    }>;
    metadata: {
        generatedAt: string;
        dateRange: string;
        generatedBy: string;
    };
}

export const reportingService = {
    /**
     * Generate a custom report
     */
    async generateReport(config: ReportConfig, userId: string): Promise<{ data: ReportData | null; error: string | null }> {
        try {
            const reportData: ReportData = {
                summary: await this.getSummary(config),
                charts: await this.generateCharts(config),
                tables: await this.generateTables(config),
                metadata: {
                    generatedAt: new Date().toISOString(),
                    dateRange: `${format(config.dateRange.from, 'MMM dd, yyyy')} - ${format(config.dateRange.to, 'MMM dd, yyyy')}`,
                    generatedBy: userId,
                },
            };

            // Save report to database
            await this.saveReport(config, reportData, userId);

            return { data: reportData, error: null };
        } catch (error) {
            return {
                data: null,
                error: error instanceof Error ? error.message : 'Report generation failed',
            };
        }
    },

    /**
     * Get summary metrics
     */
    async getSummary(config: ReportConfig) {
        const from = startOfDay(config.dateRange.from).toISOString();
        const to = endOfDay(config.dateRange.to).toISOString();

        let projectQuery = supabase
            .from('projects')
            .select('*', { count: 'exact' })
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .gte('created_at', from)
            .lte('created_at', to);

        if (config.filters.status) {
            projectQuery = projectQuery.in('status', config.filters.status);
        }

        if (config.filters.category) {
            projectQuery = projectQuery.in('category', config.filters.category);
        }

        const { count: totalProjects } = await projectQuery;

        // Get revenue
        let invoiceQuery = supabase
            .from('invoices')
            .select('amount')
            .eq('status', 'Paid')
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .gte('created_at', from)
            .lte('created_at', to);

        const { data: invoices } = await invoiceQuery;
        const totalRevenue = (invoices || []).reduce((sum: number, inv: { amount: number }) => sum + (inv.amount || 0), 0);

        // Get clients
        const { count: totalClients } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'client')
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .gte('created_at', from)
            .lte('created_at', to);

        // Calculate average project duration
        const { data: completedProjects } = await supabase
            .from('projects')
            .select('created_at, updated_at')
            .eq('status', 'Completed')
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .gte('created_at', from)
            .lte('created_at', to);

        const durations = (completedProjects || [])
            .filter((p: any) => p.created_at && p.updated_at)
            .map((p: any) => {
                const start = new Date(p.created_at);
                const end = new Date(p.updated_at);
                return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            });

        const averageProjectDuration = durations.length > 0
            ? durations.reduce((sum: number, d: number) => sum + d, 0) / durations.length
            : 0;

        return {
            totalProjects: totalProjects || 0,
            totalRevenue,
            totalClients: totalClients || 0,
            averageProjectDuration: Math.round(averageProjectDuration),
        };
    },

    /**
     * Generate charts data
     */
    async generateCharts(config: ReportConfig) {
        const charts: ReportData['charts'] = [];

        // Revenue over time
        if (config.metrics.includes('revenue')) {
            const revenueData = await this.getRevenueOverTime(config);
            charts.push({
                type: 'line',
                title: 'Revenue Over Time',
                data: revenueData,
            });
        }

        // Project status distribution
        if (config.metrics.includes('projects')) {
            const statusData = await this.getProjectStatusDistribution(config);
            charts.push({
                type: 'pie',
                title: 'Project Status Distribution',
                data: statusData,
            });
        }

        // Client growth
        if (config.metrics.includes('clients')) {
            const clientData = await this.getClientGrowth(config);
            charts.push({
                type: 'area',
                title: 'Client Growth',
                data: clientData,
            });
        }

        return charts;
    },

    /**
     * Generate tables data
     */
    async generateTables(config: ReportConfig) {
        const tables: ReportData['tables'] = [];

        if (config.type === 'project' || config.type === 'custom') {
            const projects = await this.getProjectsTable(config);
            tables.push({
                title: 'Projects',
                headers: ['Name', 'Status', 'Progress', 'Created', 'Due Date'],
                rows: projects,
            });
        }

        if (config.type === 'financial' || config.type === 'custom') {
            const invoices = await this.getInvoicesTable(config);
            tables.push({
                title: 'Invoices',
                headers: ['ID', 'Description', 'Amount', 'Status', 'Due Date'],
                rows: invoices,
            });
        }

        return tables;
    },

    /**
     * Get revenue over time
     */
    async getRevenueOverTime(config: ReportConfig) {
        const from = startOfDay(config.dateRange.from).toISOString();
        const to = endOfDay(config.dateRange.to).toISOString();

        const { data: invoices } = await supabase
            .from('invoices')
            .select('amount, created_at')
            .eq('status', 'Paid')
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .gte('created_at', from)
            .lte('created_at', to)
            .order('created_at', { ascending: true });

        // Group by period
        const grouped: Record<string, number> = {};
        (invoices || []).forEach((inv: any) => {
            const date = new Date(inv.created_at);
            let key: string;

            switch (config.groupBy) {
                case 'day':
                    key = format(date, 'yyyy-MM-dd');
                    break;
                case 'week':
                    key = format(date, 'yyyy-ww');
                    break;
                case 'month':
                    key = format(date, 'yyyy-MM');
                    break;
                case 'quarter':
                    const quarter = Math.floor(date.getMonth() / 3) + 1;
                    key = `${date.getFullYear()}-Q${quarter}`;
                    break;
                case 'year':
                    key = format(date, 'yyyy');
                    break;
                default:
                    key = format(date, 'yyyy-MM-dd');
            }

            grouped[key] = (grouped[key] || 0) + (inv.amount || 0);
        });

        return Object.entries(grouped).map(([date, revenue]) => ({
            date,
            revenue,
        }));
    },

    /**
     * Get project status distribution
     */
    async getProjectStatusDistribution(config: ReportConfig) {
        const from = startOfDay(config.dateRange.from).toISOString();
        const to = endOfDay(config.dateRange.to).toISOString();

        let query = supabase
            .from('projects')
            .select('status')
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .gte('created_at', from)
            .lte('created_at', to);

        if (config.filters.status) {
            query = query.in('status', config.filters.status);
        }

        const { data: projects } = await query;

        const distribution: Record<string, number> = {};
        (projects || []).forEach((p: any) => {
            distribution[p.status] = (distribution[p.status] || 0) + 1;
        });

        return Object.entries(distribution).map(([status, count]) => ({
            status,
            count,
        }));
    },

    /**
     * Get client growth
     */
    async getClientGrowth(config: ReportConfig) {
        const from = startOfDay(config.dateRange.from).toISOString();
        const to = endOfDay(config.dateRange.to).toISOString();

        const { data: clients } = await supabase
            .from('profiles')
            .select('created_at')
            .eq('role', 'client')
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .gte('created_at', from)
            .lte('created_at', to)
            .order('created_at', { ascending: true });

        // Group by period
        const grouped: Record<string, number> = {};
        let cumulative = 0;

        (clients || []).forEach((client: any) => {
            const date = new Date(client.created_at);
            let key: string;

            switch (config.groupBy) {
                case 'day':
                    key = format(date, 'yyyy-MM-dd');
                    break;
                case 'week':
                    key = format(date, 'yyyy-ww');
                    break;
                case 'month':
                    key = format(date, 'yyyy-MM');
                    break;
                default:
                    key = format(date, 'yyyy-MM-dd');
            }

            cumulative++;
            grouped[key] = cumulative;
        });

        return Object.entries(grouped).map(([date, count]) => ({
            date,
            count,
        }));
    },

    /**
     * Get projects table data
     */
    async getProjectsTable(config: ReportConfig) {
        const from = startOfDay(config.dateRange.from).toISOString();
        const to = endOfDay(config.dateRange.to).toISOString();

        let query = supabase
            .from('projects')
            .select('name, status, progress, created_at, due_date')
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .gte('created_at', from)
            .lte('created_at', to);

        if (config.filters.status) {
            query = query.in('status', config.filters.status);
        }

        const { data: projects } = await query;

        return (projects || []).map((p: any) => [
            p.name,
            p.status,
            `${p.progress || 0}%`,
            format(new Date(p.created_at), 'MMM dd, yyyy'),
            p.due_date ? format(new Date(p.due_date), 'MMM dd, yyyy') : 'N/A',
        ]);
    },

    /**
     * Get invoices table data
     */
    async getInvoicesTable(config: ReportConfig) {
        const from = startOfDay(config.dateRange.from).toISOString();
        const to = endOfDay(config.dateRange.to).toISOString();

        const { data: invoices } = await supabase
            .from('invoices')
            .select('id, description, amount, status, due_date')
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .gte('created_at', from)
            .lte('created_at', to);

        return (invoices || []).map((inv: any) => [
            inv.id.substring(0, 8).toUpperCase(),
            inv.description || 'N/A',
            `$${inv.amount?.toLocaleString() || '0'}`,
            inv.status,
            inv.due_date ? format(new Date(inv.due_date), 'MMM dd, yyyy') : 'N/A',
        ]);
    },

    /**
     * Save report template
     */
    async saveReportTemplate(template: Omit<ReportTemplate, 'id' | 'createdAt'>): Promise<{ template: ReportTemplate | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('report_templates')
                .insert({
                    name: template.name,
                    description: template.description,
                    type: template.type,
                    config: template.config,
                    created_by: template.createdBy,
                    tenant_id: tenantService.getCurrentTenantId(),
                })
                .select()
                .single();

            if (error) throw error;

            return {
                template: {
                    id: data.id,
                    name: data.name,
                    description: data.description,
                    type: data.type,
                    config: data.config,
                    createdBy: data.created_by,
                    createdAt: data.created_at,
                },
                error: null,
            };
        } catch (error) {
            return {
                template: null,
                error: error instanceof Error ? error.message : 'Failed to save template',
            };
        }
    },

    /**
     * Get report templates
     */
    async getReportTemplates(userId: string): Promise<{ templates: ReportTemplate[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('report_templates')
                .select('*')
                .eq('created_by', userId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .order('created_at', { ascending: false });

            if (error) throw error;

            return {
                templates: (data || []).map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    description: t.description,
                    type: t.type,
                    config: t.config,
                    createdBy: t.created_by,
                    createdAt: t.created_at,
                })),
                error: null,
            };
        } catch (error) {
            return {
                templates: [],
                error: error instanceof Error ? error.message : 'Failed to fetch templates',
            };
        }
    },

    /**
     * Save generated report
     */
    async saveReport(config: ReportConfig, data: ReportData, userId: string): Promise<void> {
        try {
            await supabase.from('reports').insert({
                name: config.name,
                type: config.type,
                config: config,
                data: data,
                created_by: userId,
                created_at: new Date().toISOString(),
                tenant_id: tenantService.getCurrentTenantId(),
            });
        } catch (error) {
            // Silently fail - report saving is optional
        }
    },

    /**
     * Schedule report delivery
     */
    async scheduleReport(
        templateId: string,
        schedule: 'daily' | 'weekly' | 'monthly',
        recipients: string[],
        userId: string
    ): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase.from('scheduled_reports').insert({
                template_id: templateId,
                schedule,
                recipients,
                created_by: userId,
                next_run: this.calculateNextRun(schedule),
                tenant_id: tenantService.getCurrentTenantId(),
            });

            if (error) throw error;

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to schedule report',
            };
        }
    },

    /**
     * Calculate next run time
     */
    calculateNextRun(schedule: 'daily' | 'weekly' | 'monthly'): string {
        const now = new Date();
        switch (schedule) {
            case 'daily':
                now.setDate(now.getDate() + 1);
                break;
            case 'weekly':
                now.setDate(now.getDate() + 7);
                break;
            case 'monthly':
                now.setMonth(now.getMonth() + 1);
                break;
        }
        return now.toISOString();
    },

    /**
     * Export report to PDF/Excel/CSV
     */
    async exportReport(reportData: ReportData, format: 'pdf' | 'excel' | 'csv' | 'json'): Promise<{ blob: Blob | null; error: string | null }> {
        try {
            switch (format) {
                case 'json':
                    return {
                        blob: new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' }),
                        error: null,
                    };
                case 'csv':
                    return this.exportToCSV(reportData);
                case 'excel':
                    return this.exportToExcel(reportData);
                case 'pdf':
                    return this.exportToPDF(reportData);
                default:
                    return { blob: null, error: 'Unsupported format' };
            }
        } catch (error) {
            return {
                blob: null,
                error: error instanceof Error ? error.message : 'Export failed',
            };
        }
    },

    /**
     * Export to CSV
     */
    async exportToCSV(reportData: ReportData): Promise<{ blob: Blob | null; error: string | null }> {
        try {
            let csv = 'Report Data\n\n';
            csv += `Generated: ${reportData.metadata.generatedAt}\n`;
            csv += `Date Range: ${reportData.metadata.dateRange}\n\n`;

            reportData.tables.forEach((table) => {
                csv += `${table.title}\n`;
                csv += table.headers.join(',') + '\n';
                table.rows.forEach((row) => {
                    csv += row.join(',') + '\n';
                });
                csv += '\n';
            });

            return {
                blob: new Blob([csv], { type: 'text/csv' }),
                error: null,
            };
        } catch (error) {
            return { blob: null, error: 'CSV export failed' };
        }
    },

    /**
     * Export to Excel (placeholder - would use xlsx library)
     */
    async exportToExcel(reportData: ReportData): Promise<{ blob: Blob | null; error: string | null }> {
        // In production, use: import * as XLSX from 'xlsx';
        // For now, return CSV as Excel
        return this.exportToCSV(reportData);
    },

    /**
     * Export to PDF (placeholder - would use jsPDF)
     */
    async exportToPDF(_reportData: ReportData): Promise<{ blob: Blob | null; error: string | null }> {
        // In production, use: import jsPDF from 'jspdf';
        // For now, return error
        return { blob: null, error: 'PDF export requires jsPDF library' };
    },
};

