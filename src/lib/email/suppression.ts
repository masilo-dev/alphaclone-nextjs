import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function isEmailSuppressed(tenantId: string, email: string): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!tenantId || !normalizedEmail) return false;

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
        .from('email_suppressions')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('email', normalizedEmail)
        .maybeSingle();

    if (error) {
        console.error('[email/suppression] lookup failed:', error);
        return false;
    }

    return Boolean(data?.id);
}

export async function upsertSuppression(args: {
    tenantId: string;
    email: string;
    reason: 'bounce' | 'spam_report' | 'unsubscribe' | 'manual';
    provider?: string;
    eventId?: string;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    const normalizedEmail = args.email.trim().toLowerCase();
    if (!args.tenantId || !normalizedEmail) return;

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from('email_suppressions').upsert(
        {
            tenant_id: args.tenantId,
            email: normalizedEmail,
            reason: args.reason,
            source_provider: args.provider ?? null,
            source_event_id: args.eventId ?? null,
            metadata: args.metadata ?? {},
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,email' }
    );

    if (error) {
        console.error('[email/suppression] upsert failed:', error);
    }
}

export async function syncSuppressionCleanup(args: {
    tenantId: string;
    email: string;
    reason: 'bounce' | 'spam_report' | 'unsubscribe' | 'manual';
    provider?: string;
    eventId?: string;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    const normalizedEmail = args.email.trim().toLowerCase();
    if (!args.tenantId || !normalizedEmail) return;

    await upsertSuppression(args);

    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const normalizedStatus = args.reason === 'unsubscribe' ? 'unsubscribed' : 'bounced';
    const normalizedReason = args.reason === 'unsubscribe'
        ? 'Recipient unsubscribed.'
        : 'Recipient email bounced.';

    const [contactResult, outreachResult] = await Promise.all([
        admin
            .from('contacts')
            .update({
                status: normalizedStatus,
                updated_at: now,
            })
            .eq('tenant_id', args.tenantId)
            .ilike('email', normalizedEmail),
        admin
            .from('lead_outreach_log')
            .update({
                status: normalizedStatus,
                provider_event_status: normalizedStatus,
                provider_last_event_at: now,
                error_message: normalizedReason,
            })
            .eq('tenant_id', args.tenantId)
            .ilike('lead_email', normalizedEmail),
    ]);

    if (contactResult.error) {
        console.error('[email/suppression] contact cleanup failed:', contactResult.error);
    }
    if (outreachResult.error) {
        console.error('[email/suppression] outreach cleanup failed:', outreachResult.error);
    }
}
