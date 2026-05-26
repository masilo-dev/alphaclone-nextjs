import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// 1. get_deals
registerTool('deals', {
  name: 'get_deals',
  description: 'Retrieve deals matching filters.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    stage: z.string().optional(),
    owner_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      stage: { type: 'string', description: 'Filter by deal stage' },
      owner_id: { type: 'string', format: 'uuid', description: 'Filter by owner user ID' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('deals')
      .select('*')
      .eq('tenant_id', args.tenant_id);

    if (args.stage) {
      query = query.eq('stage', args.stage);
    }
    if (args.owner_id) {
      query = query.eq('owner_id', args.owner_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
});

// 2. create_deal
registerTool('deals', {
  name: 'create_deal',
  description: 'Create a new deal in the pipeline.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    title: z.string(),
    value: z.number().nonnegative(),
    stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
    contact_id: z.string().uuid().optional(),
    expected_close_date: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      title: { type: 'string', description: 'Name/title of the deal' },
      value: { type: 'number', description: 'Value of the deal' },
      stage: { type: 'string', enum: ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
      contact_id: { type: 'string', format: 'uuid' },
      expected_close_date: { type: 'string', format: 'date-time' },
    },
    required: ['tenant_id', 'title', 'value', 'stage'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('deals')
      .insert({
        tenant_id: args.tenant_id,
        name: args.title,
        value: args.value,
        stage: args.stage,
        contact_id: args.contact_id || null,
        expected_close_date: args.expected_close_date || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 3. update_deal
registerTool('deals', {
  name: 'update_deal',
  description: 'Update the fields of a deal.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    deal_id: z.string().uuid(),
    fields: z.object({
      name: z.string().optional(),
      value: z.number().nonnegative().optional(),
      stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']).optional(),
      description: z.string().optional(),
    }),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      deal_id: { type: 'string', format: 'uuid' },
      fields: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { type: 'number' },
          stage: { type: 'string', enum: ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
          description: { type: 'string' },
        },
      },
    },
    required: ['tenant_id', 'deal_id', 'fields'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('deals')
      .update({
        ...args.fields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.deal_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 4. move_deal_stage
registerTool('deals', {
  name: 'move_deal_stage',
  description: 'Change the stage of a deal and log it to stage history.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    deal_id: z.string().uuid(),
    new_stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      deal_id: { type: 'string', format: 'uuid' },
      new_stage: { type: 'string', enum: ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
    },
    required: ['tenant_id', 'deal_id', 'new_stage'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    // 1. Fetch current stage
    const { data: currentDeal, error: fetchError } = await supabase
      .from('deals')
      .select('stage')
      .eq('id', args.deal_id)
      .eq('tenant_id', args.tenant_id)
      .single();

    if (fetchError) throw fetchError;
    const oldStage = currentDeal.stage;

    // 2. Update stage
    const { data: updatedDeal, error: updateError } = await supabase
      .from('deals')
      .update({
        stage: args.new_stage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.deal_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Log history
    const { error: historyError } = await supabase
      .from('deal_stage_history')
      .insert({
        deal_id: args.deal_id,
        tenant_id: args.tenant_id,
        from_stage: oldStage,
        to_stage: args.new_stage,
        changed_by: ctx.userId || null,
      });

    if (historyError) {
      console.error('Failed to log deal stage history:', historyError);
    }

    return updatedDeal;
  },
});

// 5. get_pipeline_summary
registerTool('deals', {
  name: 'get_pipeline_summary',
  description: 'Get total count and value of deals grouped by pipeline stages.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('deals')
      .select('stage, value')
      .eq('tenant_id', args.tenant_id);

    if (error) throw error;

    const summary: Record<string, { count: number; total_value: number }> = {
      lead: { count: 0, total_value: 0 },
      qualified: { count: 0, total_value: 0 },
      proposal: { count: 0, total_value: 0 },
      negotiation: { count: 0, total_value: 0 },
      closed_won: { count: 0, total_value: 0 },
      closed_lost: { count: 0, total_value: 0 },
    };

    data.forEach((deal: any) => {
      const stage = deal.stage;
      const val = Number(deal.value) || 0;
      if (summary[stage]) {
        summary[stage].count += 1;
        summary[stage].total_value += val;
      }
    });

    return summary;
  },
});
