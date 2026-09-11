import { supabase } from '@/lib/supabase';
import { tenantService } from '@/services/tenancy/TenantService';

export type InboxStatus = 'new' | 'read' | 'replied';

export type InboxSource = 'contact' | 'form';

export interface InboxSubmission {
    id: string;
    name: string;
    email: string;
    message: string;
    status: InboxStatus;
    date: string;
    source: InboxSource;
    formSlug?: string | null;
    formTitle?: string | null;
}

function normalizeStatus(value: unknown): InboxStatus {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'read') return 'read';
    if (raw === 'replied') return 'replied';
    return 'new';
}

function deriveMessage(data: Record<string, any>): string {
    const candidates = [
        data.message,
        data.notes,
        data.details,
        data.body,
    ];
    for (const candidate of candidates) {
        const val = String(candidate || '').trim();
        if (val) return val;
    }
    try {
        return JSON.stringify(data, null, 2);
    } catch {
        return String(data || '');
    }
}

export const inboxService = {
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select a workspace.');
        return tenantId;
    },

    async getInbox(): Promise<{ submissions: InboxSubmission[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const [contactResult, formResult] = await Promise.all([
                supabase
                    .from('contact_submissions')
                    .select('id, name, email, message, status, created_at')
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('form_submissions')
                    .select('id, submitter_name, submitter_email, data, status, created_at, tenant_forms (slug, title)')
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false }),
            ]);

            if (contactResult.error) {
                return { submissions: [], error: contactResult.error.message };
            }
            if (formResult.error) {
                return { submissions: [], error: formResult.error.message };
            }

            const contactRows = (contactResult.data || []) as any[];
            const formRows = (formResult.data || []) as any[];

            const contactSubmissions: InboxSubmission[] = contactRows.map((row) => ({
                id: row.id,
                name: row.name || 'Contact',
                email: row.email || '',
                message: row.message || '',
                status: normalizeStatus(row.status),
                date: row.created_at,
                source: 'contact',
                formSlug: null,
                formTitle: null,
            }));

            const formSubmissions: InboxSubmission[] = formRows.map((row) => ({
                id: row.id,
                name: row.submitter_name || 'Form lead',
                email: row.submitter_email || '',
                message: deriveMessage((row.data || {}) as Record<string, any>),
                status: normalizeStatus(row.status),
                date: row.created_at,
                source: 'form',
                formSlug: row.tenant_forms?.slug ?? null,
                formTitle: row.tenant_forms?.title ?? null,
            }));

            const combined = [...contactSubmissions, ...formSubmissions].sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            return { submissions: combined, error: null };
        } catch (err) {
            return { submissions: [], error: err instanceof Error ? err.message : 'Failed to load inbox' };
        }
    },

    async updateStatus(
        id: string,
        source: InboxSource,
        status: InboxStatus
    ): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            if (source === 'contact') {
                const { error } = await supabase
                    .from('contact_submissions')
                    .update({ status })
                    .eq('id', id)
                    .eq('tenant_id', tenantId);
                return { error: error ? error.message : null };
            }

            const { error } = await supabase
                .from('form_submissions')
                .update({ status })
                .eq('id', id)
                .eq('tenant_id', tenantId);
            return { error: error ? error.message : null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to update status' };
        }
    },
};

