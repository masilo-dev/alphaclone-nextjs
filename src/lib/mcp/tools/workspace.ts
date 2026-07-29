import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// 1. get_workspace_widgets
registerTool('workspace', {
  name: 'get_workspace_widgets',
  description: 'Retrieve configured dashboard widgets for the tenant workspace.',
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
      .from('dashboard_widgets')
      .select('*')
      .eq('tenant_id', args.tenant_id);

    if (error) throw error;
    return data;
  },
});

// 2. toggle_widget_visibility
registerTool('workspace', {
  name: 'toggle_widget_visibility',
  description: 'Show or hide a dashboard widget.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    widget_id: z.string().uuid(),
    visible: z.boolean(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      widget_id: { type: 'string', format: 'uuid' },
      visible: { type: 'boolean', description: 'True to show, false to hide' },
    },
    required: ['tenant_id', 'widget_id', 'visible'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();

    // Fetch original widget to update config
    const { data: widget, error: fetchError } = await supabase
      .from('dashboard_widgets')
      .select('config')
      .eq('id', args.widget_id)
      .eq('tenant_id', args.tenant_id)
      .single();

    if (fetchError) throw fetchError;

    const newConfig = {
      ...(widget.config || {}),
      visible: args.visible,
    };

    const { data, error } = await supabase
      .from('dashboard_widgets')
      .update({
        config: newConfig,
      })
      .eq('id', args.widget_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 3. reorder_widgets
registerTool('workspace', {
  name: 'reorder_widgets',
  description: 'Reorder dashboard widgets by position coordinates.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    widget_ids: z.array(z.string().uuid()),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      widget_ids: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'Ordered list of widget IDs' },
    },
    required: ['tenant_id', 'widget_ids'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();

    const updates = args.widget_ids.map((id: string, index: number) => {
      return supabase
        .from('dashboard_widgets')
        .update({
          position: { row: index, col: 0, w: 12, h: 4 },
        })
        .eq('id', id)
        .eq('tenant_id', args.tenant_id);
    });

    await Promise.all(updates);

    return { success: true, message: 'Widgets reordered.' };
  },
});

// 4. get_dashboard_stats
registerTool('workspace', {
  name: 'get_dashboard_stats',
  description: 'Retrieve general workspace dashboard metrics and object counts.',
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

<<<<<<< HEAD
    const [leadsCount, dealsCount, tasksCount, projectsCount, leadsRawCount] = await Promise.all([
=======
    const [leadsCount, dealsCount, tasksCount, projectsCount] = await Promise.all([
>>>>>>> origin/main
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('tenant_id', args.tenant_id),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('tenant_id', args.tenant_id),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('tenant_id', args.tenant_id).neq('status', 'completed'),
      supabase.from('projects').select('*', { count: 'exact', head: true }).eq('tenant_id', args.tenant_id).eq('status', 'active'),
<<<<<<< HEAD
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', args.tenant_id)
        .not('stage', 'in', '("converted","closed_lost")'),
    ]);

    const activeLeads = leadsRawCount.count ?? leadsCount.count ?? 0;
    const aggregatorLeads = leadsCount.count || 0;
    const consistencyWarning =
      aggregatorLeads > 0 && activeLeads > 0 && Math.abs(aggregatorLeads - activeLeads) > aggregatorLeads * 0.25
        ? `Lead count mismatch: all leads=${aggregatorLeads}, active (excl. converted)=${activeLeads}. Prefer get_leads with pagination for pipeline truth.`
        : undefined;

    return {
      active_leads: activeLeads,
      active_deals: dealsCount.count || 0,
      pending_tasks: tasksCount.count || 0,
      active_projects: projectsCount.count || 0,
      ...(consistencyWarning ? { consistency_warning: consistencyWarning } : {}),
=======
    ]);

    return {
      active_leads: leadsCount.count || 0,
      active_deals: dealsCount.count || 0,
      pending_tasks: tasksCount.count || 0,
      active_projects: projectsCount.count || 0,
>>>>>>> origin/main
    };
  },
});
