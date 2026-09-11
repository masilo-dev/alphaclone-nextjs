import { supabase } from '../../lib/supabase';
import { tenantService } from '../tenancy/TenantService';

export type PeriodStatus = 'open' | 'closed' | 'locked';

export interface AccountingPeriod {
    id: string;
    tenantId: string;
    periodName: string;
    fiscalYear: number;
    periodNumber: number;
    startDate: string;
    endDate: string;
    status: PeriodStatus;
    closedAt?: string;
    closedBy?: string;
    lockedAt?: string;
    lockedBy?: string;
    createdAt: string;
    createdBy?: string;
}

export const accountingPeriodService = {
    /**
     * Get tenant ID (required for all operations)
     */
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select an organization.');
        return tenantId;
    },

    /**
     * Get all accounting periods
     */
    async getPeriods(filters?: {
        fiscalYear?: number;
        status?: PeriodStatus;
    }): Promise<{ periods: AccountingPeriod[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            let query = supabase
                .from('accounting_periods')
                .select('*')
                .eq('tenant_id', tenantId);

            if (filters?.fiscalYear) {
                query = query.eq('fiscal_year', filters.fiscalYear);
            }
            if (filters?.status) {
                query = query.eq('status', filters.status);
            }

            const { data, error } = await query.order('fiscal_year', { ascending: false }).order('period_number', { ascending: true });

            if (error) throw error;

            const periods = (data || []).map(this.mapPeriod);

            return { periods, error: null };
        } catch (err: any) {
            console.error('Error fetching accounting periods:', err);
            return { periods: [], error: err.message };
        }
    },

    /**
     * Get single period by ID
     */
    async getPeriod(periodId: string): Promise<{ period: AccountingPeriod | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('accounting_periods')
                .select('*')
                .eq('id', periodId)
                .eq('tenant_id', tenantId)
                .single();

            if (error) throw error;

            return { period: data ? this.mapPeriod(data) : null, error: null };
        } catch (err: any) {
            console.error('Error fetching period:', err);
            return { period: null, error: err.message };
        }
    },

    /**
     * Get current open period
     */
    async getCurrentPeriod(): Promise<{ period: AccountingPeriod | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const today = new Date().toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('accounting_periods')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('status', 'open')
                .lte('start_date', today)
                .gte('end_date', today)
                .single();

            if (error) {
                // If no current period found, that's not an error
                if (error.code === 'PGRST116') {
                    return { period: null, error: null };
                }
                throw error;
            }

            return { period: data ? this.mapPeriod(data) : null, error: null };
        } catch (err: any) {
            console.error('Error fetching current period:', err);
            return { period: null, error: err.message };
        }
    },

    /**
     * Create accounting period
     */
    async createPeriod(period: {
        periodName: string;
        fiscalYear: number;
        periodNumber: number;
        startDate: string;
        endDate: string;
    }): Promise<{ period: AccountingPeriod | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();

            // Validate dates
            if (new Date(period.endDate) <= new Date(period.startDate)) {
                return { period: null, error: 'End date must be after start date' };
            }

            const { data, error } = await supabase
                .from('accounting_periods')
                .insert({
                    tenant_id: tenantId,
                    period_name: period.periodName,
                    fiscal_year: period.fiscalYear,
                    period_number: period.periodNumber,
                    start_date: period.startDate,
                    end_date: period.endDate,
                    status: 'open',
                    created_by: userData.user?.id,
                })
                .select()
                .single();

            if (error) throw error;

            return { period: this.mapPeriod(data), error: null };
        } catch (err: any) {
            console.error('Error creating period:', err);
            return { period: null, error: err.message };
        }
    },

    /**
     * Initialize periods for a fiscal year
     * Creates 12 monthly periods
     */
    async initializeFiscalYear(fiscalYear: number): Promise<{ periods: AccountingPeriod[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();

            const periods = [];
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];

            for (let month = 0; month < 12; month++) {
                const startDate = new Date(fiscalYear, month, 1);
                const endDate = new Date(fiscalYear, month + 1, 0); // Last day of month

                periods.push({
                    tenant_id: tenantId,
                    period_name: `${monthNames[month]} ${fiscalYear}`,
                    fiscal_year: fiscalYear,
                    period_number: month + 1,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0],
                    status: 'open',
                    created_by: userData.user?.id,
                });
            }

            const { data, error } = await supabase
                .from('accounting_periods')
                .insert(periods)
                .select();

            if (error) throw error;

            const createdPeriods = (data || []).map(this.mapPeriod);

            return { periods: createdPeriods, error: null };
        } catch (err: any) {
            console.error('Error initializing fiscal year:', err);
            return { periods: [], error: err.message };
        }
    },

    /**
     * Close accounting period
     * Prevents new entries in the period
     */
    async closePeriod(periodId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();

            // Check if period exists and is open
            const { data: period } = await supabase
                .from('accounting_periods')
                .select('status')
                .eq('id', periodId)
                .eq('tenant_id', tenantId)
                .single();

            if (!period) {
                return { success: false, error: 'Period not found' };
            }

            if (period.status !== 'open') {
                return { success: false, error: `Period is already ${period.status}` };
            }

            // Close period
            const { error } = await supabase
                .from('accounting_periods')
                .update({
                    status: 'closed',
                    closed_at: new Date().toISOString(),
                    closed_by: userData.user?.id,
                })
                .eq('id', periodId)
                .eq('tenant_id', tenantId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error closing period:', err);
            return { success: false, error: err.message };
        }
    },

    /**
     * Lock accounting period
     * Prevents any modifications (even voids)
     */
    async lockPeriod(periodId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();

            // Check if period exists and is closed
            const { data: period } = await supabase
                .from('accounting_periods')
                .select('status')
                .eq('id', periodId)
                .eq('tenant_id', tenantId)
                .single();

            if (!period) {
                return { success: false, error: 'Period not found' };
            }

            if (period.status !== 'closed') {
                return { success: false, error: 'Period must be closed before locking' };
            }

            // Lock period
            const { error } = await supabase
                .from('accounting_periods')
                .update({
                    status: 'locked',
                    locked_at: new Date().toISOString(),
                    locked_by: userData.user?.id,
                })
                .eq('id', periodId)
                .eq('tenant_id', tenantId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error locking period:', err);
            return { success: false, error: err.message };
        }
    },

    /**
     * Reopen accounting period
     * Only allowed for closed periods, not locked
     */
    async reopenPeriod(periodId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            // Check if period exists and is closed
            const { data: period } = await supabase
                .from('accounting_periods')
                .select('status')
                .eq('id', periodId)
                .eq('tenant_id', tenantId)
                .single();

            if (!period) {
                return { success: false, error: 'Period not found' };
            }

            if (period.status === 'locked') {
                return { success: false, error: 'Cannot reopen locked period' };
            }

            if (period.status === 'open') {
                return { success: false, error: 'Period is already open' };
            }

            // Reopen period
            const { error } = await supabase
                .from('accounting_periods')
                .update({
                    status: 'open',
                    closed_at: null,
                    closed_by: null,
                })
                .eq('id', periodId)
                .eq('tenant_id', tenantId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error reopening period:', err);
            return { success: false, error: err.message };
        }
    },

    /**
     * Map database record to AccountingPeriod interface
     */
    mapPeriod(data: any): AccountingPeriod {
        return {
            id: data.id,
            tenantId: data.tenant_id,
            periodName: data.period_name,
            fiscalYear: data.fiscal_year,
            periodNumber: data.period_number,
            startDate: data.start_date,
            endDate: data.end_date,
            status: data.status,
            closedAt: data.closed_at,
            closedBy: data.closed_by,
            lockedAt: data.locked_at,
            lockedBy: data.locked_by,
            createdAt: data.created_at,
            createdBy: data.created_by,
        };
    },
};
