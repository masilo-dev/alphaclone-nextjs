/**
 * Support Tickets MCP tools — canonical `tickets` table + execution gateway for writes.
 */

import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult } from '@/lib/mcp/connector/response';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { executeMcpWrite } from '@/lib/mcp/executionGateway';

function mapCategoryToTicketType(category?: string): string {
  if (!category) return 'question';
  if (['billing', 'technical'].includes(category)) return category;
  if (category === 'bug') return 'incident';
  if (category === 'feature_request') return 'request';
  return 'question';
}

defineConnectorTool({
  module: 'tickets-ops',
  name: 'create_ticket',
  description: 'Create a new support ticket in the workspace tickets table.',
  permission: 'support:write',
  auditAction: 'create_ticket',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    title: z.string().min(1).optional(),
    subject: z.string().min(1).optional(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
    category: z.string().optional(),
    client_id: z.string().optional(),
    contact_id: z.string().optional(),
    idempotency_key: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      subject: { type: 'string' },
      description: { type: 'string' },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
      category: { type: 'string' },
      client_id: { type: 'string' },
      contact_id: { type: 'string' },
      idempotency_key: { type: 'string' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const title = String(args.title || args.subject || '').trim();
    if (!title) {
      return okResult('create_ticket', { error: 'title or subject required' });
    }
    const idempotencyKey =
      args.idempotency_key?.trim() || `ticket-create:${ctx.tenantId}:${title.slice(0, 80)}`;

    const gateway = await executeMcpWrite({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      tool: 'create_ticket',
      action: 'create_ticket',
      mode: 'execute_now',
      target: {
        workspace_id: ctx.tenantId,
        resource_type: 'ticket',
        resource_id: idempotencyKey,
      },
      payload: { title, description: args.description },
      idempotencyKey,
      execute: async () => {
        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase
          .from('tickets')
          .insert({
            tenant_id: ctx.tenantId,
            title,
            description: args.description || '',
            priority: args.priority || 'medium',
            source: 'mcp',
            channel: 'mcp',
            ticket_type: mapCategoryToTicketType(args.category),
            contact_id: args.contact_id || null,
            client_id: args.client_id || null,
            created_by: ctx.userId,
            status: 'open',
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      buildReceipt: (ticket) => ({
        action_id: '',
        status: 'verified',
        timestamp: new Date().toISOString(),
        entity_type: 'ticket',
        entity_id: String((ticket as { id: string }).id),
      }),
    });

    if (!gateway.ok) {
      return okResult('create_ticket', { success: false, error: gateway.error });
    }
    return okResult('create_ticket', { ticket: gateway.result }, {
      receipt: gateway.receipt || undefined,
    });
  },
});

defineConnectorTool({
  module: 'tickets-ops',
  name: 'get_tickets',
  description: 'Fetch support tickets with optional filtering by status or priority.',
  permission: 'support:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    limit: z.number().optional().default(20),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      status: { type: 'string' },
      priority: { type: 'string' },
      limit: { type: 'number' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('tickets')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false })
      .limit(args.limit || 20);

    if (args.status) query = query.eq('status', args.status);
    if (args.priority) query = query.eq('priority', args.priority);

    const { data, error } = await query;
    if (error) throw error;
    return okResult('get_tickets', { tickets: data || [] });
  },
});

defineConnectorTool({
  module: 'tickets-ops',
  name: 'update_ticket',
  description: 'Update support ticket status, priority, or assignment.',
  permission: 'support:write',
  auditAction: 'update_ticket',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    ticket_id: z.string().min(1),
    status: z.string().optional(),
    priority: z.string().optional(),
    assigned_to: z.string().optional(),
    resolution_note: z.string().optional(),
    idempotency_key: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      ticket_id: { type: 'string' },
      status: { type: 'string' },
      priority: { type: 'string' },
      assigned_to: { type: 'string' },
      resolution_note: { type: 'string' },
      idempotency_key: { type: 'string' },
    },
    required: ['ticket_id'],
  },
  handler: async (args, ctx) => {
    const idempotencyKey =
      args.idempotency_key?.trim() || `ticket-update:${ctx.tenantId}:${args.ticket_id}:${args.status || 'patch'}`;

    const gateway = await executeMcpWrite({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      tool: 'update_ticket',
      action: 'update_ticket',
      mode: 'execute_now',
      target: {
        workspace_id: ctx.tenantId,
        resource_type: 'ticket',
        resource_id: args.ticket_id,
      },
      payload: args,
      idempotencyKey,
      execute: async () => {
        const supabase = createSupabaseAdminClient();
        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (args.status) updateData.status = args.status;
        if (args.priority) updateData.priority = args.priority;
        if (args.assigned_to) updateData.assigned_to = args.assigned_to;
        if (args.status === 'resolved') updateData.resolved_at = new Date().toISOString();
        if (args.status === 'closed') updateData.closed_at = new Date().toISOString();

        const { data: ticket, error } = await supabase
          .from('tickets')
          .update(updateData)
          .eq('id', args.ticket_id)
          .eq('tenant_id', ctx.tenantId)
          .select()
          .single();
        if (error) throw error;

        if (args.resolution_note) {
          await supabase.from('ticket_messages').insert({
            tenant_id: ctx.tenantId,
            ticket_id: ticket.id,
            author_user_id: ctx.userId,
            message_type: 'internal_note',
            body_text: String(args.resolution_note),
            visibility: 'internal',
            metadata: { source: 'mcp_update_ticket', resolution_note: true },
          });
        }
        return ticket;
      },
      buildReceipt: (ticket) => ({
        action_id: '',
        status: 'verified',
        timestamp: new Date().toISOString(),
        entity_type: 'ticket',
        entity_id: String((ticket as { id: string }).id),
      }),
    });

    if (!gateway.ok) {
      return okResult('update_ticket', { success: false, error: gateway.error });
    }
    return okResult('update_ticket', { ticket: gateway.result }, { receipt: gateway.receipt || undefined });
  },
});

