import { OperationsService } from '@/services/operationsService';

export const OPERATIONS_MCP_TOOLS = [
  {
    name: 'get_today_operational_hud',
    description: 'Get real-time operational HUD including tasks due today, overdue work, pending client 24h SLAs, active blockers, pending approvals, and failures.',
    parameters: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Tenant workspace UUID' },
      },
      required: ['tenantId'],
    },
    execute: async ({ tenantId }: { tenantId: string }) => {
      return await OperationsService.getTodayHUD(tenantId);
    },
  },
  {
    name: 'get_business_health_summary',
    description: 'Get high-level operational business health including project risks, 24h SLA compliance %, primary operational bottleneck, outstanding revenue, and blocker summary.',
    parameters: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Tenant workspace UUID' },
      },
      required: ['tenantId'],
    },
    execute: async ({ tenantId }: { tenantId: string }) => {
      return await OperationsService.getBusinessHealth(tenantId);
    },
  },
  {
    name: 'ask_bonnie_operations',
    description: 'Ask Bonnie a natural language operational question to get exception-based intelligence with evidence quality labels (MEASURED, ESTIMATED, PREDICTED, UNKNOWN).',
    parameters: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Tenant workspace UUID' },
        query: { type: 'string', description: 'User natural language question about business operations' },
      },
      required: ['tenantId', 'query'],
    },
    execute: async ({ tenantId, query }: { tenantId: string; query: string }) => {
      return await OperationsService.askBonnieOperations(tenantId, query);
    },
  },
];
