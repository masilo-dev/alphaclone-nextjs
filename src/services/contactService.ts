import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface ContactSubmission {
    id: string;
    name: string;
    email: string;
    message: string;
    status: 'New' | 'Read' | 'Replied';
    date: string;
}

export const contactService = {
    /**
     * Get tenant ID (required for all operations)
     */
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select an organization.');
        return tenantId;
    },

    /**
     * Submit contact form
     */
    async submitContact(
        name: string,
        email: string,
        message: string
    ): Promise<{ success: boolean; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            // Save to Supabase
            const { error: dbError } = await supabase
                .from('contact_submissions')
                .insert({
                    tenant_id: tenantId, // ← ASSIGN TO TENANT
                    name,
                    email,
                    message,
                    status: 'New',
                })
                .select()
                .single();

            if (dbError) {
                return { success: false, error: dbError.message };
            }

            // Email notification and admin notification are handled by database triggers

            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get all contact submissions (admin only)
     */
    async getContactSubmissions(): Promise<{ submissions: ContactSubmission[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('contact_submissions')
                .select('*')
                .eq('tenant_id', tenantId) // ← TENANT FILTER
                .order('created_at', { ascending: false });

            if (error) {
                return { submissions: [], error: error.message };
            }

            const submissions: ContactSubmission[] = (data || []).map((s) => ({
                id: s.id,
                name: s.name,
                email: s.email,
                message: s.message,
                status: s.status,
                date: s.created_at,
            }));

            return { submissions, error: null };
        } catch (err) {
            return { submissions: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update contact submission status
     */
    async updateSubmissionStatus(
        submissionId: string,
        status: 'New' | 'Read' | 'Replied'
    ): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { error } = await supabase
                .from('contact_submissions')
                .update({ status })
                .eq('id', submissionId)
                .eq('tenant_id', tenantId); // ← VERIFY OWNERSHIP

            return { error: error ? error.message : null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },
};
