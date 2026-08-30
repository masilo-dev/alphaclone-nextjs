import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { OperationsService } from '@/services/operationsService';
import { okResult } from '@/lib/mcp/connector/response';

defineConnectorTool({
  module: 'operations',
  name: 'get_today_operational_hud',
  description:
    'Real-time operational HUD: tasks due today, overdue work, pending client SLAs, blockers, approvals, and failures.',
  permission: 'operations:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const data = await OperationsService.getTodayHUD(args.tenant_id);
    return okResult('get_today_operational_hud', data);
  },
});

defineConnectorTool({
  module: 'operations',
  name: 'get_business_health_summary',
  description:
    'High-level operational health: project risks, SLA compliance, bottlenecks, outstanding revenue, and blockers.',
  permission: 'operations:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const data = await OperationsService.getBusinessHealth(args.tenant_id);
    return okResult('get_business_health_summary', data);
  },
});

defineConnectorTool({
  module: 'operations',
  name: 'ask_bonnie_operations',
  description:
    'Ask Bonnie a natural-language operations question. Returns exception-based intelligence with evidence labels.',
  permission: 'operations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    query: z.string().min(3),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      query: { type: 'string', description: 'Natural language operations question' },
    },
    required: ['tenant_id', 'query'],
  },
  handler: async (args) => {
    const data = await OperationsService.askBonnieOperations(args.tenant_id, args.query);
    return okResult('ask_bonnie_operations', data);
  },
});
