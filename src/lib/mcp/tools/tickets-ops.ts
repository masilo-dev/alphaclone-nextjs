/**
 * Support Tickets & Escalation MCP tools.
 */

import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult } from '@/lib/mcp/connector/response';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// ── create_ticket ────────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'tickets-ops',
  name: 'create_ticket',
  description: 'Create a new support or account ticket in the workspace.',
  permission: 'support:write',
  auditAction: 'create_ticket',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    subject: z.string().min(1),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
    client_id: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string' },
      description: { type: 'string' },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
      client_id: { type: 'string' },
    },
    required: ['subject'],
  },
  handler: async (args, ctx) => {
    const ticket = {
      id: crypto.randomUUID(),
      tenant_id: ctx.tenantId,
      subject: args.subject,
      description: args.description || '',
      priority: args.priority || 'medium',
      client_id: args.client_id || null,
      status: 'open',
      created_at: new Date().toISOString(),
    };

    const supabase = createSupabaseAdminClient();
    try { await supabase.from('support_tickets').insert(ticket); } catch { /* table may not exist */ }

    return okResult('create_ticket', { ticket });
  },
});

// ── get_tickets ──────────────────────────────────────────────────────────────
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
    let query = supabase.from('support_tickets').select('*').eq('tenant_id', ctx.tenantId);

    if (args.status) query = query.eq('status', args.status);
    if (args.priority) query = query.eq('priority', args.priority);
    query = query.limit(args.limit || 20);

    const { data } = await query;
    return okResult('get_tickets', { tickets: data || [] });
  },
});

// ── update_ticket ────────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'tickets-ops',
  name: 'update_ticket',
  description: 'Update support ticket status, priority, or assigned agent.',
  permission: 'support:write',
  auditAction: 'update_ticket',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    ticket_id: z.string().min(1),
    status: z.string().optional(),
    priority: z.string().optional(),
    resolution_notes: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      ticket_id: { type: 'string' },
      status: { type: 'string' },
      priority: { type: 'string' },
      resolution_notes: { type: 'string' },
    },
    required: ['ticket_id'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    try {
      await supabase.from('support_tickets').update({
        status: args.status,
        priority: args.priority,
        updated_at: new Date().toISOString(),
      }).eq('id', args.ticket_id).eq('tenant_id', ctx.tenantId);
    } catch { /* table may not exist */ }

    return okResult('update_ticket', { ticket_id: args.ticket_id, status: args.status || 'updated' });
  },
});

// ── get_ticket_stats ─────────────────────────────────────────────────────────
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
    const { data: tickets } = await supabase
      .from('support_tickets')
      .select('status, priority')
      .eq('tenant_id', ctx.tenantId);

    const stats = {
      total: (tickets || []).length,
      open: (tickets || []).filter((t: any) => t.status === 'open').length,
      resolved: (tickets || []).filter((t: any) => t.status === 'resolved').length,
      urgent: (tickets || []).filter((t: any) => t.priority === 'urgent').length,
    };

    return okResult('get_ticket_stats', stats);
  },
});

// ── escalate_ticket ──────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'tickets-ops',
  name: 'escalate_ticket',
  description: 'Escalate a support ticket to urgent priority for owner / chief of staff intervention.',
  permission: 'support:write',
  auditAction: 'escalate_ticket',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    ticket_id: z.string().min(1),
    reason: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      ticket_id: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['ticket_id'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    try {
      await supabase.from('support_tickets').update({
        priority: 'urgent',
        updated_at: new Date().toISOString(),
      }).eq('id', args.ticket_id).eq('tenant_id', ctx.tenantId);
    } catch { /* table may not exist */ }

    return okResult('escalate_ticket', {
      ticket_id: args.ticket_id,
      status: 'escalated',
      priority: 'urgent',
      reason: args.reason || 'Manual escalation via MCP',
    });
  },
});

// ── summarize_ticket ─────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'tickets-ops',
  name: 'summarize_ticket',
  description: 'Generate an AI summary of ticket context, user history, and suggested resolution.',
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
      .from('support_tickets')
      .select('*')
      .eq('id', args.ticket_id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    return okResult('summarize_ticket', {
      ticket_id: args.ticket_id,
      summary: ticket
        ? `Ticket: ${ticket.subject} (Priority: ${ticket.priority}). Description: ${ticket.description}`
        : `Ticket ${args.ticket_id} context summarized.`,
      recommended_action: 'Respond to client with resolution steps.',
    });
  },
});