defineConnectorTool({
  module: 'tickets-ops',
  name: 'get_ticket_stats',
  description: 'Get support ticket response metrics and status breakdown for the workspace.',
  permission: 'support:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async (_args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const { data: allTickets } = await supabase.from('tickets').select('status').eq('tenant_id', ctx.tenantId);

    const statusCountsMap: Record<string, number> = {};
    (allTickets || []).forEach((t: { status: string }) => {
      statusCountsMap[t.status] = (statusCountsMap[t.status] || 0) + 1;
    });
    const statusCounts = Object.entries(statusCountsMap).map(([status, count]) => ({ status, count }));

    const { data: avgResolution } = await supabase
      .rpc('get_avg_ticket_resolution_time', { p_tenant_id: ctx.tenantId })
      .maybeSingle();

    const { data: slaBreaches } = await supabase
      .from('tickets')
      .select('id, title, sla_due_at, created_at')
      .eq('tenant_id', ctx.tenantId)
      .in('status', ['new', 'open', 'in_progress', 'waiting_on_business', 'escalated', 'reopened'])
      .lt('sla_due_at', new Date().toISOString())
      .limit(10);

    return okResult('get_ticket_stats', {
      status_counts: statusCounts,
      avg_resolution_hours: (avgResolution as { avg_hours?: number } | null)?.avg_hours || null,
      sla_breaches: slaBreaches || [],
    });
  },
});

defineConnectorTool({
  module: 'tickets-ops',
  name: 'escalate_ticket',
  description: 'Escalate a support ticket to urgent priority.',
  permission: 'support:write',
  auditAction: 'escalate_ticket',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    ticket_id: z.string().min(1),
    reason: z.string().optional(),
    idempotency_key: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      ticket_id: { type: 'string' },
      reason: { type: 'string' },
      idempotency_key: { type: 'string' },
    },
    required: ['ticket_id'],
  },
  handler: async (args, ctx) => {
    const idempotencyKey =
      args.idempotency_key?.trim() || `ticket-escalate:${ctx.tenantId}:${args.ticket_id}`;

    const gateway = await executeMcpWrite({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      tool: 'escalate_ticket',
      action: 'escalate_ticket',
      mode: 'execute_now',
      target: {
        workspace_id: ctx.tenantId,
        resource_type: 'ticket',
        resource_id: args.ticket_id,
      },
      payload: args,
      idempotencyKey,
      execute: async () => {
        const supabase = createSupabaseAdminClient();
        const { data: ticket, error } = await supabase
          .from('tickets')
          .update({
            priority: 'urgent',
            status: 'escalated',
            escalated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', args.ticket_id)
          .eq('tenant_id', ctx.tenantId)
          .select()
          .single();
        if (error) throw error;

        await supabase.from('notifications').insert({
          tenant_id: ctx.tenantId,
          user_id: ctx.userId,
          title: `Ticket escalated: ${ticket.title}`,
          body: args.reason || 'Escalated via MCP',
          type: 'ticket_escalation',
          metadata: { ticket_id: args.ticket_id, reason: args.reason },
        });

        return ticket;
      },
      buildReceipt: (ticket) => ({
        action_id: '',
        status: 'verified',
        timestamp: new Date().toISOString(),
        entity_type: 'ticket',
        entity_id: String((ticket as { id: string }).id),
      }),
    });

    if (!gateway.ok) {
      return okResult('escalate_ticket', { success: false, error: gateway.error });
    }
    return okResult('escalate_ticket', { ticket: gateway.result }, { receipt: gateway.receipt || undefined });
  },
});

defineConnectorTool({
  module: 'tickets-ops',
  name: 'summarize_ticket',
  description: 'Summarize ticket context for support agents.',
  permission: 'support:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    ticket_id: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      ticket_id: { type: 'string' },
    },
    required: ['ticket_id'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const { data: ticket } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', args.ticket_id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    return okResult('summarize_ticket', {
      ticket_id: args.ticket_id,
      summary: ticket
        ? `Ticket: ${ticket.title} (Priority: ${ticket.priority}). Description: ${ticket.description}`
        : `Ticket ${args.ticket_id} not found.`,
    });
  },
});
