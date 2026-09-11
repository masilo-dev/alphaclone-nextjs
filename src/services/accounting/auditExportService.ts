import { supabase } from '../../lib/supabase';
import { tenantService } from '../tenancy/TenantService';
import { auditLoggingService } from '../auditLoggingService';
import { generalLedgerService } from './generalLedgerService';

export interface AuditExportOptions {
    fiscalYear: number;
    periodId?: string;
    includeAuditLogs: boolean;
    format: 'csv' | 'json';
}

export interface AuditExportResult {
    success: boolean;
    downloadUrl?: string;
    filename?: string;
    error?: string;
}

export const auditExportService = {
    /**
     * Generate a one-click audit package for a CPA
     */
    async generateAuditPackage(options: AuditExportOptions): Promise<AuditExportResult> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('No active tenant');

            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;

            // 1. Fetch General Ledger Data
            const glData = await this.fetchGeneralLedger(tenantId, options);

            // 2. Fetch Trial Balance
            const asOfDate = options.periodId ? undefined : `${options.fiscalYear}-12-31`;
            const trialBalance = await generalLedgerService.getTrialBalance(asOfDate);

            // 3. Fetch Audit Logs (with Fingerprints)
            let auditLogs: any[] = [];
            if (options.includeAuditLogs) {
                auditLogs = await this.fetchAuditLogs(tenantId, options);
            }

            // 4. Package data
            const packageData = {
                metadata: {
                    tenant_id: tenantId,
                    fiscal_year: options.fiscalYear,
                    exported_at: new Date().toISOString(),
                    exported_by: userId,
                    system_version: '2026.1.0-compliance'
                },
                general_ledger: glData,
                trial_balance: trialBalance.trialBalance?.accounts || [],
                audit_trail: auditLogs
            };

            // 5. Generate File
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `audit-package-${options.fiscalYear}-${timestamp}.${options.format}`;

            let url: string;
            if (options.format === 'json') {
                const blob = new Blob([JSON.stringify(packageData, null, 2)], { type: 'application/json' });
                url = URL.createObjectURL(blob);
            } else {
                url = await this.generateCSVPackage(packageData);
            }

            // 6. Log the audit export (Crucial for compliance)
            await auditLoggingService.logAction(
                'audit_package_exported',
                'accounting',
                userId || 'system',
                undefined,
                {
                    fiscal_year: options.fiscalYear,
                    period_id: options.periodId,
                    format: options.format
                }
            );

            return {
                success: true,
                downloadUrl: url,
                filename
            };
        } catch (error: any) {
            console.error('Audit Export Error:', error);
            return { success: false, error: error.message };
        }
    },

    async fetchGeneralLedger(tenantId: string, options: AuditExportOptions) {
        let query = supabase
            .from('journal_entry_lines')
            .select(`
                *,
                entry:journal_entries(
                    entry_number,
                    entry_date,
                    description,
                    reference,
                    fingerprint,
                    previous_fingerprint
                ),
                account:chart_of_accounts(account_code, account_name)
            `)
            .eq('tenant_id', tenantId);

        if (options.periodId) {
            query = query.eq('entry.period_id', options.periodId);
        } else {
            // Filter by year via entry date string comparison roughly
            query = query.gte('entry.entry_date', `${options.fiscalYear}-01-01`)
                .lte('entry.entry_date', `${options.fiscalYear}-12-31`);
        }

        const { data } = await query.order('id', { ascending: true });
        return data || [];
    },

    async fetchAuditLogs(tenantId: string, options: AuditExportOptions) {
        const { data } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('tenant_id', tenantId)
            .gte('created_at', `${options.fiscalYear}-01-01`)
            .lte('created_at', `${options.fiscalYear + 1}-01-01`)
            .order('created_at', { ascending: true });

        return data || [];
    },

    async generateCSVPackage(data: any): Promise<string> {
        // Simple consolidated CSV for proof of concept
        let csv = "Audit Package Export\n";
        csv += `Exported At: ${data.metadata.exported_at}\n\n`;

        csv += "--- TRIAL BALANCE ---\n";
        csv += "Account,Code,Debit,Credit,Balance\n";
        data.trial_balance.forEach((b: any) => {
            csv += `"${b.accountName}","${b.accountCode}",${b.debitBalance},${b.creditBalance},${b.debitBalance - b.creditBalance}\n`;
        });

        csv += "\n--- GENERAL LEDGER (SAMPLED) ---\n";
        csv += "Date,Number,Account,Description,Debit,Credit,Fingerprint\n";
        data.general_ledger.slice(0, 1000).forEach((l: any) => {
            csv += `${l.entry?.entry_date},${l.entry?.entry_number},"${l.account?.account_name}",${l.description || l.entry?.description},${l.debit_amount},${l.credit_amount},${l.entry?.fingerprint}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        return URL.createObjectURL(blob);
    }
};
