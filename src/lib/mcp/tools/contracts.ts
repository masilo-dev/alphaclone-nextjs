import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import crypto from 'crypto';
import { AppUrls } from '@/lib/urls';

// 1. get_contracts
registerTool('contracts', {
  name: 'get_contracts',
  description: 'Retrieve contracts for the tenant, optionally filtered by status.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    status: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      status: { type: 'string', description: 'Filter by contract status (e.g. draft, sent, signed)' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('contracts')
      .select('*')
      .eq('tenant_id', args.tenant_id);

    if (args.status) {
      query = query.eq('status', args.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
});

// 2. create_contract
registerTool('contracts', {
  name: 'create_contract',
  description: 'Create a new contract or proposal.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    client_id: z.string().uuid().optional(),
    title: z.string(),
    content: z.string(),
    status: z.string().optional().default('draft'),
    type: z.string().optional().default('service_agreement'),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      client_id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      content: { type: 'string', description: 'The complete text / body of the contract' },
      status: { type: 'string', default: 'draft' },
      type: { type: 'string', default: 'service_agreement' },
    },
    required: ['tenant_id', 'title', 'content'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('contracts')
      .insert({
        tenant_id: args.tenant_id,
        client_id: args.client_id || null,
        title: args.title,
        content: args.content,
        status: args.status,
        type: args.type,
      })
      .select()
      .single();

    if (error) throw error;

    const { notifyContractCreated } = await import(
      '@/services/contractNotificationService'
    );
    await notifyContractCreated(args.tenant_id, data.id, data.title).catch((err) =>
      console.error('[create_contract] notify failed:', err)
    );

    return data;
  },
});

// 3. update_contract_status
registerTool('contracts', {
  name: 'update_contract_status',
  description: 'Update the status of an existing contract.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    contract_id: z.string().uuid(),
    status: z.string(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      contract_id: { type: 'string', format: 'uuid' },
      status: { type: 'string', description: 'New contract status (e.g. sent, signed, cancelled)' },
    },
    required: ['tenant_id', 'contract_id', 'status'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('contracts')
      .update({
        status: args.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.contract_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 4. generate_contract_signing_token
registerTool('contracts', {
  name: 'generate_contract_signing_token',
  description: 'Generate a secure signing token for a contract and return the signing link.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    contract_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      contract_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'contract_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, title, client_id')
      .eq('id', args.contract_id)
      .eq('tenant_id', args.tenant_id)
      .single();

    if (contractError || !contract) {
      throw new Error('Contract not found');
    }

    let clientEmail = '';
    if (contract.client_id) {
      const { resolvePartyEmail } = await import(
        '@/lib/contracts/contractCoherenceServer'
      );
      clientEmail = (await resolvePartyEmail(supabase, args.tenant_id, contract.client_id)) || '';
    }

    const { error: tokenError } = await supabase.from('contract_signing_tokens').insert({
      tenant_id: args.tenant_id,
      contract_id: args.contract_id,
      token,
      signer_email: clientEmail || 'client@example.com',
      signer_role: 'client',
      expires_at: expiresAt,
      metadata: { source: 'mcp_generate_contract_signing_token' },
    });

    if (tokenError) throw tokenError;

    return {
      contract_id: contract.id,
      title: contract.title,
      signing_token: token,
      signing_link: AppUrls.signContract(token),
      expires_at: expiresAt,
    };
  },
});

// 5. send_contract
registerTool('contracts', {
  name: 'send_contract',
  description: 'Send a contract for review and digital signature. Generates a PDF of the contract and emails a secure signature link to the recipient using the tenant-configured email provider.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    contract_id: z.string().uuid(),
    recipient_email: z.string().email().optional(),
    subject: z.string().optional(),
    message: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      contract_id: { type: 'string', format: 'uuid' },
      recipient_email: { type: 'string', format: 'email', description: 'Override recipient email. If omitted, uses email from the linked client.' },
      subject: { type: 'string', description: 'Optional custom email subject' },
      message: { type: 'string', description: 'Optional custom email body message' },
    },
    required: ['tenant_id', 'contract_id'],
  },
  handler: async (args, context) => {
    const supabase = createSupabaseAdminClient();
    const userId = context.userId || '';

    // If recipient_email is not provided, try to fetch it from the contract's client
    let toEmail = args.recipient_email;
    if (!toEmail) {
      const { data: contract } = await supabase
        .from('contracts')
        .select('client_id')
        .eq('id', args.contract_id)
        .single();
      
      if (contract?.client_id) {
        const { resolvePartyEmail } = await import(
          '@/lib/contracts/contractCoherenceServer'
        );
        toEmail = (await resolvePartyEmail(supabase, args.tenant_id, contract.client_id)) || undefined;
      }
    }

    if (!toEmail) {
      throw new Error('Recipient email is required (could not resolve from contract/client)');
    }

    const { sendContract } = await import('@/app/api/contracts/management/route');
    const result = await sendContract(
      args.tenant_id,
      {
        contractId: args.contract_id,
        recipients: toEmail,
        subject: args.subject,
        message: args.message,
      },
      supabase,
      userId
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to send contract');
    }

    const { data: contractRow } = await supabase
      .from('contracts')
      .select('title')
      .eq('id', args.contract_id)
      .eq('tenant_id', args.tenant_id)
      .maybeSingle();

    const sentAt = new Date().toISOString();
    const { notifyContractSent } = await import(
      '@/services/contractNotificationService'
    );
    await notifyContractSent(
      args.tenant_id,
      args.contract_id,
      contractRow?.title || 'Contract',
      toEmail,
      userId
    ).catch((err) => console.error('[send_contract] notify failed:', err));

    return {
      sent: true,
      sent_to: toEmail,
      sent_at: sentAt,
      status: 'sent',
      message: 'Contract successfully sent to client',
      recipient: toEmail,
      signing_url: result.signingUrl,
    };
  },
});
