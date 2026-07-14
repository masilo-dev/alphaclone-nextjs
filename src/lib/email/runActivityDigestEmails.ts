import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { defaultDashboardUrl } from '@/lib/email/platformTemplateEmail';
import {
  collectActivityDigest,
  digestWindowStart,
  formatDigestEmailHtml,
} from '@/lib/email/activityDigest';

type TenantMember = {
  user_id: string;
  tenant_id: string;
  role: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  email_preferences: Record<string, unknown> | null;
};

function wantsActivityDigest(prefs: Record<string, unknown> | null): boolean {
  const p = prefs ?? {};
  if (p.activity_digest === false || String(p.activity_digest).toLowerCase() === 'false') return false;
  if (p.email_notifications === false || String(p.email_notifications).toLowerCase() === 'false') return false;
  return true;
}

function lastDigestSentAt(prefs: Record<string, unknown> | null): string | null {
  const raw = prefs?.last_activity_digest_sent_at;
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

async function insertInAppDigestNotification(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  userId: string,
  title: string,
  message: string
) {
  const row: Record<string, unknown> = {
    tenant_id: tenantId,
    user_id: userId,
    title,
    message,
    type: 'system',
    read: false,
    link: '/dashboard',
    action_url: '/dashboard',
  };

  let { error } = await admin.from('notifications').insert(row);
  if (error?.message?.includes("'link'")) {
    const fallback = { ...row };
    delete fallback.link;
    ({ error } = await admin.from('notifications').insert(fallback));
  }
  if (error) console.warn('[activityDigest] in-app notification failed:', error.message);
}

/**
 * Every 3 hours: summarize new workspace activity per tenant and notify each member
 * (email + in-app) based on their account preferences.
 */
export async function runActivityDigestEmails(): Promise<{
  membersChecked: number;
  emailsSent: number;
  notificationsCreated: number;
  skippedNoActivity: number;
  skippedOptOut: number;
  failed: number;
}> {
  const admin = createSupabaseAdminClient();
  const dashboardUrl = defaultDashboardUrl();

  const { data: members, error: membersErr } = await admin
    .from('tenant_users')
    .select('user_id, tenant_id, role')
    .limit(2000);

  if (membersErr || !members?.length) {
    console.error('[activityDigest] load tenant_users:', membersErr);
    return {
      membersChecked: 0,
      emailsSent: 0,
      notificationsCreated: 0,
      skippedNoActivity: 0,
      skippedOptOut: 0,
      failed: 0,
    };
  }

  const profileCache = new Map<string, ProfileRow>();
  let emailsSent = 0;
  let notificationsCreated = 0;
  let skippedNoActivity = 0;
  let skippedOptOut = 0;
  let failed = 0;
  let membersChecked = 0;

  for (const member of members as TenantMember[]) {
    if (!member.user_id || !member.tenant_id) continue;
    membersChecked += 1;
    if (membersChecked > 1500) break;

    let profile = profileCache.get(member.user_id);
    if (!profile) {
      const { data } = await admin
        .from('profiles')
        .select('id, email, name, email_preferences')
        .eq('id', member.user_id)
        .maybeSingle();
      if (!data?.email) continue;
      profile = data as ProfileRow;
      profileCache.set(member.user_id, profile);
    }

    if (!profile.email) continue;
    if (!wantsActivityDigest(profile.email_preferences)) {
      skippedOptOut += 1;
      continue;
    }

    const since = digestWindowStart(lastDigestSentAt(profile.email_preferences));
    const summary = await collectActivityDigest(member.tenant_id, member.user_id, since);

    if (summary.total === 0 && summary.assignedTasks === 0) {
      skippedNoActivity += 1;
      continue;
    }

    const userName = profile.name || profile.email.split('@')[0] || 'there';
    const title = `Activity update — ${summary.tenantName}`;
    const message =
      summary.lines.length > 0
        ? summary.lines.join('; ')
        : `${summary.assignedTasks} task(s) need your attention`;

    await insertInAppDigestNotification(admin, member.tenant_id, member.user_id, title, message);
    notificationsCreated += 1;

    const html = formatDigestEmailHtml({
      userName,
      tenantName: summary.tenantName,
      summary,
      dashboardUrl,
    });

    const emailResult = await sendEmailServer({
      tenantId: member.tenant_id,
      userId: member.user_id,
      to: profile.email,
      subject: `[AlphaClone] ${title}`,
      html,
      text: `${title}\n\n${message}\n\n${dashboardUrl}`,
      isPlatformNotification: true,
      templateName: 'activity_digest',
      skipFooter: false,
    });

    const prefs = { ...(profile.email_preferences ?? {}) };
    prefs.last_activity_digest_sent_at = new Date().toISOString();

    if (emailResult.success) {
      emailsSent += 1;
      await admin.from('profiles').update({ email_preferences: prefs }).eq('id', profile.id);
      profile.email_preferences = prefs;
    } else {
      failed += 1;
      console.warn('[activityDigest] email failed', profile.email, emailResult.error);
    }
  }

  return {
    membersChecked,
    emailsSent,
    notificationsCreated,
    skippedNoActivity,
    skippedOptOut,
    failed,
  };
}
