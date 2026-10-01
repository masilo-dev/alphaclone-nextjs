import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult } from '@/lib/mcp/connector/response';
import { executeClientLifecycle } from '@/services/lifecycle/clientLifecycleCoordinator';

defineConnectorTool({
  module: 'lifecycle-ops',
  name: 'execute_client_lifecycle',
  description:
    'One-command coordinated execution of the complete client lifecycle: prospect lead → qualify & convert client/contact → deal → quote → contract → invoice → client portal access. Preserves identical currency, amounts, customer identity, and persists durable workflow state.',
  permission: 'crm:write',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    prospect_name: z.string().min(1),
    prospect_email: z.string().email(),
    amount: z.number().positive(),
    currency: z.string().default('EUR'),
    service_title: z.string().optional(),
    governing_law: z.string().optional(),
    is_test_data: z.boolean().default(false),
    test_run_id: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      prospect_name: { type: 'string' },
      prospect_email: { type: 'string', format: 'email' },
      amount: { type: 'number' },
      currency: { type: 'string', default: 'EUR' },
      service_title: { type: 'string' },
      governing_law: { type: 'string' },
      is_test_data: { type: 'boolean' },
      test_run_id: { type: 'string' },
    },
    required: ['tenant_id', 'prospect_name', 'prospect_email', 'amount'],
  },
  handler: async (args, ctx) => {
    const result = await executeClientLifecycle({
      tenantId: args.tenant_id,
      userId: ctx.userId,
      prospectName: args.prospect_name,
      prospectEmail: args.prospect_email,
      amount: args.amount,
      currency: args.currency,
      serviceTitle: args.service_title,
      governingLaw: args.governing_law,
      isTestData: args.is_test_data,
      testRunId: args.test_run_id,
    });
    return okResult('execute_client_lifecycle', result);
  },
});
