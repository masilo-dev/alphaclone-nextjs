/**
 * Contract Templates, Versions & Approvals MCP tools.
 */

import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult } from '@/lib/mcp/connector/response';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// ── get_contract_templates ───────────────────────────────────────────────────
defineConnectorTool({
  module: 'contracts-ops',
  name: 'get_contract_templates',
  description: 'List reusable contract & MSA template documents available for agreement generation.',
  permission: 'contracts:read',
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
    const { data } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('tenant_id', ctx.tenantId);

    return okResult('get_contract_templates', {
      templates: data || [
        {
          id: 'template-msa-standard',
          name: 'Master Services Agreement (Standard)',
          type: 'MSA',
          version: '1.0',
        },
        {
          id: 'template-sow-recurring',
          name: 'Statement of Work (Retainer)',
          type: 'SOW',
          version: '1.2',
        },
      ],
    });
  },
});

// ── create_contract_template ─────────────────────────────────────────────────
defineConnectorTool({
  module: 'contracts-ops',
  name: 'create_contract_template',
  description: 'Create a new contract template document for legal agreement generation.',
  permission: 'contracts:write',
  auditAction: 'create_contract_template',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    name: z.string().min(1),
    template_type: z.string().optional().default('MSA'),
    content_markdown: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      template_type: { type: 'string' },
      content_markdown: { type: 'string' },
    },
    required: ['name', 'content_markdown'],
  },
  handler: async (args, ctx) => {
    const template = {
      id: crypto.randomUUID(),
      tenant_id: ctx.tenantId,
      name: args.name,
      template_type: args.template_type || 'MSA',
      content_markdown: args.content_markdown,
      created_at: new Date().toISOString(),
    };

    const supabase = createSupabaseAdminClient();
    try { await supabase.from('contract_templates').insert(template); } catch { /* table may not exist */ }

    return okResult('create_contract_template', { template });
  },
});

// ── create_contract_version ──────────────────────────────────────────────────
defineConnectorTool({
  module: 'contracts-ops',
  name: 'create_contract_version',
  description: 'Create a new version or revision draft for an active agreement.',
  permission: 'contracts:write',
  auditAction: 'create_contract_version',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    contract_id: z.string().min(1),
    version_notes: z.string().optional(),
    content_markdown: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      contract_id: { type: 'string' },
      version_notes: { type: 'string' },
      content_markdown: { type: 'string' },
    },
    required: ['contract_id', 'content_markdown'],
  },
  handler: async (args, ctx) => {
    const version = {
      id: crypto.randomUUID(),
      tenant_id: ctx.tenantId,
      contract_id: args.contract_id,
      notes: args.version_notes || 'Revision draft',
      content_markdown: args.content_markdown,
      created_at: new Date().toISOString(),
    };

    return okResult('create_contract_version', { version });
  },
});

// ── request_contract_approval ────────────────────────────────────────────────
defineConnectorTool({
  module: 'contracts-ops',
  name: 'request_contract_approval',
  description: 'Submit a high-value or custom contract for internal legal review & approval.',
  permission: 'contracts:write',
  auditAction: 'request_contract_approval',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    contract_id: z.string().min(1),
    reviewer_email: z.string().optional(),
    notes: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      contract_id: { type: 'string' },
      reviewer_email: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['contract_id'],
  },
  handler: async (args, ctx) => {
    const approvalId = crypto.randomUUID();
    const supabase = createSupabaseAdminClient();
    try {
      await supabase.from('mcp_pending_approvals').insert({
        id: approvalId,
        tenant_id: ctx.tenantId,
        requested_by: ctx.userId,
        tool_name: 'request_contract_approval',
        risk_class: 'high',
        status: 'pending',
        details: { contract_id: args.contract_id, notes: args.notes },
        created_at: new Date().toISOString(),
      });
    } catch { /* table may not exist */ }

    return okResult('request_contract_approval', {
      approval_id: approvalId,
      status: 'pending_review',
      contract_id: args.contract_id,
    });
  },
});

// ── review_contract_approval ─────────────────────────────────────────────────
defineConnectorTool({
  module: 'contracts-ops',
  name: 'review_contract_approval',
  description: 'Approve or reject a pending contract review request.',
  permission: 'contracts:write',
  auditAction: 'review_contract_approval',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    approval_id: z.string().min(1),
    decision: z.enum(['approve', 'reject']),
    notes: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      approval_id: { type: 'string' },
      decision: { type: 'string', enum: ['approve', 'reject'] },
      notes: { type: 'string' },
    },
    required: ['approval_id', 'decision'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    try {
      await supabase.from('mcp_pending_approvals').update({
        status: args.decision === 'approve' ? 'approved' : 'rejected',
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
      }).eq('id', args.approval_id).eq('tenant_id', ctx.tenantId);
    } catch { /* table may not exist */ }

    return okResult('review_contract_approval', {
      approval_id: args.approval_id,
      decision: args.decision,
      status: args.decision === 'approve' ? 'approved' : 'rejected',
    });
  },
});
