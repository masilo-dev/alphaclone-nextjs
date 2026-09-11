import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';
import { runVerification } from '@/services/automation/runtimeService';
import {
  getAutomationFailureReport,
  getAutomationHealth,
  getAutomationThroughputReport,
  reconcileOutreachVsLogs,
} from '@/services/automation/observabilityService';

defineConnectorTool({
  module: 'verification-ops',
  name: 'verify_lead_created',
  description: 'Verify a CRM lead exists after create/match. Fast read-only check — no side effects.',
  permission: 'crm:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    lead_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      lead_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'lead_id'],
  },
  handler: async (args) => {
    if (!args.lead_id) throwConnectorError('VALIDATION_ERROR', 'lead_id is required');
    const result = await runVerification('verify_lead_created', args.tenant_id, {
      lead_id: args.lead_id,
    });
    return okResult('verify_lead_created', result);
  },
});

defineConnectorTool({
  module: 'verification-ops',
  name: 'verify_outreach_delivery',
  description: 'Verify outreach delivery status from lead_outreach_log.',
  permission: 'crm:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    tracking_id: z.string().optional(),
    log_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      tracking_id: { type: 'string' },
      log_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const result = await runVerification('verify_outreach_delivery', args.tenant_id, {
      tracking_id: args.tracking_id,
      log_id: args.log_id,
    });
    return okResult('verify_outreach_delivery', result);
  },
});

defineConnectorTool({
  module: 'verification-ops',
  name: 'verify_social_post_published',
  description: 'Verify a social post reached published state.',
  permission: 'social:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    social_post_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      social_post_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'social_post_id'],
  },
  handler: async (args) => {
    const result = await runVerification('verify_social_post_published', args.tenant_id, {
      social_post_id: args.social_post_id,
    });
    return okResult('verify_social_post_published', result);
  },
});

defineConnectorTool({
  module: 'verification-ops',
  name: 'verify_invoice_sent',
  description: 'Verify an invoice was sent or paid.',
  permission: 'finance:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    invoice_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      invoice_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'invoice_id'],
  },
  handler: async (args) => {
    const result = await runVerification('verify_invoice_sent', args.tenant_id, {
      invoice_id: args.invoice_id,
    });
    return okResult('verify_invoice_sent', result);
  },
});

defineConnectorTool({
  module: 'verification-ops',
  name: 'get_automation_health',
  description: 'Automation run health summary for the last 24 hours.',
  permission: 'crm:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    try {
      const health = await getAutomationHealth(args.tenant_id);
      return okResult('get_automation_health', health);
    } catch (err) {
      return okResult('get_automation_health', {
        success: false,
        error: err instanceof Error ? err.message : 'Automation health check failed',
        window_hours: 24,
        total_runs: 0,
        status_counts: {},
      });
    }
  },
});

defineConnectorTool({
  module: 'verification-ops',
  name: 'get_failure_report',
  description: 'Recent failed automation run steps.',
  permission: 'crm:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(200).optional().default(50),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const report = await getAutomationFailureReport(args.tenant_id, args.limit ?? 50);
    return okResult('get_failure_report', report);
  },
});

defineConnectorTool({
  module: 'verification-ops',
  name: 'get_throughput_report',
  description: 'Automation throughput over a time window.',
  permission: 'crm:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    hours: z.number().int().min(1).max(720).optional().default(24),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      hours: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const report = await getAutomationThroughputReport(args.tenant_id, args.hours ?? 24);
    return okResult('get_throughput_report', report);
  },
});

defineConnectorTool({
  module: 'verification-ops',
  name: 'reconcile_outreach_vs_logs',
  description: 'Compare outreach queue vs delivery logs for stale/failed sends.',
  permission: 'crm:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(500).optional().default(100),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const report = await reconcileOutreachVsLogs(args.tenant_id, args.limit ?? 100);
    return okResult('reconcile_outreach_vs_logs', report);
  },
});
