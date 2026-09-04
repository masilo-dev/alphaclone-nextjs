/**
 * Owner execution brief + critical alert emails for Universal Chaser.
 */

import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import {
  formatCriticalChaseAlertEmail,
  formatExecutionBriefEmail,
} from '@/lib/email/chaseEmailTemplates';
import { listChaseInstances } from '@/lib/chaser/chaseInstanceService';
import { getUniversalChaserPhase, isChaserEnabledForTenant } from '@/lib/chaser/chaseConfig';
import { ACTIVE_CHASE_STATES } from '@/lib/chaser/types';

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function notificationDedupeKey(
  tenantId: string,
  ownerUserId: string,
  type: string,
  period: string,
  chaseId?: string,
): string {
  return [tenantId, ownerUserId, type, chaseId || 'all', period].join(':');
}

export async function runChaseMorningBriefEmails(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  if (getUniversalChaserPhase() < 2) return { sent: 0, skipped: 0, failed: 0 };

  const admin = createSupabaseAdminClient();
  const { data: tenants } = await admin.from('tenants').select('id, name, owner_id').limit(100);
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const period = utcDay();

  for (const tenant of tenants || []) {
    if (!(await isChaserEnabledForTenant(tenant.id))) {
      skipped += 1;
      continue;
    }

    const ownerId = tenant.owner_id;
    if (!ownerId) continue;

    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, name, email_preferences')
      .eq('id', ownerId)
      .maybeSingle();
    if (!profile?.email) continue;

    const prefs = (profile.email_preferences || {}) as Record<string, unknown>;
    if (prefs.chase_morning_brief === false || prefs.morning_briefing === false) {
      skipped += 1;
      continue;
    }

    const dedupe = notificationDedupeKey(tenant.id, ownerId, 'morning_brief', period);

    const { data: items } = await listChaseInstances(tenant.id, {
      state: Array.from(ACTIVE_CHASE_STATES) as any,
      limit: 50,
    });
    if (!items.length) {
      skipped += 1;
      continue;
    }

    const { subject, html } = formatExecutionBriefEmail({
      tenantId: tenant.id,
      tenantName: tenant.name || 'AlphaClone',
      ownerUserId: ownerId,
      ownerEmail: profile.email,
      ownerName: profile.name || 'Owner',
      items,
    });

    const result = await sendEmailServer({
      tenantId: tenant.id,
      to: profile.email,
      subject,
      html,
      templateName: 'chase_morning_brief',
      idempotencyKey: dedupe,
    });

    if (result.success) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return { sent, skipped, failed };
}

export async function runCriticalChaseAlerts(): Promise<{ sent: number; failed: number }> {
  if (getUniversalChaserPhase() < 2) return { sent: 0, failed: 0 };

  const admin = createSupabaseAdminClient();
  const { data: critical } = await admin
    .from('chase_instances')
    .select('*')
    .eq('severity', 'critical')
    .not('state', 'in', '("RESOLVED","EXHAUSTED","CANCELLED")')
    .limit(20);

  let sent = 0;
  let failed = 0;
  const period = utcDay();

  for (const chase of critical || []) {
    if (!(await isChaserEnabledForTenant(chase.tenant_id))) continue;
    const { data: tenant } = await admin
      .from('tenants')
      .select('name, owner_id')
      .eq('id', chase.tenant_id)
      .maybeSingle();
    if (!tenant?.owner_id) continue;

    const { data: profile } = await admin
      .from('profiles')
      .select('email, name')
      .eq('id', tenant.owner_id)
      .maybeSingle();
    if (!profile?.email) continue;

    const dedupe = notificationDedupeKey(
      chase.tenant_id,
      tenant.owner_id,
      'critical_alert',
      period,
      chase.id,
    );
    const evidence = (chase.evidence || {}) as Record<string, unknown>;
    if (evidence.last_critical_alert_key === dedupe) continue;

    const { subject, html } = formatCriticalChaseAlertEmail({
      tenantId: chase.tenant_id,
      tenantName: tenant.name || 'AlphaClone',
      ownerUserId: tenant.owner_id,
      ownerEmail: profile.email,
      item: chase as any,
    });

    const result = await sendEmailServer({
      tenantId: chase.tenant_id,
      to: profile.email,
      subject,
      html,
      templateName: 'chase_critical_alert',
      idempotencyKey: dedupe,
    });

    if (result.success) {
      sent += 1;
      await admin
        .from('chase_instances')
        .update({
          evidence: {
            ...evidence,
            last_critical_alert_key: dedupe,
            last_critical_alert_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', chase.id);
    } else {
      failed += 1;
    }
  }

  return { sent, failed };
}
