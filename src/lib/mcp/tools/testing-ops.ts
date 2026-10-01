import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult } from '@/lib/mcp/connector/response';
import { cleanupTestRun } from '@/services/testing/testModeService';

defineConnectorTool({
  module: 'testing-ops',
  name: 'cleanup_test_run',
  description:
    'Clean up test data records created during test runs. Safely removes leads, contacts, clients, deals, quotes, contracts, invoices, and projects in reverse dependency order without touching real production data.',
  permission: 'crm:write',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    test_run_id: z.string().optional(),
    lead_id: z.string().uuid().optional(),
    client_id: z.string().uuid().optional(),
    contact_id: z.string().uuid().optional(),
    deal_id: z.string().uuid().optional(),
    quote_id: z.string().uuid().optional(),
    contract_id: z.string().uuid().optional(),
    invoice_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    document_ids: z.array(z.string()).optional(),
    dry_run: z.boolean().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      test_run_id: { type: 'string' },
      lead_id: { type: 'string', format: 'uuid' },
      client_id: { type: 'string', format: 'uuid' },
      contact_id: { type: 'string', format: 'uuid' },
      deal_id: { type: 'string', format: 'uuid' },
      quote_id: { type: 'string', format: 'uuid' },
      contract_id: { type: 'string', format: 'uuid' },
      invoice_id: { type: 'string', format: 'uuid' },
      project_id: { type: 'string', format: 'uuid' },
      document_ids: { type: 'array', items: { type: 'string' } },
      dry_run: { type: 'boolean' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const result = await cleanupTestRun({
      tenantId: args.tenant_id,
      testRunId: args.test_run_id,
      leadId: args.lead_id,
      clientId: args.client_id,
      contactId: args.contact_id,
      dealId: args.deal_id,
      quoteId: args.quote_id,
      contractId: args.contract_id,
      invoiceId: args.invoice_id,
      projectId: args.project_id,
      documentIds: args.document_ids,
      dryRun: args.dry_run,
    });
    return okResult('cleanup_test_run', result);
  },
});
