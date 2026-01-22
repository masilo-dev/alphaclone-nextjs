import { supabase } from '../lib/supabase';
import { auditLoggingService } from './auditLoggingService';

export interface ExportOptions {
    format: 'csv' | 'json' | 'xlsx';
    entities: ('projects' | 'clients' | 'messages' | 'invoices' | 'contracts' | 'tasks' | 'deals' | 'quotes')[];
    dateRange?: {
        start: Date;
        end: Date;
    };
    filters?: Record<string, any>;
}

export interface ExportResult {
    success: boolean;
    downloadUrl?: string;
    filename?: string;
    recordCount?: number;
    error?: string;
}

class DataExportService {
    /**
     * Export data based on options
     */
    async exportData(
        userId: string,
        options: ExportOptions
    ): Promise<ExportResult> {
        try {
            // Check permissions
            const { data: user } = await supabase
                .from('users')
                .select('role')
                .eq('id', userId)
                .single();

            if (!user || user.role !== 'admin') {
                return { success: false, error: 'Unauthorized' };
            }

            // Collect data from all requested entities
            const exportData: Record<string, any[]> = {};
            let totalRecords = 0;

            for (const entity of options.entities) {
                const data = await this.fetchEntityData(entity, options);
                exportData[entity] = data;
                totalRecords += data.length;
            }

            // Generate export file
            const result = await this.generateExportFile(exportData, options.format);

            // Log export
            await auditLoggingService.logAction(
                'data_exported',
                'export',
                userId,
                undefined,
                {
                    entities: options.entities,
                    format: options.format,
                    record_count: totalRecords,
                }
            );

            return {
                success: true,
                downloadUrl: result.url,
                filename: result.filename,
                recordCount: totalRecords,
            };
        } catch (error) {
            console.error('Error exporting data:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Fetch data for a specific entity
     */
    private async fetchEntityData(
        entity: string,
        options: ExportOptions
    ): Promise<any[]> {
        try {
            let query = supabase.from(entity).select('*');

            // Apply date range filter
            if (options.dateRange) {
                query = query
                    .gte('created_at', options.dateRange.start.toISOString())
                    .lte('created_at', options.dateRange.end.toISOString());
            }

            // Apply custom filters
            if (options.filters) {
                Object.entries(options.filters).forEach(([key, value]) => {
                    query = query.eq(key, value);
                });
            }

            const { data } = await query;
            return data || [];
        } catch (error) {
            console.error(`Error fetching ${entity} data:`, error);
            return [];
        }
    }

    /**
     * Generate export file
     */
    private async generateExportFile(
        data: Record<string, any[]>,
        format: 'csv' | 'json' | 'xlsx'
    ): Promise<{ url: string; filename: string }> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `alphaclone-export-${timestamp}.${format}`;

        switch (format) {
            case 'json':
                return this.generateJSON(data, filename);
            case 'csv':
                return this.generateCSV(data, filename);
            case 'xlsx':
                return this.generateXLSX(data, filename);
            default:
                throw new Error('Unsupported format');
        }
    }

    /**
     * Generate JSON export
     */
    private async generateJSON(
        data: Record<string, any[]>,
        filename: string
    ): Promise<{ url: string; filename: string }> {
        const jsonContent = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });

        // In production, upload to storage and return URL
        // For now, create a data URL
        const url = URL.createObjectURL(blob);

        return { url, filename };
    }

    /**
     * Generate CSV export
     */
    private async generateCSV(
        data: Record<string, any[]>,
        filename: string
    ): Promise<{ url: string; filename: string }> {
        let csvContent = '';

        // Generate CSV for each entity
        Object.entries(data).forEach(([entity, records]) => {
            if (records.length === 0) return;

            csvContent += `\n\n=== ${entity.toUpperCase()} ===\n`;

            // Headers
            const headers = Object.keys(records[0]);
            csvContent += headers.join(',') + '\n';

            // Rows
            records.forEach(record => {
                const row = headers.map((header: any) => {
                    const value = record[header];
                    // Escape commas and quotes
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                });
                csvContent += row.join(',') + '\n';
            });
        });

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);

        return { url, filename };
    }

    /**
     * Generate XLSX export
     */
    private async generateXLSX(
        data: Record<string, any[]>,
        filename: string
    ): Promise<{ url: string; filename: string }> {
        // In production, use a library like xlsx or exceljs
        // For now, fall back to CSV
        return this.generateCSV(data, filename.replace('.xlsx', '.csv'));
    }

    /**
     * Schedule automated backup
     */
    async scheduleBackup(
        frequency: 'daily' | 'weekly' | 'monthly',
        entities: ExportOptions['entities']
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // In production, this would create a cron job or scheduled task
            await supabase.from('scheduled_backups').insert({
                frequency,
                entities,
                active: true,
                created_at: new Date().toISOString(),
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * GDPR data export (all user data)
     */
    async exportUserData(userId: string): Promise<ExportResult> {
        try {
            const userData: Record<string, any> = {};

            // Fetch all user-related data
            const [profile, projects, messages, invoices, contracts, tasks] = await Promise.all([
                supabase.from('users').select('*').eq('id', userId).single(),
                supabase.from('projects').select('*').eq('owner_id', userId),
                supabase.from('messages').select('*').or(`sender_id.eq.${userId},recipient_id.eq.${userId}`),
                supabase.from('invoices').select('*').eq('user_id', userId),
                supabase.from('contracts').select('*').eq('client_id', userId),
                supabase.from('tasks').select('*').eq('assigned_to', userId),
            ]);

            userData.profile = profile.data;
            userData.projects = projects.data || [];
            userData.messages = messages.data || [];
            userData.invoices = invoices.data || [];
            userData.contracts = contracts.data || [];
            userData.tasks = tasks.data || [];

            // Generate JSON export
            const result = await this.generateJSON(userData, `user-data-${userId}.json`);

            // Log GDPR export
            await auditLoggingService.logAction(
                'gdpr_data_export',
                'user',
                userId,
                undefined,
                { export_type: 'gdpr' }
            );

            return {
                success: true,
                downloadUrl: result.url,
                filename: result.filename,
                recordCount: Object.values(userData).flat().length,
            };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Bulk export for migration
     */
    async exportForMigration(): Promise<ExportResult> {
        try {
            const allEntities: ExportOptions['entities'] = [
                'projects',
                'clients',
                'messages',
                'invoices',
                'contracts',
                'tasks',
                'deals',
                'quotes',
            ];

            // This would be admin-only
            const exportData: Record<string, any[]> = {};

            for (const entity of allEntities) {
                const { data } = await supabase.from(entity).select('*');
                exportData[entity] = data || [];
            }

            const result = await this.generateJSON(exportData, 'full-migration-export.json');

            return {
                success: true,
                downloadUrl: result.url,
                filename: result.filename,
                recordCount: Object.values(exportData).flat().length,
            };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Get export history
     */
    async getExportHistory(userId: string): Promise<any[]> {
        try {
            const { data } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('user_id', userId)
                .in('action', ['data_exported', 'gdpr_data_export'])
                .order('created_at', { ascending: false })
                .limit(50);

            return data || [];
        } catch (error) {
            console.error('Error fetching export history:', error);
            return [];
        }
    }
}

export const dataExportService = new DataExportService();
