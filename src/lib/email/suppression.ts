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
