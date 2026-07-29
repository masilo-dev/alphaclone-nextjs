import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
<<<<<<< HEAD
import { emitBusinessEvent } from '@/lib/automation/emit-event';

async function afterDealWrite(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  dealId: string,
  options?: { stageChanged?: boolean; oldStage?: string; newStage?: string; userId?: string | null }
) {
  const { syncDealToUnified, logDealStageActivity } = await import(
    '@/lib/crm/crmBridgeServer'
  );
  await syncDealToUnified(supabase, dealId, tenantId).catch((err) => {
    console.warn('[MCP deals] bridge sync failed:', err);
  });

  if (options?.stageChanged && options.oldStage && options.newStage) {
    await logDealStageActivity(supabase, {
      tenantId,
      dealId,
      fromStage: options.oldStage,
      toStage: options.newStage,
      userId: options.userId || undefined,
    }).catch((err) => console.warn('[MCP deals] stage activity failed:', err));

    await emitBusinessEvent(tenantId, 'deal_stage_changed', {
      dealId,
      oldStage: options.oldStage,
      newStage: options.newStage,
    }).catch((err) => console.warn('[MCP deals] event emit failed:', err));
  }
}
=======
>>>>>>> origin/main

// 1. get_deals
registerTool('deals', {
  name: 'get_deals',
<<<<<<< HEAD
  description: 'Retrieve deals matching filters. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session; optional for session-auth clients
=======
  description: 'Retrieve deals matching filters.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
>>>>>>> origin/main
    stage: z.string().optional(),
    owner_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
<<<<<<< HEAD
      stage: { type: 'string', description: 'Filter by deal stage' },
      owner_id: { type: 'string', format: 'uuid', description: 'Filter by owner user ID' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const tenantId = args.tenant_id || ctx.tenantId;
    if (!tenantId) throw new Error('tenant_id is required');
    let query = supabase
      .from('deals')
      .select('*')
      .eq('tenant_id', tenantId);
=======
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
>>>>>>> origin/main

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
<<<<<<< HEAD
  description: 'Create a new deal in the pipeline. Accepts title or name; value defaults to 0 and stage defaults to lead. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
    user_id: z.string().uuid().optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    value: z.number().nonnegative().optional(),
    stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']).optional(),
    contact_id: z.string().uuid().optional(),
    client_id: z.string().uuid().optional(),
    expected_close_date: z.string().optional(),
    description: z.string().optional(),
  }).refine((data) => Boolean(String(data.title || data.name || '').trim()), {
    message: 'title or name is required',
=======
  description: 'Create a new deal in the pipeline.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    title: z.string(),
    value: z.number().nonnegative(),
    stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
    contact_id: z.string().uuid().optional(),
    expected_close_date: z.string().optional(),
>>>>>>> origin/main
  }),
  jsonSchema: {
    type: 'object',
    properties: {
<<<<<<< HEAD
      name: { type: 'string', description: 'Deal name/title (alias: title)' },
      title: { type: 'string', description: 'Deal name/title (alias: name)' },
      value: { type: 'number', description: 'Value of the deal (default 0)' },
      stage: { type: 'string', enum: ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'], description: 'Default: lead' },
      contact_id: { type: 'string', format: 'uuid' },
      client_id: { type: 'string', format: 'uuid', description: 'CRM client UUID (alias for contact_id)' },
      expected_close_date: { type: 'string', format: 'date-time' },
      description: { type: 'string' },
    },
    required: ['name'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const tenantId = args.tenant_id || ctx.tenantId;
    if (!tenantId) throw new Error('tenant_id is required');
    const ownerId = ctx.userId || args.user_id || null;
    if (!ownerId) throw new Error('owner_id is required');

    const dealName = String(args.title || args.name || '').trim();
    const contactId = args.contact_id || args.client_id || null;
    const { data, error } = await supabase
      .from('deals')
      .insert({
        tenant_id: tenantId,
        name: dealName,
        value: args.value ?? 0,
        stage: args.stage || 'lead',
        contact_id: contactId,
        owner_id: ownerId,
        expected_close_date: args.expected_close_date || null,
        description: args.description || null,
        currency: 'USD',
        probability: 0,
=======
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
>>>>>>> origin/main
      })
      .select()
      .single();

<<<<<<< HEAD
    if (error) {
      throw new Error(`create_deal failed: ${error.message}`);
    }
    await afterDealWrite(supabase, tenantId, data.id);
=======
    if (error) throw error;
>>>>>>> origin/main
    return data;
  },
});

// 3. update_deal
registerTool('deals', {
  name: 'update_deal',
<<<<<<< HEAD
  description: 'Update the fields of a deal. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
=======
  description: 'Update the fields of a deal.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
>>>>>>> origin/main
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
<<<<<<< HEAD
=======
      tenant_id: { type: 'string', format: 'uuid' },
>>>>>>> origin/main
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
<<<<<<< HEAD
    required: ['deal_id', 'fields'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const tenantId = args.tenant_id || ctx.tenantId;
    if (!tenantId) throw new Error('tenant_id is required');
    const { data: existing } = await supabase
      .from('deals')
      .select('stage')
      .eq('id', args.deal_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

=======
    required: ['tenant_id', 'deal_id', 'fields'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
>>>>>>> origin/main
    const { data, error } = await supabase
      .from('deals')
      .update({
        ...args.fields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.deal_id)
<<<<<<< HEAD
      .eq('tenant_id', tenantId)
=======
      .eq('tenant_id', args.tenant_id)
>>>>>>> origin/main
      .select()
      .single();

    if (error) throw error;
<<<<<<< HEAD

    const stageChanged = Boolean(args.fields.stage && existing?.stage && existing.stage !== args.fields.stage);
    await afterDealWrite(supabase, tenantId, args.deal_id, {
      stageChanged,
      oldStage: existing?.stage,
      newStage: args.fields.stage,
      userId: ctx.userId || null,
    });
=======
>>>>>>> origin/main
    return data;
  },
});

// 4. move_deal_stage
registerTool('deals', {
  name: 'move_deal_stage',
<<<<<<< HEAD
  description: 'Change the stage of a deal and log it to stage history. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
=======
  description: 'Change the stage of a deal and log it to stage history.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
>>>>>>> origin/main
    deal_id: z.string().uuid(),
    new_stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
<<<<<<< HEAD
      deal_id: { type: 'string', format: 'uuid' },
      new_stage: { type: 'string', enum: ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
    },
    required: ['deal_id', 'new_stage'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const tenantId = args.tenant_id || ctx.tenantId;
    if (!tenantId) throw new Error('tenant_id is required');
=======
      tenant_id: { type: 'string', format: 'uuid' },
      deal_id: { type: 'string', format: 'uuid' },
      new_stage: { type: 'string', enum: ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
    },
    required: ['tenant_id', 'deal_id', 'new_stage'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
>>>>>>> origin/main
    // 1. Fetch current stage
    const { data: currentDeal, error: fetchError } = await supabase
      .from('deals')
      .select('stage')
      .eq('id', args.deal_id)
<<<<<<< HEAD
      .eq('tenant_id', tenantId)
=======
      .eq('tenant_id', args.tenant_id)
>>>>>>> origin/main
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
<<<<<<< HEAD
      .eq('tenant_id', tenantId)
=======
      .eq('tenant_id', args.tenant_id)
>>>>>>> origin/main
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Log history
    const { error: historyError } = await supabase
      .from('deal_stage_history')
      .insert({
        deal_id: args.deal_id,
<<<<<<< HEAD
        tenant_id: tenantId,
=======
        tenant_id: args.tenant_id,
>>>>>>> origin/main
        from_stage: oldStage,
        to_stage: args.new_stage,
        changed_by: ctx.userId || null,
      });

    if (historyError) {
      console.error('Failed to log deal stage history:', historyError);
    }

<<<<<<< HEAD
    await afterDealWrite(supabase, tenantId, args.deal_id, {
      stageChanged: true,
      oldStage,
      newStage: args.new_stage,
      userId: ctx.userId || null,
    });

=======
>>>>>>> origin/main
    return updatedDeal;
  },
});

// 5. get_pipeline_summary
registerTool('deals', {
  name: 'get_pipeline_summary',
<<<<<<< HEAD
  description: 'Get total count and value of deals grouped by pipeline stages. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
  }),
  jsonSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const tenantId = args.tenant_id || ctx.tenantId;
    if (!tenantId) throw new Error('tenant_id is required');
    const { data, error } = await supabase
      .from('deals')
      .select('stage, value')
      .eq('tenant_id', tenantId);
=======
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
>>>>>>> origin/main

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
