import { supabase } from '../../lib/supabase';

/**
 * GDPR Data Erasure Service
 * Implements "Right to be Forgotten" (GDPR Article 17)
 */

export interface ErasureResult {
    success: boolean;
    userId: string;
    erasedTables: string[];
    anonymizedTables: string[];
    retainedTables: string[]; // Legal requirements
    erasedAt: string;
    error?: string;
}

export const dataErasureService = {
    /**
     * Complete user data erasure
     * GDPR Article 17: Right to erasure ("right to be forgotten")
     *
     * Note: Some data must be retained for legal/financial reasons
     * - Financial records (7 years)
     * - Contracts (10 years)
     * - Audit logs (7 years)
     *
     * For retained data, we anonymize PII instead of deleting
     */
    async eraseUserData(userId: string, reason: string): Promise<ErasureResult> {
        try {
            const erasedTables: string[] = [];
            const anonymizedTables: string[] = [];
            const retainedTables: string[] = [];

            // Log erasure request BEFORE deletion
            await this.logErasureRequest(userId, reason);

            // 1. DELETE: Profile data (no legal retention needed)
            await supabase.from('profiles').delete().eq('id', userId);
            erasedTables.push('profiles');

            // 2. DELETE: User preferences
            await supabase.from('notification_preferences').delete().eq('user_id', userId);
            erasedTables.push('notification_preferences');

            // 3. DELETE: Calendar events (unless shared)
            await supabase.from('calendar_events').delete().eq('user_id', userId).is('parent_event_id', null);
            erasedTables.push('calendar_events');

            // 4. DELETE: Calendar sync tokens
            await supabase.from('calendar_sync_tokens').delete().eq('user_id', userId);
            erasedTables.push('calendar_sync_tokens');

            // 5. DELETE: Notifications
            await supabase.from('notification_queue').delete().eq('user_id', userId);
            erasedTables.push('notification_queue');

            // 6. DELETE: User consents (can be deleted after processing)
            await supabase.from('user_consents').delete().eq('user_id', userId);
            erasedTables.push('user_consents');

            // 7. DELETE: Upload prompts tracking
            await supabase.from('upgrade_prompts').delete().eq('user_id', userId);
            erasedTables.push('upgrade_prompts');

            // 8. DELETE: Documents (soft delete - mark as deleted)
            await supabase.from('documents')
                .update({
                    created_by: null,
                    updated_by: null,
                    is_deleted: true
                })
                .eq('created_by', userId);
            erasedTables.push('documents');

            // 9. DELETE: Tasks (unassign user)
            await supabase.from('tasks')
                .update({ assigned_to: null })
                .eq('assigned_to', userId);
            erasedTables.push('tasks');

            // 10. ANONYMIZE: Contracts (must retain for legal reasons)
            // Replace PII with anonymized identifiers
            await supabase.from('contracts')
                .update({
                    client_id: null,
                    client_email: '[REDACTED]',
                    client_name: '[REDACTED - User Deleted]',
                })
                .eq('client_id', userId);
            anonymizedTables.push('contracts');
            retainedTables.push('contracts (anonymized)');

            // 11. ANONYMIZE: Invoices (must retain for tax/legal - 7 years)
            await supabase.from('invoices')
                .update({
                    client_email: '[REDACTED]',
                    client_name: '[REDACTED - User Deleted]',
                })
                .eq('client_id', userId);
            anonymizedTables.push('invoices');
            retainedTables.push('invoices (anonymized)');

            // 12. ANONYMIZE: Audit logs (must retain for compliance - 7 years)
            await supabase.from('audit_logs')
                .update({
                    user_id: null,
                    metadata: { anonymized: true, reason: 'GDPR erasure' }
                })
                .eq('user_id', userId);
            anonymizedTables.push('audit_logs');
            retainedTables.push('audit_logs (anonymized)');

            // 13. ANONYMIZE: Conversion events (business analytics)
            await supabase.from('conversion_events')
                .update({ user_id: null })
                .eq('user_id', userId);
            anonymizedTables.push('conversion_events');

            // 14. DELETE: Tenant memberships (remove user from tenants)
            await supabase.from('tenant_users').delete().eq('user_id', userId);
            erasedTables.push('tenant_users');

            // 15. DELETE: Department memberships
            await supabase.from('department_members').delete().eq('user_id', userId);
            erasedTables.push('department_members');

            // 16. DELETE: Session tokens (Auth)
            await supabase.from('sessions').delete().eq('user_id', userId);
            erasedTables.push('sessions');

            // 17. DELETE: Auth user account (final step)
            await supabase.auth.admin.deleteUser(userId);
            erasedTables.push('auth.users');

            return {
                success: true,
                userId,
                erasedTables,
                anonymizedTables,
                retainedTables,
                erasedAt: new Date().toISOString(),
            };
        } catch (error) {
            console.error('Error erasing user data:', error);
            return {
                success: false,
                userId,
                erasedTables: [],
                anonymizedTables: [],
                retainedTables: [],
                erasedAt: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    },

    /**
     * Soft delete - mark account as deleted but retain data for legal period
     */
    async softDeleteUser(userId: string, reason: string): Promise<void> {
        await supabase.from('profiles').update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deletion_reason: reason,
        }).eq('id', userId);

        // Disable auth account
        await supabase.auth.admin.updateUserById(userId, {
            ban_duration: '876000h', // 100 years
        });

        await this.logErasureRequest(userId, `soft_delete: ${reason}`);
    },

    /**
     * Log erasure request for compliance
     */
    async logErasureRequest(userId: string, reason: string): Promise<void> {
        try {
            await supabase.from('data_processing_logs').insert({
                user_id: userId,
                action: 'delete',
                requested_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                status: 'completed',
                metadata: { reason },
            });
        } catch (error) {
            console.error('Error logging erasure request:', error);
        }
    },

    /**
     * Check if user can be deleted (not in active contracts, etc.)
     */
    async canDeleteUser(userId: string): Promise<{ canDelete: boolean; reasons: string[] }> {
        const reasons: string[] = [];

        // Check for active subscriptions
        const { data: activeSubs } = await supabase
            .from('tenant_subscriptions')
            .select('*, tenants!inner(id)')
            .eq('tenants.owner_id', userId)
            .eq('status', 'active');

        if (activeSubs && activeSubs.length > 0) {
            reasons.push('User owns tenants with active subscriptions. Cancel subscriptions first.');
        }

        // Check for unsigned contracts
        const { data: pendingContracts } = await supabase
            .from('contracts')
            .select('id')
            .or(`client_id.eq.${userId},created_by.eq.${userId}`)
            .eq('status', 'pending');

        if (pendingContracts && pendingContracts.length > 0) {
            reasons.push(`User has ${pendingContracts.length} pending contract(s). Complete or cancel them first.`);
        }

        // Check for unpaid invoices
        const { data: unpaidInvoices } = await supabase
            .from('invoices')
            .select('id')
            .eq('client_id', userId)
            .in('status', ['Pending', 'Overdue']);

        if (unpaidInvoices && unpaidInvoices.length > 0) {
            reasons.push(`User has ${unpaidInvoices.length} unpaid invoice(s). Settle them first.`);
        }

        return {
            canDelete: reasons.length === 0,
            reasons,
        };
    },

    /**
     * Get data retention policy info
     */
    getRetentionPolicy(): {
        category: string;
        retention: string;
        reason: string;
    }[] {
        return [
            {
                category: 'Financial Records (Invoices, Payments)',
                retention: '7 years',
                reason: 'Tax law compliance (IRS, HMRC)',
            },
            {
                category: 'Contracts & Agreements',
                retention: '10 years',
                reason: 'Legal statute of limitations',
            },
            {
                category: 'Audit Logs',
                retention: '7 years',
                reason: 'Security & compliance requirements',
            },
            {
                category: 'Profile & Preferences',
                retention: 'Immediate deletion',
                reason: 'No legal retention required',
            },
            {
                category: 'Communications (Emails, Notifications)',
                retention: 'Immediate deletion',
                reason: 'No legal retention required',
            },
        ];
    },
};
