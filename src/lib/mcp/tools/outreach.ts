import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveEnrollmentContactId } from '@/lib/crm/resolveEnrollmentContactId';
import crypto from 'crypto';

// 1. create_email_sequence
registerTool('outreach', {
  name: 'create_email_sequence',
  description: 'Create an email outreach sequence with multiple steps.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    name: z.string(),
    steps: z.array(
      z.object({
        delay_days: z.number().int().positive(),
        subject: z.string(),
        body: z.string(),
      })
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
            subject: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['delay_days', 'subject', 'body'],
        },
      },
    },
    required: ['tenant_id', 'name', 'steps'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();

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
    const stepRows = args.steps.map((step) => ({
      sequence_id: sequence.id,
      delay_days: step.delay_days,
      subject: step.subject,
      body: step.body,
    }));

    const { error: stepsError } = await supabase
      .from('email_sequence_steps')
      .insert(stepRows);

    if (stepsError) throw stepsError;

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
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
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

    const { data, error } = await supabase
      .from('email_sequence_enrollments')
      .insert({
        contact_id: canonicalContactId,
        sequence_id: args.sequence_id,
        tenant_id: args.tenant_id,
        status: 'active',
        current_step: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
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
      .eq('sequence_id', args.sequence_id);

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
