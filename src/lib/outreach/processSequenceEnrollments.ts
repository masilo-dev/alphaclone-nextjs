import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { sendWhatsAppMessage } from '@/lib/whatsapp/sendWhatsApp';
import { createHash } from 'crypto';

type Db = any;

type Enrollment = {
  id: string;
  tenant_id: string;
  sequence_id: string;
  contact_id?: string | null;
  lead_id?: string | null;
  client_id?: string | null;
  email?: string | null;
  recipient_email?: string | null;
  normalized_recipient?: string | null;
  recipient_name?: string | null;
  contact_name?: string | null;
  lead_name?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  current_step_order: number;
  metadata?: Record<string, unknown> | null;
};

type Step = {
  id: string;
  step_order: number;
  channel: 'email' | 'linkedin' | 'sms' | 'whatsapp' | 'call' | 'task';
  delay_minutes: number;
  condition?: Record<string, unknown> | null;
  template?: Record<string, unknown> | null;
};

type ExperimentAssignment = {
  experimentId: string;
  variantKey: string;
  variant: Record<string, unknown>;
};

const replyEvents = ['replied', 'reply', 'positive_reply', 'objection', 'not_now', 'unsubscribe', 'wrong_person'];

function interpolate(value: string, enrollment: Enrollment) {
  const data: Record<string, string> = {
    email: enrollment.email || '',
    phone: enrollment.phone || '',
    name: String(enrollment.metadata?.source_name || ''),
    first_name: String(enrollment.metadata?.source_name || '').split(/\s+/)[0] || '',
  };
  return value.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key) => data[key] ?? '');
}

export function conditionMatches(condition: Record<string, unknown>, eventTypes: string[]) {
  const required = String(condition.event || condition.requires_event || '').trim().toLowerCase();
  const excluded = String(condition.not_event || condition.excludes_event || '').trim().toLowerCase();
  if (required === 'not_opened') return !eventTypes.includes('opened');
  if (required === 'no_reply') return !eventTypes.some((event) => replyEvents.includes(event));
  if (required && !eventTypes.includes(required)) return false;
  if (excluded && eventTypes.includes(excluded)) return false;
  return true;
}

function minutesInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

function parseClock(value: unknown) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function quietHoursEnd(timezone: string, quietHours: Record<string, unknown>) {
  const start = parseClock(quietHours.start);
  const end = parseClock(quietHours.end);
  if (start === null || end === null || start === end) return null;
  const nowMinutes = minutesInTimezone(timezone);
  const quiet = start < end ? nowMinutes >= start && nowMinutes < end : nowMinutes >= start || nowMinutes < end;
  if (!quiet) return null;
  const minutesUntilEnd = (end - nowMinutes + 1440) % 1440 || 1440;
  return new Date(Date.now() + minutesUntilEnd * 60_000).toISOString();
}

async function isSuppressed(db: Db, tenantId: string, channel: string, recipient: string) {
  const normalized = channel === 'email' ? recipient.trim().toLowerCase() : recipient.replace(/[^\d+]/g, '');
  const { data, error } = await db.from('outreach_suppressions').select('id')
    .eq('tenant_id', tenantId).eq('channel', channel).eq('normalized_recipient', normalized)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).maybeSingle();
  if (error) throw new Error(`Suppression safety check unavailable: ${error.message}`);
  return Boolean(data);
}

function chooseVariant(enrollmentId: string, variants: Array<Record<string, unknown>>) {
  const usable = variants.filter((variant) => Number(variant.allocation || variant.weight || 0) > 0);
  if (!usable.length) return null;
  const total = usable.reduce((sum, variant) => sum + Number(variant.allocation || variant.weight || 0), 0);
  const bucket = Number.parseInt(createHash('sha256').update(enrollmentId).digest('hex').slice(0, 12), 16) / 0xffffffffffff;
  let cursor = 0;
  for (const variant of usable) {
    cursor += Number(variant.allocation || variant.weight || 0) / total;
    if (bucket <= cursor) return variant;
  }
  return usable[usable.length - 1];
}

async function resolveExperimentAssignment(db: Db, enrollment: Enrollment): Promise<ExperimentAssignment | null> {
  const { data: experiment, error } = await db.from('outreach_experiments')
    .select('id,variants').eq('tenant_id', enrollment.tenant_id).eq('sequence_id', enrollment.sequence_id)
    .eq('status', 'running').order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!experiment) return null;
  const variants = Array.isArray(experiment.variants) ? experiment.variants as Array<Record<string, unknown>> : [];
  const storedKey = enrollment.metadata?.experiment_id === experiment.id
    ? String(enrollment.metadata?.variant || '')
    : '';
  const variant = variants.find((candidate) => String(candidate.key) === storedKey) || chooseVariant(enrollment.id, variants);
  if (!variant) return null;
  const assignment = { experimentId: String(experiment.id), variantKey: String(variant.key), variant };
  if (!storedKey) {
    enrollment.metadata = { ...(enrollment.metadata || {}), experiment_id: assignment.experimentId, variant: assignment.variantKey };
    await db.from('outreach_sequence_enrollments').update({ metadata: enrollment.metadata, updated_at: new Date().toISOString() })
      .eq('tenant_id', enrollment.tenant_id).eq('id', enrollment.id);
  }
  return assignment;
}

