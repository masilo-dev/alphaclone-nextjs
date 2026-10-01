import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { throwConnectorError } from '@/lib/mcp/connector/response';
import { getOrCreateClientPortalUrl, getClientFinancePortalData } from '@/services/finance/clientFinancePortalService';
import { AppUrls } from '@/lib/urls';
import crypto from 'crypto';

defineConnectorTool({
  module: 'portal-ops',
  name: 'enable_client_portal_access',
  description: 'Enable or refresh client portal credentials for a client, ensuring a valid finance portal token and secure access link.',
  permission: 'crm:write',
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
    const { data: client, error } = await supabase
      .from('business_clients')
      .select('id, name, email, finance_portal_token')
      .eq('id', args.client_id)
      .eq('tenant_id', args.tenant_id)
      .single();

    if (error || !client) {
      throwConnectorError('NOT_FOUND', 'Client not found');
    }

    let token = client.finance_portal_token;
    if (!token) {
      token = crypto.randomUUID();
      await supabase
        .from('business_clients')
        .update({
          finance_portal_token: token,
          updated_at: new Date().toISOString(),
        })
        .eq('id', args.client_id)
        .eq('tenant_id', args.tenant_id);
    }

    const portalUrl = AppUrls.clientFinancePortal(token);

    return {
      success: true,
      client_id: client.id,
      client_name: client.name,
      client_email: client.email,
      portal_token: token,
      portal_url: portalUrl,
      is_active: true,
    };
  },
});

defineConnectorTool({
  module: 'portal-ops',
  name: 'get_client_portal_status',
  description: 'Retrieve the client portal access status, portal URL, and login details for a client.',
  permission: 'crm:read',
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
    const { data: client, error } = await supabase
      .from('business_clients')
      .select('id, name, email, finance_portal_token, is_active, client_portal_last_login_at')
      .eq('id', args.client_id)
      .eq('tenant_id', args.tenant_id)
      .single();

    if (error || !client) {
      throwConnectorError('NOT_FOUND', 'Client not found');
    }

    const portalToken = client.finance_portal_token || null;
    const portalUrl = portalToken ? AppUrls.clientFinancePortal(portalToken) : null;

    return {
      client_id: client.id,
      client_name: client.name,
      client_email: client.email,
      portal_enabled: Boolean(portalToken),
      portal_token: portalToken,
      portal_url: portalUrl,
      is_active: client.is_active,
      last_login_at: client.client_portal_last_login_at,
    };
  },
});

defineConnectorTool({
  module: 'portal-ops',
  name: 'verify_client_portal_records',
  description: 'Verify all records visible to the client inside the portal (invoices, contracts, quotes, summary) under their portal token.',
  permission: 'crm:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    client_id: z.string().uuid().optional(),
    portal_token: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      client_id: { type: 'string', format: 'uuid' },
      portal_token: { type: 'string' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let token = args.portal_token;
    if (!token && args.client_id) {
      const { data: cl } = await supabase
        .from('business_clients')
        .select('finance_portal_token')
        .eq('id', args.client_id)
        .eq('tenant_id', args.tenant_id)
        .single();
      token = cl?.finance_portal_token;
    }

    if (!token) {
      throwConnectorError('BAD_REQUEST', 'portal_token or client_id with portal token is required');
    }

    const portalData = await getClientFinancePortalData(supabase, token);
    if (!portalData) {
      throwConnectorError('NOT_FOUND', 'Invalid portal token or inactive client');
    }

    return {
      success: true,
      client: portalData.client,
      branding: portalData.branding,
      invoices_count: portalData.invoices.length,
      invoices: portalData.invoices,
      quotes_count: portalData.quotes.length,
      contracts_count: portalData.contracts.length,
      summary: portalData.summary,
    };
  },
});
