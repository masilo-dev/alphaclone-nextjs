import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
    sendPlatformTemplateEmail,
    SYSTEM_PLATFORM_TEMPLATES,
    defaultDashboardUrl,
} from '@/lib/email/platformTemplateEmail';

type ProfileDigestRow = {
    id: string;
    email: string;
    name: string;
    email_preferences: Record<string, unknown> | null;
    last_digest_sent_at: string | null;
};

/**
 * Sends Daily Summary to opted-in users (cron). Uses service role.
 */
export async function runUserDigestEmails(): Promise<{
    attempted: number;
    sent: number;
    failed: number;
}> {
    const admin = createSupabaseAdminClient();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: rows, error } = await admin
        .from('profiles')
        .select('id, email, name, email_preferences, last_digest_sent_at')
        .not('email', 'is', null);

    if (error || !rows?.length) {
        console.error('[runUserDigestEmails] load profiles:', error);
        return { attempted: 0, sent: 0, failed: 0 };
    }

    const dashboardUrl = defaultDashboardUrl();
    const summaryDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    let sent = 0;
    let failed = 0;
    let attempted = 0;

    for (const raw of rows as ProfileDigestRow[]) {
        const prefs = raw.email_preferences ?? {};
        const digestOff =
            prefs.digest === false ||
            String(prefs.digest).toLowerCase() === 'false';
        if (digestOff) continue;

        const last = raw.last_digest_sent_at
            ? new Date(raw.last_digest_sent_at)
            : null;
        if (last && last > yesterday) continue;

        attempted += 1;
        if (attempted > 500) break;

        const result = await sendPlatformTemplateEmail(admin, {
            templateName: 'Daily Summary',
            to: raw.email,
            variables: {
                name: raw.name || raw.email.split('@')[0] || 'there',
                email: raw.email,
                dashboardUrl,
                summaryDate,
            },
            credentialUserId: raw.id,
            templateAllowlist: SYSTEM_PLATFORM_TEMPLATES,
            skipIfWelcomeAlreadySent: false,
            authUserId: null,
        });

        if (result.success) {
            sent += 1;
            await admin
                .from('profiles')
                .update({ last_digest_sent_at: new Date().toISOString() })
                .eq('id', raw.id);
        } else {
            failed += 1;
            console.warn('[runUserDigestEmails] skip', raw.email, result.error);
        }
    }

    return { attempted, sent, failed };
}
