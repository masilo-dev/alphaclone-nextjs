import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveEnrollmentContactId } from '@/lib/crm/resolveEnrollmentContactId';
import crypto from 'crypto';
import { sequenceEnrollmentIdentity, scheduleSequenceEnrollment } from '@/lib/scheduling/sequenceSchedule';
import { resolveScheduleTime } from '@/lib/scheduling/scheduleTime';

// 1. create_email_sequence
registerTool('outreach', {
  name: 'create_email_sequence',
  description: 'Create an email outreach sequence with multiple steps.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    name: z.string(),
    steps: z.array(
      z.object({
        delay_days: z.number().int().min(0).optional(),
        scheduled_at: z.string().optional(),
        timezone: z.string().optional(),
        subject: z.string(),
        body: z.string(),
      }).refine(step => step.delay_days !== undefined || Boolean(step.scheduled_at), 'Each step requires delay_days or scheduled_at')
    ),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      name: { type: 'string', description: 'Name of the sequence' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            delay_days: { type: 'number' },
            scheduled_at: { type: 'string', description: 'Exact user-selected time with offset, or local time plus timezone' },
            timezone: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['subject', 'body'],
        },
      },
    },
    required: ['tenant_id', 'name', 'steps'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();

    // Validate all user times before creating a record.
    const prepared = args.steps.map((step, index) => ({
      delay_days: step.delay_days ?? 0,
      scheduled_at: step.scheduled_at ? resolveScheduleTime(step.scheduled_at, step.timezone) : null,
      timezone: step.timezone || null, step_order: index,
      subject: step.subject, body: step.body, tenant_id: args.tenant_id,
    }));
    // 1. Insert sequence
    const { data: sequence, error: seqError } = await supabase
      .from('email_sequences')
      .insert({
        tenant_id: args.tenant_id,
        name: args.name,
      })
      .select()
      .single();

    if (seqError) throw seqError;

    // 2. Insert steps
    const stepRows = prepared.map(step => ({ ...step, sequence_id: sequence.id }));

    const { error: stepsError } = await supabase
      .from('email_sequence_steps')
      .insert(stepRows);

    if (stepsError) {
      await supabase.from('email_sequences').delete().eq('id', sequence.id).eq('tenant_id', args.tenant_id);
      throw stepsError;
    }

    return {
      sequence_id: sequence.id,
      name: sequence.name,
      steps_count: stepRows.length,
    };
  },
});

// 2. enroll_contact_in_sequence
registerTool('outreach', {
  name: 'enroll_contact_in_sequence',
  description: 'Enroll a contact in an email sequence.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    contact_id: z.string().uuid(),
    sequence_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      contact_id: { type: 'string', format: 'uuid' },
      sequence_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'contact_id', 'sequence_id'],
  },
  handler: async (args, context) => {
    const supabase = createSupabaseAdminClient();
    const { data: sequence, error: sequenceError } = await supabase.from('email_sequences').select('id').eq('id', args.sequence_id).eq('tenant_id', args.tenant_id).maybeSingle();
    if (sequenceError) throw sequenceError;
    if (!sequence) throw new Error('Sequence not found in this workspace');
    const canonicalContactId = await resolveEnrollmentContactId(
      supabase,
      args.tenant_id,
      args.contact_id
    );

    if (!canonicalContactId) {
      throw new Error('Contact not found or does not belong to this tenant.');
    }

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', canonicalContactId)
      .eq('tenant_id', args.tenant_id)
      .is('deleted_at', null)
      .single();

    if (contactError || !contact) {
      throw new Error(`Contact not found or does not belong to this tenant.`);
    }

    const existing = await supabase.from('email_sequence_enrollments').select('*').eq('tenant_id', args.tenant_id).eq('contact_id', canonicalContactId).eq('sequence_id', args.sequence_id).eq('status', 'active').order('enrolled_at', { ascending: false }).limit(1).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      const jobs = await scheduleSequenceEnrollment(supabase, existing.data, context.userId);
      return { ...existing.data, scheduled_actions: jobs, approval_state: 'approved' };
    }
    const enrollmentId = sequenceEnrollmentIdentity(args.tenant_id, args.sequence_id, canonicalContactId);
    const { data, error } = await supabase
      .from('email_sequence_enrollments')
      .insert({
        id: enrollmentId,
        contact_id: canonicalContactId,
        sequence_id: args.sequence_id,
        tenant_id: args.tenant_id,
        status: 'active',
        current_step: 0,
        scheduled_by: context.userId,
      })
      .select()
      .single();

    if (error?.code === '23505') {
      const replay = await supabase.from('email_sequence_enrollments').select('*').eq('id', enrollmentId).eq('tenant_id', args.tenant_id).single();
      if (replay.error) throw replay.error;
      if (replay.data.status !== 'active') return { ...replay.data, idempotent_replay: true };
      const jobs = await scheduleSequenceEnrollment(supabase, replay.data, context.userId);
      return { ...replay.data, scheduled_actions: jobs, idempotent_replay: true };
    }
    if (error) throw error;
    const jobs = await scheduleSequenceEnrollment(supabase, data, context.userId);
    return { ...data, scheduled_actions: jobs, approval_state: 'approved' };
  },
});

// 3. get_sequence_stats
registerTool('outreach', {
  name: 'get_sequence_stats',
  description: 'Get statistics on enrollments in a sequence.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    sequence_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      sequence_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'sequence_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();

    // Verify sequence belongs to tenant
    const { data: seq, error: seqError } = await supabase
      .from('email_sequences')
      .select('id')
      .eq('id', args.sequence_id)
      .eq('tenant_id', args.tenant_id)
      .single();

    if (seqError || !seq) {
      throw new Error(`Sequence not found or does not belong to this tenant.`);
    }

    const { data, error } = await supabase
      .from('email_sequence_enrollments')
      .select('status')
      .eq('sequence_id', args.sequence_id).eq('tenant_id', args.tenant_id);

    if (error) throw error;

    const stats = {
      active: 0,
      paused: 0,
      completed: 0,
      unsubscribed: 0,
    };

    data.forEach((enrollment: any) => {
      const status = enrollment.status as keyof typeof stats;
      if (status in stats) {
        stats[status] += 1;
      }
    });

    return stats;
  },
});

// 4. create_bulk_email_batch
registerTool('outreach', {
  name: 'create_bulk_email_batch',
  description: 'Queue a bulk email campaign batch job.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    template: z.string(),
    contact_ids: z.array(z.string().uuid()),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      template: { type: 'string', description: 'Email template with markdown and variables' },
      contact_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
    },
    required: ['tenant_id', 'template', 'contact_ids'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const batchId = `msgbatch_${crypto.randomBytes(8).toString('hex')}`;

    const { data, error } = await supabase
      .from('email_batch_jobs')
      .insert({
        tenant_id: args.tenant_id,
        anthropic_batch_id: batchId,
        template: args.template,
        contact_ids: args.contact_ids,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return {
      batch_job_id: data.id,
      anthropic_batch_id: data.anthropic_batch_id,
      contacts_count: args.contact_ids.length,
      status: data.status,
    };
  },
});

// 5. get_batch_job_status
registerTool('outreach', {
  name: 'get_batch_job_status',
  description: 'Get status of a queued bulk email batch job.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    batch_job_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      batch_job_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'batch_job_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('email_batch_jobs')
      .select('*')
      .eq('id', args.batch_job_id)
      .eq('tenant_id', args.tenant_id)
      .single();

    if (error) throw error;
    return data;
  },
});
