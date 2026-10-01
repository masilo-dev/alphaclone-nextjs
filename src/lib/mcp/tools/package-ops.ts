import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult } from '@/lib/mcp/connector/response';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  checkActionReadiness,
  previewSendPackage,
  verifyApprovalToken,
} from '@/services/documents/sendPackageService';

defineConnectorTool({
  module: 'package-ops',
  name: 'check_action_readiness',
  description:
    'Pre-flight consolidated check before sending any quote, contract, invoice, or package. Validates customer identity, currencies, amounts, document content, branding, provider connection, and returns non-blocking warnings vs blocking errors.',
  permission: 'crm:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    action: z.enum(['send_quote', 'send_contract', 'send_invoice', 'send_package']),
    customer_id: z.string().uuid().optional(),
    customer_email: z.string().email().optional(),
    quote_id: z.string().uuid().optional(),
    contract_id: z.string().uuid().optional(),
    invoice_id: z.string().uuid().optional(),
    currency: z.string().optional(),
    total_amount: z.number().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      action: { type: 'string', enum: ['send_quote', 'send_contract', 'send_invoice', 'send_package'] },
      customer_id: { type: 'string', format: 'uuid' },
      customer_email: { type: 'string', format: 'email' },
      quote_id: { type: 'string', format: 'uuid' },
      contract_id: { type: 'string', format: 'uuid' },
      invoice_id: { type: 'string', format: 'uuid' },
      currency: { type: 'string' },
      total_amount: { type: 'number' },
    },
    required: ['tenant_id', 'action'],
  },
  handler: async (args) => {
    const result = await checkActionReadiness({
      tenantId: args.tenant_id,
      action: args.action,
      customerId: args.customer_id,
      customerEmail: args.customer_email,
      quoteId: args.quote_id,
      contractId: args.contract_id,
      invoiceId: args.invoice_id,
      currency: args.currency,
      totalAmount: args.total_amount,
    });
    return okResult('check_action_readiness', result);
  },
});

defineConnectorTool({
  module: 'package-ops',
  name: 'preview_send_package',
  description:
    'Preview a document dispatch package before sending. Shows exact recipient, sender, subject, body preview, attachment filenames & SHA-256 checksums, and returns a cryptographic approval token.',
  permission: 'crm:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    recipient_email: z.string().email(),
    recipient_name: z.string().optional(),
    package_type: z.enum(['quote', 'contract', 'invoice', 'complete_client_package']),
    quote_id: z.string().uuid().optional(),
    contract_id: z.string().uuid().optional(),
    invoice_id: z.string().uuid().optional(),
    custom_message: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      recipient_email: { type: 'string', format: 'email' },
      recipient_name: { type: 'string' },
      package_type: { type: 'string', enum: ['quote', 'contract', 'invoice', 'complete_client_package'] },
      quote_id: { type: 'string', format: 'uuid' },
      contract_id: { type: 'string', format: 'uuid' },
      invoice_id: { type: 'string', format: 'uuid' },
      custom_message: { type: 'string' },
    },
    required: ['tenant_id', 'recipient_email', 'package_type'],
  },
  handler: async (args) => {
    const result = await previewSendPackage({
      tenantId: args.tenant_id,
      recipientEmail: args.recipient_email,
      recipientName: args.recipient_name,
      packageType: args.package_type,
      quoteId: args.quote_id,
      contractId: args.contract_id,
      invoiceId: args.invoice_id,
      customMessage: args.custom_message,
    });
    return okResult('preview_send_package', result);
  },
});

defineConnectorTool({
  module: 'package-ops',
  name: 'get_document_package',
  description:
    'Retrieve an aggregated view of a client document package linking quotation, contract, invoice, and generated PDF attachments.',
  permission: 'crm:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    client_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      client_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'client_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const [{ data: client }, { data: quotes }, { data: contracts }, { data: invoices }] =
      await Promise.all([
        supabase
          .from('business_clients')
          .select('*')
          .eq('tenant_id', args.tenant_id)
          .eq('id', args.client_id)
          .maybeSingle(),
        supabase
          .from('quotes')
          .select('id, name, status, currency, total_amount, created_at')
          .eq('tenant_id', args.tenant_id)
          .eq('client_id', args.client_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('contracts')
          .select('id, title, status, total_amount, created_at')
          .eq('tenant_id', args.tenant_id)
          .eq('client_id', args.client_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('business_invoices')
          .select('id, invoice_number, status, currency, total, created_at')
          .eq('tenant_id', args.tenant_id)
          .eq('client_id', args.client_id)
          .order('created_at', { ascending: false }),
      ]);

    return okResult('get_document_package', {
      success: true,
      client: client || null,
      quotes: quotes || [],
      contracts: contracts || [],
      invoices: invoices || [],
      has_active_package: Boolean(
        (quotes && quotes.length > 0) ||
        (contracts && contracts.length > 0) ||
        (invoices && invoices.length > 0)
      ),
    });
  },
});
