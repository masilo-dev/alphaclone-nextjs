import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { scheduleAction } from './scheduledActions';

/** One contact enrollment per sequence, stable across simultaneous retries. */
export function sequenceEnrollmentIdentity(tenantId: string, sequenceId: string, contactId: string): string {
  const digest = createHash('sha256').update(JSON.stringify([tenantId, sequenceId, contactId])).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

/** Bridges legacy MCP sequences to the durable action worker. Delays come from the user. */
export async function scheduleSequenceEnrollment(db: SupabaseClient, enrollment: Record<string, any>, userId: string) {
  let actorId = enrollment.scheduled_by || userId;
  if (!enrollment.scheduled_by) {
    const claimed = await db.from('email_sequence_enrollments').update({ scheduled_by: userId }).eq('id', enrollment.id).eq('tenant_id', enrollment.tenant_id).is('scheduled_by', null).select('scheduled_by').maybeSingle();
    if (claimed.error) throw claimed.error;
    if (claimed.data?.scheduled_by) actorId = claimed.data.scheduled_by;
    else {
      const current = await db.from('email_sequence_enrollments').select('scheduled_by').eq('id', enrollment.id).eq('tenant_id', enrollment.tenant_id).single();
      if (current.error) throw current.error;
      actorId = current.data.scheduled_by;
    }
  }
  const { data: steps, error } = await db.from('email_sequence_steps').select('*').eq('sequence_id', enrollment.sequence_id).eq('tenant_id', enrollment.tenant_id).order('step_order', { nullsFirst: false }).order('delay_days');
  if (error) throw error;
  if (!steps?.length) throw new Error('Sequence has no steps');
  const { data: contact, error: contactError } = await db.from('contacts').select('id,email,first_name,last_name').eq('tenant_id', enrollment.tenant_id).eq('id', enrollment.contact_id).is('deleted_at', null).maybeSingle();
  if (contactError) throw contactError;
  if (!contact?.email) throw new Error('Sequence contact requires an email');
  let time = new Date(enrollment.enrolled_at).getTime();
  const prepared = steps.map((step, index) => {
    const nextTime = step.scheduled_at ? new Date(step.scheduled_at).getTime() : time + Number(step.delay_days) * 86400_000;
    if (!Number.isFinite(nextTime) || nextTime < time) throw new Error('Sequence steps must be in chronological order');
    time = nextTime;
    return { step, index, time: new Date(time).toISOString() };
  });
  const jobs = [];
  try {
    for (const { step, index, time: scheduledAt } of prepared) {
      if (index < Number(enrollment.current_step || 0)) continue;
      jobs.push(await scheduleAction({ tenantId: enrollment.tenant_id, userId: actorId, toolName: 'send_email',
        args: { to: contact.email, subject: step.subject, text: step.body, category: 'outreach' },
        scheduledAt, timezone: step.timezone || 'UTC', allowDue: true,
        metadata: { enrollment_id: enrollment.id, sequence_id: enrollment.sequence_id, step_id: step.id, step_index: index, last_step: index === steps.length - 1 },
      }));
    }
  } catch (error) {
    // No partial sequence is allowed to start when preparation fails.
    await db.from('email_sequence_enrollments').update({ status: 'paused' }).eq('id', enrollment.id).eq('tenant_id', enrollment.tenant_id);
    await db.from('scheduled_mcp_actions').update({ status: 'cancelled', last_error: 'Sequence preparation failed' }).eq('tenant_id', enrollment.tenant_id).eq('status', 'scheduled').contains('metadata', { enrollment_id: enrollment.id });
    throw error;
  }
  return jobs.map(job => ({ id: job.id, scheduled_at: job.scheduled_at, status: job.status }));
}