function applyVariant(template: Record<string, unknown>, assignment: ExperimentAssignment | null) {
  if (!assignment) return template;
  const variant = assignment.variant;
  const body = variant.body ?? template.body ?? template.message;
  const offer = String(variant.offer || '').trim();
  return {
    ...template,
    ...(variant.subject ? { subject: variant.subject } : {}),
    ...(body !== undefined ? { body: `${String(body)}${offer ? `\n\n${offer}` : ''}` } : {}),
  };
}

async function finishStep(db: Db, enrollment: Enrollment, step: Step, nextStep: Step | null, eventType: string, assignment: ExperimentAssignment | null) {
  const rawEmail = enrollment.recipient_email || enrollment.email || null;
  const normalized =
    rawEmail && step.channel === 'email'
      ? (typeof (db as any).raw !== 'function' ? rawEmail.toLowerCase() : rawEmail.toLowerCase())
      : rawEmail || enrollment.normalized_recipient || (enrollment as any).normalized_recipient || null;
  await db.from('outreach_events').insert({
    tenant_id: enrollment.tenant_id,
    sequence_id: enrollment.sequence_id,
    step_id: step.id,
    contact_id: enrollment.contact_id || null,
    lead_id: enrollment.lead_id || null,
    client_id: (enrollment as any).client_id || null,
    channel: step.channel,
    event_type: eventType,
    variant: assignment?.variantKey || null,
    metadata: {
      enrollment_id: enrollment.id,
      experiment_id: assignment?.experimentId || null,
      email: rawEmail,
      to: rawEmail,
      recipient: rawEmail || enrollment.phone || enrollment.linkedin_url,
      normalized_recipient: normalized || null,
      recipient_name: enrollment.recipient_name || enrollment.contact_name || enrollment.lead_name || null,
      contact_name: enrollment.recipient_name || enrollment.contact_name || null,
      lead_name: enrollment.lead_name || null,
      subject: (enrollment as any).last_subject || null,
    },
  });
  const now = Date.now();
  await db.from('outreach_sequence_enrollments').update(nextStep ? {
    current_step_order: step.step_order,
    status: 'waiting',
    next_step_at: new Date(now + Math.max(0, nextStep.delay_minutes) * 60_000).toISOString(),
    last_event_type: eventType,
    last_error: null,
    updated_at: new Date(now).toISOString(),
  } : {
    current_step_order: step.step_order,
    status: 'completed',
    completed_at: new Date(now).toISOString(),
    last_event_type: eventType,
    last_error: null,
    updated_at: new Date(now).toISOString(),
  }).eq('tenant_id', enrollment.tenant_id).eq('id', enrollment.id);
}

