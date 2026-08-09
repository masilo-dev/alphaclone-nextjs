import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmailServer } from '@/lib/email/sendEmailServer';

type BookingAutomationContext = {
  tenantId: string;
  bookingId: string;
  bookingTypeName: string;
  clientName: string;
  clientEmail: string;
  clientNotes?: string | null;
  startTime: string;
  endTime: string;
  timeZone?: string | null;
  meetingUrl?: string | null;
  hostUserId?: string | null;
  source?: string;
};

type BookingAutomationRule = {
  id: string;
  name: string;
  trigger_event: string;
  recipient: 'client' | 'host';
  offset_minutes: number;
  timing: 'after_event' | 'before_start' | 'after_end';
  subject_template: string;
  body_template: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function scheduledFor(rule: BookingAutomationRule, context: BookingAutomationContext) {
  const now = Date.now();
  if (rule.timing === 'before_start') {
    return new Date(new Date(context.startTime).getTime() - rule.offset_minutes * 60_000);
  }
  if (rule.timing === 'after_end') {
    return new Date(new Date(context.endTime).getTime() + rule.offset_minutes * 60_000);
  }
  return new Date(now + rule.offset_minutes * 60_000);
}

function render(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => values[key] || '');
}

async function resolveHostEmail(supabase: SupabaseClient, hostUserId?: string | null) {
  if (!hostUserId) return '';
  const { data } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', hostUserId)
    .maybeSingle();
  return typeof data?.email === 'string' ? data.email : '';
}

async function resolveTenantName(supabase: SupabaseClient, tenantId: string) {
  const { data } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle();
  return typeof data?.name === 'string' ? data.name : 'AlphaClone workspace';
}

export async function enqueueBookingAutomationJobs(
  supabase: SupabaseClient,
  context: BookingAutomationContext,
  triggerEvent = 'booking.confirmed'
) {
  const { data: rules, error } = await supabase
    .from('booking_automation_rules')
    .select('id, name, trigger_event, recipient, offset_minutes, timing, subject_template, body_template')
    .eq('tenant_id', context.tenantId)
    .eq('trigger_event', triggerEvent)
    .eq('is_active', true);

  if (error) {
    console.error('[bookingAutomation] Failed to load rules:', error.message);
    return { queued: 0, skipped: 0 };
  }

  const tenantName = await resolveTenantName(supabase, context.tenantId);
  const hostEmail = await resolveHostEmail(supabase, context.hostUserId);
  const when = new Date(context.startTime).toLocaleString('en-US', {
    timeZone: context.timeZone || 'UTC',
    dateStyle: 'full',
    timeStyle: 'short',
  });
  const meetingLinkHtml = context.meetingUrl
    ? `<p><a href="${escapeHtml(context.meetingUrl)}" style="display:inline-block;padding:12px 18px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px;">Open meeting</a></p>`
    : '';

  let queued = 0;
  let skipped = 0;

  for (const rule of (rules || []) as BookingAutomationRule[]) {
    const recipientEmail = rule.recipient === 'host' ? hostEmail : context.clientEmail;
    if (!recipientEmail) {
      skipped += 1;
      continue;
    }

    const values = {
      tenant_name: escapeHtml(tenantName),
      service_name: escapeHtml(context.bookingTypeName || 'Meeting'),
      client_name: escapeHtml(context.clientName || context.clientEmail),
      client_email: escapeHtml(context.clientEmail),
      client_notes: escapeHtml(context.clientNotes || ''),
      start_time: escapeHtml(when),
      meeting_link_html: meetingLinkHtml,
    };
    const dueAt = scheduledFor(rule, context);
    const idempotencyKey = `${context.bookingId}:${rule.id}`;

    const { error: insertError } = await supabase.from('booking_automation_jobs').upsert(
      {
        tenant_id: context.tenantId,
        booking_id: context.bookingId,
        rule_id: rule.id,
        idempotency_key: idempotencyKey,
        recipient_email: recipientEmail,
        recipient_type: rule.recipient,
        subject: render(rule.subject_template, values),
        body_html: render(rule.body_template, values),
        scheduled_for: dueAt.toISOString(),
        status: dueAt.getTime() < Date.now() - 5 * 60_000 ? 'cancelled' : 'pending',
        metadata: {
          source: context.source || 'booking',
          trigger_event: triggerEvent,
          rule_name: rule.name,
        },
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: false }
    );

    if (insertError) {
      console.error('[bookingAutomation] Failed to queue job:', insertError.message);
      skipped += 1;
    } else {
      queued += 1;
    }
  }

  return { queued, skipped };
}

export async function processDueBookingAutomationJobs(supabase: SupabaseClient, limit = 50) {
  const { data: jobs, error } = await supabase
    .from('booking_automation_jobs')
    .select('id, tenant_id, recipient_email, subject, body_html, attempts')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) throw error;

  let sent = 0;
  let failed = 0;

  for (const job of jobs || []) {
    await supabase
      .from('booking_automation_jobs')
      .update({ status: 'sending', attempts: Number(job.attempts || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'pending');

    const result = await sendEmailServer({
      tenantId: String(job.tenant_id),
      to: String(job.recipient_email),
      subject: String(job.subject),
      html: String(job.body_html),
      templateName: 'bookingAutomation',
      isPlatformNotification: true,
    });

    if (result.success) {
      await supabase
        .from('booking_automation_jobs')
        .update({
          status: 'sent',
          provider_message_id: result.emailId || null,
          sent_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      sent += 1;
    } else {
      const attempts = Number(job.attempts || 0) + 1;
      await supabase
        .from('booking_automation_jobs')
        .update({
          status: attempts >= 5 ? 'failed' : 'pending',
          attempts,
          last_error: result.error || 'Email delivery failed',
          scheduled_for: new Date(Date.now() + Math.min(attempts * 15, 120) * 60_000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      failed += 1;
    }
  }

  return { processed: jobs?.length || 0, sent, failed };
}
