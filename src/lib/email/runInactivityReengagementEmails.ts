import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendUniversalEmail } from '@/lib/email/universalEmailEngine';
import { defaultDashboardUrl } from '@/lib/email/platformTemplateEmail';

type InactivityTier = 3 | 7 | 14;

const TEMPLATE_BY_DAYS: Record<InactivityTier, string> = {
  3: 'inactivity_3_day',
  7: 'inactivity_7_day',
  14: 'inactivity_14_day',
};

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

async function countOpenLeads(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string) {
  const { count } = await admin
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('stage', ['lead', 'new', 'qualified', 'contacted']);
  return count || 0;
}

/**
 * Sends value-based re-engagement emails at 3/7/14 day inactivity tiers.
 * Respects profiles.email_preferences.lifecycle_email !== false.
 */
export async function runInactivityReengagementEmails(): Promise<{
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  const admin = createSupabaseAdminClient();
  const dashboardUrl = defaultDashboardUrl();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, email, name, email_preferences, last_active_at, last_login_at')
    .not('email', 'is', null)
    .limit(500);

  if (error || !profiles?.length) {
    return { scanned: 0, sent, skipped, failed };
  }

  for (const profile of profiles) {
    const prefs = (profile.email_preferences || {}) as Record<string, unknown>;
    if (prefs.lifecycle_email === false || prefs.email_notifications === false) {
      skipped += 1;
      continue;
    }

    const inactiveDays =
      daysSince(profile.last_active_at as string) ??
      daysSince(profile.last_login_at as string);
    if (inactiveDays === null || inactiveDays < 3) {
      skipped += 1;
      continue;
    }

    let tier: InactivityTier | null = null;
    if (inactiveDays >= 14) tier = 14;
    else if (inactiveDays >= 7) tier = 7;
    else if (inactiveDays >= 3) tier = 3;
    if (!tier) continue;

    const sentKey = `inactive_${tier}_sent_at`;
    const lastSent = prefs[sentKey];
    if (typeof lastSent === 'string') {
      const sinceSent = daysSince(lastSent);
      if (sinceSent !== null && sinceSent < tier) {
        skipped += 1;
        continue;
      }
    }

    const { data: membership } = await admin
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', profile.id)
      .limit(1)
      .maybeSingle();

    const tenantId = membership?.tenant_id;
    if (!tenantId) {
      skipped += 1;
      continue;
    }

    let message = 'Your AlphaClone workspace is ready when you are.';
    const openLeads = await countOpenLeads(admin, tenantId);
    if (openLeads > 0) {
      message = `You still have ${openLeads} lead${openLeads === 1 ? '' : 's'} waiting for follow-up.`;
    }

    const result = await sendUniversalEmail({
      templateKey: TEMPLATE_BY_DAYS[tier],
      tenantId,
      recipientEmail: profile.email as string,
      userId: profile.id,
      recipientType: 'user',
      variables: {
        first_name: (profile.name as string) || 'there',
        lead_count: String(openLeads),
        cta_url: dashboardUrl,
      },
      ctaUrl: dashboardUrl,
    });

    if (result.success) {
      sent += 1;
      await admin
        .from('profiles')
        .update({
          email_preferences: {
            ...prefs,
            [sentKey]: new Date().toISOString(),
          },
        })
        .eq('id', profile.id);
    } else if (result.skipped) {
      skipped += 1;
    } else {
      failed += 1;
    }
  }

  return { scanned: profiles.length, sent, skipped, failed };
}