async function createApprovalTask(db: Db, enrollment: Enrollment, step: Step, template: Record<string, unknown>) {
  const title = interpolate(String(template.title || `${step.channel} outreach follow-up`), enrollment);
  const description = interpolate(String(template.body || template.message || `Complete ${step.channel} outreach for ${enrollment.email || enrollment.phone || enrollment.linkedin_url || 'recipient'}.`), enrollment);
  const { data, error } = await db.from('tasks').insert({
    tenant_id: enrollment.tenant_id,
    title,
    description,
    status: 'todo',
    priority: 'medium',
    metadata: { sequence_id: enrollment.sequence_id, enrollment_id: enrollment.id, step_id: step.id, channel: step.channel, approval_required: true },
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function processSequenceEnrollments(db: Db, limit = 50) {
  const { data: due, error } = await db.from('outreach_sequence_enrollments').select('*')
    .in('status', ['active', 'waiting']).lte('next_step_at', new Date().toISOString())
    .order('next_step_at', { ascending: true }).limit(limit);
  if (error) throw error;

  const result = { due: due?.length || 0, completed: 0, awaitingApproval: 0, skipped: 0, failed: 0 };
  for (const enrollment of (due || []) as Enrollment[]) {
    let executionId: string | null = null;
    let attempt = 1;
    try {
      const { data: sequence } = await db.from('outreach_sequences').select('status,stop_on_reply,approved_at,requires_approval,timezone,quiet_hours,frequency_cap')
        .eq('tenant_id', enrollment.tenant_id).eq('id', enrollment.sequence_id).maybeSingle();
      if (!sequence || sequence.status !== 'active' || (sequence.requires_approval && !sequence.approved_at)) continue;
      const assignment = await resolveExperimentAssignment(db, enrollment);

      const resumeAt = quietHoursEnd(sequence.timezone || 'UTC', sequence.quiet_hours || {});
      if (resumeAt) {
        await db.from('outreach_sequence_enrollments').update({ status: 'waiting', next_step_at: resumeAt, updated_at: new Date().toISOString() }).eq('id', enrollment.id);
        result.skipped++;
        continue;
      }

      const { data: steps, error: stepsError } = await db.from('outreach_sequence_steps').select('*')
        .eq('tenant_id', enrollment.tenant_id).eq('sequence_id', enrollment.sequence_id).eq('status', 'active')
        .gt('step_order', enrollment.current_step_order).order('step_order', { ascending: true }).limit(2);
      if (stepsError) throw stepsError;
      const step = (steps?.[0] || null) as Step | null;
      if (!step) {
        await db.from('outreach_sequence_enrollments').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', enrollment.id);
        continue;
      }
      const nextStep = (steps?.[1] || null) as Step | null;

      const { data: awaitingExecution, error: awaitingError } = await db.from('outreach_sequence_executions')
        .select('id,provider_receipt_id').eq('tenant_id', enrollment.tenant_id).eq('enrollment_id', enrollment.id)
        .eq('step_id', step.id).eq('status', 'awaiting_approval').order('started_at', { ascending: false }).limit(1).maybeSingle();
      if (awaitingError) throw awaitingError;
      if (awaitingExecution) {
        const { data: approvalTask, error: taskError } = await db.from('tasks').select('status,completed_at')
          .eq('tenant_id', enrollment.tenant_id).eq('id', awaitingExecution.provider_receipt_id).maybeSingle();
        if (taskError) throw taskError;
        if (!approvalTask || !['done', 'completed'].includes(String(approvalTask.status).toLowerCase())) {
          await db.from('outreach_sequence_enrollments').update({
            status: 'waiting', next_step_at: new Date(Date.now() + 15 * 60_000).toISOString(),
            last_event_type: 'awaiting_approval', updated_at: new Date().toISOString(),
          }).eq('id', enrollment.id);
          result.awaitingApproval++;
          continue;
        }
        await db.from('outreach_sequence_executions').update({
          status: 'completed', verification: { task_created: true, approval_required: true, task_completed: true, completed_at: approvalTask.completed_at || null },
          completed_at: new Date().toISOString(),
        }).eq('id', awaitingExecution.id);
        await finishStep(db, enrollment, step, nextStep, 'approved_task_completed', assignment);
        result.completed++;
        continue;
      }

      const { count: priorAttempts, error: attemptError } = await db.from('outreach_sequence_executions').select('id', { count: 'exact', head: true })
        .eq('tenant_id', enrollment.tenant_id).eq('enrollment_id', enrollment.id).eq('step_id', step.id);
      if (attemptError) throw attemptError;
      attempt = (priorAttempts || 0) + 1;
      if (attempt > 3) {
        await db.from('outreach_sequence_enrollments').update({ status: 'failed', last_error: 'Retry limit reached', updated_at: new Date().toISOString() }).eq('id', enrollment.id);
        result.failed++;
        continue;
      }

      const { data: events } = await db.from('outreach_events').select('event_type')
        .eq('tenant_id', enrollment.tenant_id).eq('sequence_id', enrollment.sequence_id)
        .or(`contact_id.eq.${enrollment.contact_id || '00000000-0000-0000-0000-000000000000'},lead_id.eq.${enrollment.lead_id || '00000000-0000-0000-0000-000000000000'}`);
      const eventTypes = (events || []).map((event: { event_type: string }) => event.event_type.toLowerCase());
      if (sequence.stop_on_reply && eventTypes.some((event: string) => replyEvents.includes(event))) {
        await db.from('outreach_sequence_enrollments').update({ status: 'stopped', last_event_type: 'reply_detected', updated_at: new Date().toISOString() }).eq('id', enrollment.id);
        result.skipped++;
        continue;
      }
      const cap = Math.max(1, Number(sequence.frequency_cap?.max_per_7_days || 3));
      const { count: recentCount, error: capError } = await db.from('outreach_sequence_executions').select('id', { count: 'exact', head: true })
        .eq('tenant_id', enrollment.tenant_id).eq('enrollment_id', enrollment.id).eq('status', 'completed')
        .gte('completed_at', new Date(Date.now() - 7 * 86400_000).toISOString());
      if (capError) throw capError;
      if ((recentCount || 0) >= cap) {
        await db.from('outreach_sequence_enrollments').update({ status: 'waiting', next_step_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(), updated_at: new Date().toISOString() }).eq('id', enrollment.id);
        result.skipped++;
        continue;
      }

      const { data: execution, error: executionError } = await db.from('outreach_sequence_executions').insert({
        tenant_id: enrollment.tenant_id, sequence_id: enrollment.sequence_id, enrollment_id: enrollment.id,
        step_id: step.id, channel: step.channel, status: 'running', attempt,
      }).select('id').single();
      if (executionError?.code === '23505') continue;
      if (executionError) throw executionError;
      executionId = execution.id;

      if (!conditionMatches(step.condition || {}, eventTypes)) {
        await db.from('outreach_sequence_executions').update({ status: 'skipped', verification: { reason: 'condition_not_met', event_types: eventTypes }, completed_at: new Date().toISOString() }).eq('id', executionId);
        await finishStep(db, enrollment, step, nextStep, 'condition_skipped', assignment);
        result.skipped++;
        continue;
      }

      const template = applyVariant(step.template || {}, assignment);
      let provider = 'internal';
      let receipt = '';
      let verification: Record<string, unknown> = {};
      if (step.channel === 'email') {
        if (!enrollment.email) throw new Error('Recipient has no email address');
        if (await isSuppressed(db, enrollment.tenant_id, 'email', enrollment.email)) throw new Error('Recipient is suppressed for email');
        const sent = await sendEmailServer({
          tenantId: enrollment.tenant_id,
          to: enrollment.email,
          subject: interpolate(String(template.subject || 'Following up'), enrollment),
          message: interpolate(String(template.body || template.message || ''), enrollment),
          templateName: 'outreachSequence',
          category: 'outreach',
          initiationSource: 'automation.sequence',
        });
        if (!sent.success) throw new Error(sent.error || 'Email provider rejected the message');
        provider = sent.provider || 'email'; receipt = sent.emailId || '';
        verification = { provider_accepted: true, receipt_present: Boolean(receipt) };
      } else if (step.channel === 'whatsapp') {
        if (!enrollment.phone) throw new Error('Recipient has no phone number');
        if (await isSuppressed(db, enrollment.tenant_id, 'whatsapp', enrollment.phone)) throw new Error('Recipient is suppressed for WhatsApp');
        const sent = await sendWhatsAppMessage({ tenantId: enrollment.tenant_id, phone: enrollment.phone, message: interpolate(String(template.body || template.message || ''), enrollment), contactId: enrollment.contact_id });
        if (!sent.success) throw new Error(sent.error || 'WhatsApp provider rejected the message');
        provider = sent.provider; receipt = sent.messageId || '';
        verification = { provider_accepted: true, receipt_present: Boolean(receipt) };
      } else {
        receipt = await createApprovalTask(db, enrollment, step, template);
        await db.from('outreach_sequence_executions').update({ status: 'awaiting_approval', provider: 'task', provider_receipt_id: receipt, verification: { task_created: true, approval_required: true }, completed_at: new Date().toISOString() }).eq('id', executionId);
        await db.from('outreach_events').insert({
          tenant_id: enrollment.tenant_id, sequence_id: enrollment.sequence_id, step_id: step.id,
          contact_id: enrollment.contact_id || null, lead_id: enrollment.lead_id || null,
          channel: step.channel, event_type: 'awaiting_approval', provider: 'task', provider_event_id: receipt,
          variant: assignment?.variantKey || null,
          metadata: { enrollment_id: enrollment.id, task_id: receipt, approval_required: true, experiment_id: assignment?.experimentId || null },
        });
        await db.from('outreach_sequence_enrollments').update({
          status: 'waiting', next_step_at: new Date(Date.now() + 15 * 60_000).toISOString(),
          last_event_type: 'awaiting_approval', last_error: null, updated_at: new Date().toISOString(),
        }).eq('id', enrollment.id);
        result.awaitingApproval++;
        continue;
      }

      await db.from('outreach_sequence_executions').update({ status: 'completed', provider, provider_receipt_id: receipt || null, verification, completed_at: new Date().toISOString() }).eq('id', executionId);
      await finishStep(db, enrollment, step, nextStep, 'sent', assignment);
      result.completed++;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Sequence execution failed';
      if (executionId) await db.from('outreach_sequence_executions').update({ status: 'failed', error: message, completed_at: new Date().toISOString() }).eq('id', executionId);
      await db.from('outreach_sequence_enrollments').update(attempt < 3 ? {
        status: 'waiting',
        next_step_at: new Date(Date.now() + Math.min(60, 5 * 2 ** (attempt - 1)) * 60_000).toISOString(),
        last_error: message,
        updated_at: new Date().toISOString(),
      } : { status: 'failed', last_error: message, updated_at: new Date().toISOString() }).eq('id', enrollment.id);
      result.failed++;
    }
  }
  return result;
}
