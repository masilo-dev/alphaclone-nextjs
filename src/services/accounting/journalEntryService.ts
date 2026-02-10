import { supabase } from '../../lib/supabase';
import { tenantService } from '../tenancy/TenantService';

export type JournalStatus = 'draft' | 'posted' | 'void';

export interface JournalEntry {
    id: string;
    tenantId: string;
    entryNumber: string;
    entryDate: string;
    periodId?: string;
    description: string;
    reference?: string;
    sourceType?: string;
    sourceId?: string;
    status: JournalStatus;
    postedAt?: string;
    postedBy?: string;
    voidedAt?: string;
    voidedBy?: string;
    voidReason?: string;
    totalDebits: number;
    totalCredits: number;
    currency: string;
    exchangeRate: number;
    createdAt: string;
    createdBy?: string;
    updatedAt: string;
    updatedBy?: string;
}

export interface JournalEntryLine {
    id: string;
    tenantId: string;
    entryId: string;
    lineNumber: number;
    accountId: string;
    debitAmount: number;
    creditAmount: number;
    description?: string;
    entityType?: string;
    entityId?: string;
    currency: string;
    exchangeRate: number;
    createdAt: string;
}

export interface JournalEntryWithLines extends JournalEntry {
    lines: Array<JournalEntryLine & {
        accountCode?: string;
        accountName?: string;
    }>;
}

export interface CreateJournalEntryInput {
    entryDate: string;
    description: string;
    reference?: string;
    sourceType?: string;
    sourceId?: string;
    currency?: string;
    lines: Array<{
        accountId?: string;
        accountCode?: string; // Alternative to accountId
        debitAmount?: number;
        creditAmount?: number;
        description?: string;
        entityType?: string;
        entityId?: string;
    }>;
}

