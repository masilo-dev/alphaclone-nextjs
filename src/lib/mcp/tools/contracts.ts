import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import crypto from 'crypto';

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
    const token = crypto.randomUUID();

    const { data, error } = await supabase
      .from('contracts')
      .update({
        signing_token: token,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.contract_id)
      .eq('tenant_id', args.tenant_id)
      .select('id, title, signing_token')
      .single();

    if (error) throw error;

    return {
      contract_id: data.id,
      title: data.title,
      signing_token: data.signing_token,
      signing_link: `/sign-contract?token=${data.signing_token}`,
    };
  },
});
