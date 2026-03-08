import { supabase } from '../../lib/supabase';
import { tenantService } from '../tenancy/TenantService';
import { notificationService } from '../notificationService';
import { generalLedgerService } from './generalLedgerService';

export interface FinancialReportJob {
    id: string;
    reportType: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    parameters: any;
    fileUrl?: string;
    error?: string;
    created_at: string;
    completed_at?: string;
}

export const financialReportService = {
    /**
     * Start a background report generation job
     */
    async startReportJob(type: string, params: any): Promise<{ id: string | null; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('No active tenant');

            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;

            const { data, error } = await supabase
                .from('financial_reports')
                .insert({
                    tenant_id: tenantId,
                    user_id: userId,
                    report_type: type,
                    parameters: params,
                    status: 'pending'
                })
                .select()
                .single();

            if (error) throw error;

            // Trigger "async" generation
            this.processReportJob(data.id, type, params, userId);

            return { id: data.id, error: null };
        } catch (error: any) {
            console.error('Start Report Job Error:', error);
            return { id: null, error: error.message };
        }
    },

    /**
     * Internal: Simulate background processing
     * In production, this would be handled by a worker/edge function
     */
    async processReportJob(jobId: string, type: string, params: any, userId?: string) {
        try {
            // Update status to processing
            await supabase.from('financial_reports').update({ status: 'processing' }).eq('id', jobId);

            // Simulate heavy processing (as requested)
            // 5 second delay to show the user it's happening in background
            await new Promise(resolve => setTimeout(resolve, 5000));

            let result: any;
            if (type === 'pnl') {
                result = await generalLedgerService.getProfitLossData(params.startDate, params.endDate);
            } else if (type === 'balance_sheet') {
                result = await generalLedgerService.getBalanceSheetData(params.asOfDate);
            }

            // check for error in result
            if (result?.error) throw new Error(result.error);

            // In a real app, generate PDF and upload to storage here
            const dummyFileUrl = `https://placeholder.com/reports/${jobId}.pdf`;

            await supabase.from('financial_reports').update({
                status: 'completed',
                file_url: dummyFileUrl,
                completed_at: new Date().toISOString()
            }).eq('id', jobId);

            // Notify User
            if (userId) {
                await notificationService.sendNotification({
                    userId,
                    type: 'system',
                    title: 'Report Ready',
                    message: `Your ${type.toUpperCase()} report is ready for download.`,
                    link: `/dashboard/accounting/reports/${jobId}`
                });
            }
        } catch (error: any) {
            console.error('Process Report Job Error:', error);
            await supabase.from('financial_reports').update({
                status: 'failed',
                error: error.message,
                completed_at: new Date().toISOString()
            }).eq('id', jobId);
        }
    },

    async getJobStatus(jobId: string): Promise<{ job: FinancialReportJob | null; error: string | null }> {
        const { data, error } = await supabase
            .from('financial_reports')
            .select('*')
            .eq('id', jobId)
            .single();

        return {
            job: data ? {
                id: data.id,
                reportType: data.report_type,
                status: data.status,
                parameters: data.parameters,
                fileUrl: data.file_url,
                error: data.error,
                created_at: data.created_at,
                completed_at: data.completed_at
            } : null,
            error: error?.message || null
        };
    }
};
