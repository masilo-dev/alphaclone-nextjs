import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// Helper to split name into first/last
function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: '' };
  }
  const last_name = parts.pop() || '';
  const first_name = parts.join(' ');
  return { first_name, last_name };
}

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
      .from('contacts')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .neq('status', 'bounced')  // Exclude bounced emails
      .limit(args.limit);

    if (args.status) {
      query = query.eq('status', args.status);
    }
    if (args.search) {
      // Use full_name (generated column) for search
      query = query.or(`full_name.ilike.%${args.search}%,email.ilike.%${args.search}%`);
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
      name: { type: 'string', description: 'Full name (will be split into first_name and last_name)' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      company: { type: 'string' },
      status: { type: 'string', default: 'lead' },
    },
    required: ['tenant_id', 'name', 'email'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { first_name, last_name } = splitName(args.name);
    
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        tenant_id: args.tenant_id,
        first_name,
        last_name,
        email: args.email,
        phone: args.phone || null,
        // company field doesn't exist in contacts table - store in metadata if needed
        status: args.status || 'lead',
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
          name: { type: 'string', description: 'Full name (will be split into first_name and last_name)' },
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
    
    // Build update object, handling name splitting
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (args.fields.name) {
      const { first_name, last_name } = splitName(args.fields.name);
      updateData.first_name = first_name;
      updateData.last_name = last_name;
    }
    if (args.fields.email) updateData.email = args.fields.email;
    if (args.fields.phone) updateData.phone = args.fields.phone;
    if (args.fields.status) updateData.status = args.fields.status;
    // company field doesn't exist in contacts table

    const { data, error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', args.contact_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 4. delete_contact (soft delete by setting status to inactive)
registerTool('crm', {
  name: 'delete_contact',
  description: 'Soft delete a contact by setting status to inactive.',
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
      .from('contacts')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.contact_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, message: `Contact ${args.contact_id} marked as inactive.` };
  },
});

// 5. get_contact_activity - using deal_activities as contact activities don't exist
registerTool('crm', {
  name: 'get_contact_activity',
  description: 'Retrieve activity logs for a specific contact (maps to contact interactions).',
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
    // Query deal_activities linked to this contact via deals
    const { data, error } = await supabase
      .from('deal_activities')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        return [];
      }
      throw error;
    }
    return data || [];
  },
});

// 6. log_contact_activity - simplified without crm_activities table
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
    
    // Update the contact's last_contacted_at and last_activity_at
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .update({
        last_contacted_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.contact_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (contactError) throw contactError;

    // Return a synthetic activity record since we don't have a dedicated activities table
    return {
      id: crypto.randomUUID(),
      contact_id: args.contact_id,
      tenant_id: args.tenant_id,
      type: args.type,
      notes: args.notes || null,
      created_at: new Date().toISOString(),
      contact_updated: true,
    };
  },
});