export const journalEntryService = {
    /**
     * Get tenant ID (required for all operations)
     */
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select an organization.');
        return tenantId;
    },

    /**
     * Get all journal entries
     */
    async getEntries(filters?: {
        status?: JournalStatus;
        startDate?: string;
        endDate?: string;
        sourceType?: string;
        limit?: number;
    }): Promise<{ entries: JournalEntry[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            let query = supabase
                .from('journal_entries')
                .select('*')
                .eq('tenant_id', tenantId);

            if (filters?.status) {
                query = query.eq('status', filters.status);
            }
            if (filters?.startDate) {
                query = query.gte('entry_date', filters.startDate);
            }
            if (filters?.endDate) {
                query = query.lte('entry_date', filters.endDate);
            }
            if (filters?.sourceType) {
                query = query.eq('source_type', filters.sourceType);
            }

            const { data, error } = await query
                .order('entry_date', { ascending: false })
                .order('entry_number', { ascending: false })
                .limit(filters?.limit || 100);

            if (error) throw error;

            const entries = (data || []).map(this.mapEntry);

            return { entries, error: null };
        } catch (err: any) {
            console.error('Error fetching journal entries:', err);
            return { entries: [], error: err.message };
        }
    },

    /**
     * Get single journal entry with lines
     */
    async getEntry(entryId: string): Promise<{ entry: JournalEntryWithLines | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data: entryData, error: entryError } = await supabase
                .from('journal_entries')
                .select('*')
                .eq('id', entryId)
                .eq('tenant_id', tenantId)
                .single();

            if (entryError) throw entryError;
            if (!entryData) return { entry: null, error: null };

            const { data: linesData, error: linesError } = await supabase
                .from('journal_entry_lines')
                .select(`
                    *,
                    account:chart_of_accounts(account_code, account_name)
                `)
                .eq('entry_id', entryId)
                .eq('tenant_id', tenantId)
                .order('line_number', { ascending: true });

            if (linesError) throw linesError;

            const entry: JournalEntryWithLines = {
                ...this.mapEntry(entryData),
                lines: (linesData || []).map((line: any) => ({
                    ...this.mapLine(line),
                    accountCode: line.account?.account_code,
                    accountName: line.account?.account_name,
                })),
            };

            return { entry, error: null };
        } catch (err: any) {
            console.error('Error fetching journal entry:', err);
            return { entry: null, error: err.message };
        }
    },

    /**
     * Create new journal entry
     * Entry is created in draft status
     */
    async createEntry(input: CreateJournalEntryInput): Promise<{ entry: JournalEntryWithLines | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();

            // Validate lines
            if (!input.lines || input.lines.length === 0) {
                return { entry: null, error: 'At least one line is required' };
            }

            // Calculate totals
            let totalDebits = 0;
            let totalCredits = 0;

            for (const line of input.lines) {
                totalDebits += line.debitAmount || 0;
                totalCredits += line.creditAmount || 0;

                // Validate line
                const hasDebit = (line.debitAmount || 0) > 0;
                const hasCredit = (line.creditAmount || 0) > 0;

                if (hasDebit && hasCredit) {
                    return { entry: null, error: 'Line cannot have both debit and credit amounts' };
                }

                if (!hasDebit && !hasCredit) {
                    return { entry: null, error: 'Line must have either debit or credit amount' };
                }
            }

            // Validate balanced entry
            if (Math.abs(totalDebits - totalCredits) > 0.01) {
                return {
                    entry: null,
                    error: `Entry not balanced: debits=${totalDebits.toFixed(2)}, credits=${totalCredits.toFixed(2)}`,
                };
            }

            // Generate entry number
            const { data: entryNumber, error: numberError } = await supabase.rpc('generate_entry_number', {
                p_tenant_id: tenantId,
            });

            if (numberError) throw numberError;

            // Find current period
            const { data: period } = await supabase
                .from('accounting_periods')
                .select('id')
                .eq('tenant_id', tenantId)
                .lte('start_date', input.entryDate)
                .gte('end_date', input.entryDate)
                .eq('status', 'open')
                .single();

            // Create entry header
            const { data: entryData, error: entryError } = await supabase
                .from('journal_entries')
                .insert({
                    tenant_id: tenantId,
                    entry_number: entryNumber,
                    entry_date: input.entryDate,
                    period_id: period?.id,
                    description: input.description,
                    reference: input.reference,
                    source_type: input.sourceType,
                    source_id: input.sourceId,
                    status: 'draft',
                    total_debits: totalDebits,
                    total_credits: totalCredits,
                    currency: input.currency || 'USD',
                    created_by: userData.user?.id,
                })
                .select()
                .single();

            if (entryError) throw entryError;

            // Resolve account IDs from codes if needed
            const resolvedLines = await Promise.all(
                input.lines.map(async (line, index) => {
                    let accountId = line.accountId;

                    if (!accountId && line.accountCode) {
                        const { data: account } = await supabase
                            .from('chart_of_accounts')
                            .select('id')
                            .eq('tenant_id', tenantId)
                            .eq('account_code', line.accountCode)
                            .single();

                        accountId = account?.id;
                    }

                    if (!accountId) {
                        throw new Error(`Account not found for line ${index + 1}`);
                    }

                    return { ...line, accountId };
                })
            );

            // Create entry lines
            const { data: linesData, error: linesError } = await supabase
                .from('journal_entry_lines')
                .insert(
                    resolvedLines.map((line, index) => ({
                        tenant_id: tenantId,
                        entry_id: entryData.id,
                        line_number: index + 1,
                        account_id: line.accountId,
                        debit_amount: line.debitAmount || 0,
                        credit_amount: line.creditAmount || 0,
                        description: line.description,
                        entity_type: line.entityType,
                        entity_id: line.entityId,
                        currency: input.currency || 'USD',
                    }))
                )
                .select(`
                    *,
                    account:chart_of_accounts(account_code, account_name)
                `)
                .order('line_number', { ascending: true });

            if (linesError) throw linesError;

            const entry: JournalEntryWithLines = {
                ...this.mapEntry(entryData),
                lines: (linesData || []).map((line: any) => ({
                    ...this.mapLine(line),
                    accountCode: line.account?.account_code,
                    accountName: line.account?.account_name,
                })),
            };

            return { entry, error: null };
        } catch (err: any) {
            console.error('Error creating journal entry:', err);
            return { entry: null, error: err.message };
        }
    },

    /**
     * Post journal entry
     * - Validates balanced entry
     * - Updates account balances
     * - Marks as posted
     */
    async postEntry(entryId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { data: userData } = await supabase.auth.getUser();

            const { data, error } = await supabase.rpc('post_journal_entry', {
                p_entry_id: entryId,
                p_posted_by: userData.user?.id,
            });

            if (error) throw error;

            return { success: data, error: null };
        } catch (err: any) {
            console.error('Error posting journal entry:', err);
            return { success: false, error: err.message };
        }
    },

    /**
     * Void journal entry
     * - Creates reversing entry
     * - Marks original as void
     */
    async voidEntry(entryId: string, reason: string): Promise<{ reversingEntryId: string | null; error: string | null }> {
        try {
            const { data: userData } = await supabase.auth.getUser();

            const { data, error } = await supabase.rpc('void_journal_entry', {
                p_entry_id: entryId,
                p_voided_by: userData.user?.id,
                p_reason: reason,
            });

            if (error) throw error;

            return { reversingEntryId: data, error: null };
        } catch (err: any) {
            console.error('Error voiding journal entry:', err);
            return { reversingEntryId: null, error: err.message };
        }
    },

    /**
     * Delete draft entry
     * Only draft entries can be deleted
     */
    async deleteEntry(entryId: string): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            // Check status
            const { data: entry } = await supabase
                .from('journal_entries')
                .select('status')
                .eq('id', entryId)
                .eq('tenant_id', tenantId)
                .single();

            if (entry?.status !== 'draft') {
                return { error: 'Only draft entries can be deleted. Use void for posted entries.' };
            }

            // Delete lines first (cascade will handle this, but explicit is clearer)
            await supabase
                .from('journal_entry_lines')
                .delete()
                .eq('entry_id', entryId)
                .eq('tenant_id', tenantId);

            // Delete entry
            const { error } = await supabase
                .from('journal_entries')
                .delete()
                .eq('id', entryId)
                .eq('tenant_id', tenantId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error deleting journal entry:', err);
            return { error: err.message };
        }
    },

    /**
     * Create simple two-line journal entry (common case)
     */
    async createSimpleEntry(
        entryDate: string,
        description: string,
        debitAccountId: string,
        creditAccountId: string,
        amount: number,
        reference?: string,
        sourceType?: string,
        sourceId?: string
    ): Promise<{ entry: JournalEntryWithLines | null; error: string | null }> {
        return this.createEntry({
            entryDate,
            description,
            reference,
            sourceType,
            sourceId,
            lines: [
                {
                    accountId: debitAccountId,
                    debitAmount: amount,
                    creditAmount: 0,
                    description,
                },
                {
                    accountId: creditAccountId,
                    debitAmount: 0,
                    creditAmount: amount,
                    description,
                },
            ],
        });
    },

    /**
     * Map database record to JournalEntry interface
     */
    mapEntry(data: any): JournalEntry {
        return {
            id: data.id,
            tenantId: data.tenant_id,
            entryNumber: data.entry_number,
            entryDate: data.entry_date,
            periodId: data.period_id,
            description: data.description,
            reference: data.reference,
            sourceType: data.source_type,
            sourceId: data.source_id,
            status: data.status,
            postedAt: data.posted_at,
            postedBy: data.posted_by,
            voidedAt: data.voided_at,
            voidedBy: data.voided_by,
            voidReason: data.void_reason,
            totalDebits: parseFloat(data.total_debits || '0'),
            totalCredits: parseFloat(data.total_credits || '0'),
            currency: data.currency,
            exchangeRate: parseFloat(data.exchange_rate || '1'),
            createdAt: data.created_at,
            createdBy: data.created_by,
            updatedAt: data.updated_at,
            updatedBy: data.updated_by,
        };
    },

    /**
     * Map database record to JournalEntryLine interface
     */
    mapLine(data: any): JournalEntryLine {
        return {
            id: data.id,
            tenantId: data.tenant_id,
            entryId: data.entry_id,
            lineNumber: data.line_number,
            accountId: data.account_id,
            debitAmount: parseFloat(data.debit_amount || '0'),
            creditAmount: parseFloat(data.credit_amount || '0'),
            description: data.description,
            entityType: data.entity_type,
            entityId: data.entity_id,
            currency: data.currency,
            exchangeRate: parseFloat(data.exchange_rate || '1'),
            createdAt: data.created_at,
        };
    },
};
