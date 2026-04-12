import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
    sendPlatformTemplateEmail,
    SYSTEM_PLATFORM_TEMPLATES,
    defaultDashboardUrl,
} from '@/lib/email/platformTemplateEmail';
import { describeMissingVersusHigherPlans, pricingUpgradeUrl } from '@/config/aiLeadQuotas';
import { getAiLeadQuotaStatus } from '@/lib/quotas/aiLeadGenerationQuota';

type ProfileRow = {
    id: string;
    email: string;
    name: string;
    email_preferences: Record<string, unknown> | null;
    last_morning_bundle_sent_at: string | null;
};

function utcDayString(d: Date): string {
    return d.toISOString().split('T')[0];
}

function wantsMorningBundle(prefs: Record<string, unknown> | null): {
    briefing: boolean;
    aiStatus: boolean;
} {
    const p = prefs ?? {};
    return {
        briefing: p.morning_briefing !== false && p.morning_briefing_email !== false,
        aiStatus: p.morning_ai_status !== false && p.morning_ai_usage_email !== false,
    };
}

/**
 * Sends up to two morning emails: priorities / improvements, then AI lead quota vs plan.
 * One send per UTC calendar day per profile (tracked on last_morning_bundle_sent_at).
 */
export async function runMorningBriefingEmails(): Promise<{
    profilesAttempted: number;
    emailsSent: number;
    failed: number;
}> {
    const admin = createSupabaseAdminClient();
    const today = utcDayString(new Date());

    const { data: rows, error } = await admin
        .from('profiles')
        .select('id, email, name, email_preferences, last_morning_bundle_sent_at')
        .not('email', 'is', null);

    if (error || !rows?.length) {
        console.error('[morningBriefing] load profiles:', error);
        return { profilesAttempted: 0, emailsSent: 0, failed: 0 };
    }

    const dashboardUrl = defaultDashboardUrl();
    const upgradeUrl = pricingUpgradeUrl();
    const summaryDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    let emailsSent = 0;
    let failed = 0;
    let profilesAttempted = 0;

    for (const raw of rows as ProfileRow[]) {
        const prefs = wantsMorningBundle(raw.email_preferences);
        if (!prefs.briefing && !prefs.aiStatus) continue;

        const last = raw.last_morning_bundle_sent_at
            ? utcDayString(new Date(raw.last_morning_bundle_sent_at))
            : null;
        if (last === today) continue;

        profilesAttempted += 1;
        if (profilesAttempted > 400) break;

        const { data: roleRow } = await admin
            .from('user_tenant_roles')
            .select('tenant_id')
            .eq('user_id', raw.id)
            .limit(1)
            .maybeSingle();

        let planName = 'free';
        let aiUsed = 0;
        let aiLimit = 0;
        let aiRemaining = 0;
        let resetsAt = '';

        if (roleRow?.tenant_id) {
            const { data: tenant } = await admin
                .from('tenants')
                .select('subscription_plan')
                .eq('id', roleRow.tenant_id)
                .maybeSingle();
            planName = (tenant?.subscription_plan as string) || 'free';
            const st = await getAiLeadQuotaStatus(admin, roleRow.tenant_id, planName);
            aiUsed = st.used;
            aiLimit = st.limit;
            aiRemaining = st.remaining;
            resetsAt = st.resetsAt;
        }

        const todayFocus =
            'Review open deals and leads assigned to you. Reply to time-sensitive messages first.';
        const improvements =
            'Tighten follow-up on warm leads, update deal stages for accuracy, and schedule outreach for stalled opportunities.';

        let sentThisProfile = 0;

        if (prefs.briefing) {
            const r1 = await sendPlatformTemplateEmail(admin, {
                templateName: 'Morning Briefing',
                to: raw.email,
                variables: {
                    name: raw.name || raw.email.split('@')[0] || 'there',
                    dashboardUrl,
                    summaryDate,
                    todayFocus,
                    improvements,
                },
                credentialUserId: raw.id,
                templateAllowlist: SYSTEM_PLATFORM_TEMPLATES,
                skipIfWelcomeAlreadySent: false,
                authUserId: null,
            });
            if (r1.success) {
                sentThisProfile += 1;
            } else {
                failed += 1;
            }
        }

        if (prefs.aiStatus) {
            const atLimit = aiRemaining <= 0;
            const quotaMessage = atLimit
                ? 'You have used all AI lead credits for today (UTC). They reset at the time shown below, or you can upgrade for a higher allowance.'
                : 'You still have AI lead capacity today. Use the Growth Agent or lead tools to fill your pipeline.';

            const r2 = await sendPlatformTemplateEmail(admin, {
                templateName: 'AI and Leads Status',
                to: raw.email,
                variables: {
                    name: raw.name || raw.email.split('@')[0] || 'there',
                    dashboardUrl,
                    planName,
                    aiLeadsUsed: aiUsed,
                    aiLeadsLimit: aiLimit,
                    aiLeadsRemaining: aiRemaining,
                    resetsAt,
                    quotaMessage,
                    missingFeatures: describeMissingVersusHigherPlans(planName),
                    upgradeUrl,
                },
                credentialUserId: raw.id,
                templateAllowlist: SYSTEM_PLATFORM_TEMPLATES,
                skipIfWelcomeAlreadySent: false,
                authUserId: null,
            });
            if (r2.success) {
                sentThisProfile += 1;
            } else {
                failed += 1;
            }
        }

        if (sentThisProfile > 0) {
            emailsSent += sentThisProfile;
            await admin
                .from('profiles')
                .update({ last_morning_bundle_sent_at: new Date().toISOString() })
                .eq('id', raw.id);
        }
    }

    return { profilesAttempted, emailsSent, failed };
}
