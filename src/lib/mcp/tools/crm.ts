import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// 1. get_contacts
registerTool('crm', {
  name: 'get_contacts',
  description: 'Retrieve contacts for the given tenant, optionally filtered by status or search terms.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    limit: z.number().optional().default(50),
    search: z.string().optional(),
    status: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid', description: 'Tenant UUID' },
      limit: { type: 'number', description: 'Max contacts to retrieve (default: 50)' },
      search: { type: 'string', description: 'Filter by name or email search term' },
      status: { type: 'string', description: 'Filter by status (e.g. lead, customer)' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('crm_contacts')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .is('deleted_at', null)
      .limit(args.limit);

    if (args.status) {
      query = query.eq('status', args.status);
    }
    if (args.search) {
      query = query.or(`name.ilike.%${args.search}%,email.ilike.%${args.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
});

// 2. create_contact
registerTool('crm', {
  name: 'create_contact',
  description: 'Create a new contact in the CRM.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    company: z.string().optional(),
    status: z.string().optional().default('lead'),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      company: { type: 'string' },
      status: { type: 'string', default: 'lead' },
    },
    required: ['tenant_id', 'name', 'email'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('crm_contacts')
      .insert({
        tenant_id: args.tenant_id,
        name: args.name,
        email: args.email,
        phone: args.phone || null,
        company: args.company || null,
        status: args.status,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 3. update_contact
registerTool('crm', {
  name: 'update_contact',
  description: 'Update an existing CRM contact.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    contact_id: z.string().uuid(),
    fields: z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      status: z.string().optional(),
    }),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      contact_id: { type: 'string', format: 'uuid' },
      fields: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          company: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
    required: ['tenant_id', 'contact_id', 'fields'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('crm_contacts')
      .update({
        ...args.fields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.contact_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 4. delete_contact
registerTool('crm', {
  name: 'delete_contact',
  description: 'Soft delete a contact.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    contact_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      contact_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'contact_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('crm_contacts')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', args.contact_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, message: `Contact ${args.contact_id} soft deleted.` };
  },
});

// 5. get_contact_activity
registerTool('crm', {
  name: 'get_contact_activity',
  description: 'Retrieve activity logs for a specific contact.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    contact_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      contact_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'contact_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('crm_activities')
      .select('*')
      .eq('contact_id', args.contact_id)
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
});

// 6. log_contact_activity
registerTool('crm', {
  name: 'log_contact_activity',
  description: 'Log an interaction (call, email, meeting, note) with a contact.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    contact_id: z.string().uuid(),
    type: z.enum(['call', 'email', 'meeting', 'note']),
    notes: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      contact_id: { type: 'string', format: 'uuid' },
      type: { type: 'string', enum: ['call', 'email', 'meeting', 'note'] },
      notes: { type: 'string' },
    },
    required: ['tenant_id', 'contact_id', 'type'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('crm_activities')
      .insert({
        tenant_id: args.tenant_id,
        contact_id: args.contact_id,
        type: args.type,
        notes: args.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});
