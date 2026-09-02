import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUnifiedContacts } from '@/lib/crm/unifiedContacts';

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
    const contacts = await getUnifiedContacts(supabase, args.tenant_id, {
      limit: args.limit,
      search: args.search,
      status: args.status,
    });
    return contacts;
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

    if (args.email) {
      const { error: syncErr } = await supabase.from('business_clients').insert({
        tenant_id: args.tenant_id,
        name: args.name,
        email: args.email,
        phone: args.phone || null,
        company: args.company || args.name,
        sales_stage: args.status === 'customer' ? 'customer' : 'lead',
        is_active: true,
        crm_contact_id: data.id,
      });
      if (syncErr && !String(syncErr.message).includes('duplicate')) {
        console.warn('[create_contact] business_clients sync:', syncErr.message);
      }
    }

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

// 4. delete_contact (soft delete — sets deleted_at + archives linked client)
registerTool('crm', {
  name: 'delete_contact',
  description: 'Soft delete a contact (sets deleted_at and archives linked business client).',
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
    const { softDeleteContactById } = await import('@/lib/crm/softDeleteContact');
    const result = await softDeleteContactById(supabase, args.tenant_id, args.contact_id);
    if (result.error) throw new Error(result.error);
    return { success: true, message: `Contact ${args.contact_id} deleted.` };
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

    const { data: activities, error: actErr } = await supabase
      .from('activities')
      .select('id, type, subject, description, created_at, created_by, status, metadata')
      .eq('tenant_id', args.tenant_id)
      .eq('contact_id', args.contact_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (actErr && actErr.code !== '42P01') throw actErr;

    const { data: deals, error: dealsErr } = await supabase
      .from('deals')
      .select('id')
      .eq('tenant_id', args.tenant_id)
      .eq('contact_id', args.contact_id);

    if (dealsErr) throw dealsErr;
    const dealIds = (deals || []).map((d: { id: string }) => d.id);

    let dealActivities: unknown[] = [];
    if (dealIds.length > 0) {
      const { data, error } = await supabase
        .from('deal_activities')
        .select('id, deal_id, activity_type, title, description, created_at, user_id, metadata')
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error && error.code !== '42P01') throw error;
      dealActivities = (data || []).map((row: any) => ({
        id: row.id,
        type: row.activity_type,
        subject: row.title,
        description: row.description,
        created_at: row.created_at,
        created_by: row.user_id,
        source: 'deal_activity',
        metadata: { ...(row.metadata || {}), deal_id: row.deal_id },
      }));
    }

    const unified = [
      ...(activities || []).map((row: any) => ({
        id: row.id,
        type: row.type,
        subject: row.subject,
        description: row.description,
        created_at: row.created_at,
        created_by: row.created_by,
        source: 'activities',
        metadata: row.metadata || {},
      })),
      ...dealActivities,
    ].sort((a: unknown, b: unknown) => {
      const aAt = (a as { created_at?: unknown }).created_at;
      const bAt = (b as { created_at?: unknown }).created_at;
      return new Date(String(bAt)).getTime() - new Date(String(aAt)).getTime();
    });

    return unified.slice(0, 50);
  },
});

// 6. log_contact_activity — persisted in activities table
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
    const { logCrmActivityAdmin } = await import('@/lib/crm/crmActivityServer');

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .update({
        last_contacted_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.contact_id)
      .eq('tenant_id', args.tenant_id)
      .select('id, company_id, first_name, last_name, email')
      .single();

    if (contactError) throw contactError;

    const subjectMap: Record<string, string> = {
      call: 'Call logged',
      email: 'Email logged',
      meeting: 'Meeting logged',
      note: 'Note logged',
    };

    const activity = await logCrmActivityAdmin(supabase, {
      tenantId: args.tenant_id,
      contactId: args.contact_id,
      companyId: contact.company_id || undefined,
      type: args.type,
      subject: subjectMap[args.type] || 'Activity logged',
      description: args.notes || undefined,
      source: 'bonnie_mcp',
      metadata: { channel: args.type },
    });

    return {
      id: activity?.id || crypto.randomUUID(),
      contact_id: args.contact_id,
      tenant_id: args.tenant_id,
      type: args.type,
      notes: args.notes || null,
      created_at: new Date().toISOString(),
      persisted: Boolean(activity?.id),
    };
  },
});

function mapUnifiedToClientRow(contact: Awaited<ReturnType<typeof getUnifiedContacts>>[number]) {
  return {
    id: contact.id,
    name: contact.full_name,
    email: contact.email,
    phone: contact.phone,
    industry: null,
    location: null,
    sales_stage: contact.status,
    value: 0,
    website: null,
    is_active: contact.status !== 'inactive',
    created_at: contact.created_at,
  };
}

registerTool('crm', {
  name: 'get_clients',
  description: 'List CRM clients/contacts (unified contacts view). Alias for canonical contact reads.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    limit: z.number().optional().default(100),
    offset: z.number().optional().default(0),
    status: z.string().optional(),
    industry: z.string().optional(),
    search: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
      offset: { type: 'number' },
      status: { type: 'string' },
      industry: { type: 'string' },
      search: { type: 'string' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const pageSize = Math.min(Math.max(args.limit ?? 100, 1), 1000);
    const pageOffset = Math.max(args.offset ?? 0, 0);
    const contacts = await getUnifiedContacts(supabase, args.tenant_id, {
      limit: pageSize + pageOffset,
      search: args.search,
      status: args.status,
    });
    const page = contacts.slice(pageOffset, pageOffset + pageSize).map(mapUnifiedToClientRow);
    return {
      items: page,
      pagination: {
        limit: pageSize,
        offset: pageOffset,
        returned: page.length,
        has_more: page.length === pageSize,
        next_offset: page.length === pageSize ? pageOffset + pageSize : null,
      },
    };
  },
});

registerTool('crm', {
  name: 'search_clients',
  description: 'Search business clients by name, email, phone, website, location, or company.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    query: z.string().min(1),
    limit: z.number().int().min(1).max(1000).optional().default(100),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      query: { type: 'string', description: 'Free-text search query' },
      limit: { type: 'number', description: 'Max records (default 100, max 1000)' },
    },
    required: ['tenant_id', 'query'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { searchBusinessClients } = await import('@/lib/crm/searchBusinessClients');
    const items = await searchBusinessClients(supabase, args.tenant_id, args.query, args.limit);
    return {
      ok: true,
      tool: 'search_clients',
      data: { items, count: items.length },
      error: null,
    };
  },
});

registerTool('crm', {
  name: 'search_contacts',
  description: 'Search unified CRM contacts by name, email, or phone.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    query: z.string(),
    limit: z.number().optional().default(100),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      query: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['tenant_id', 'query'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const contacts = await getUnifiedContacts(supabase, args.tenant_id, {
      limit: Math.min(args.limit ?? 100, 1000),
      search: args.query,
    });
    return contacts;
  },
});

registerTool('crm', {
  name: 'create_client',
  description: 'Create a business client record (delegates to create_contact unified path).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    industry: z.string().optional(),
    website: z.string().url().optional(),
    location: z.string().optional(),
    sales_stage: z.string().optional(),
    value: z.number().optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      industry: { type: 'string' },
      website: { type: 'string', format: 'uri' },
      location: { type: 'string' },
      sales_stage: { type: 'string' },
      value: { type: 'number' },
      source: { type: 'string' },
      notes: { type: 'string' },
      metadata: { type: 'object' },
    },
    required: ['tenant_id', 'name'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('business_clients')
      .insert({
        tenant_id: args.tenant_id,
        name: args.name,
        email: args.email || null,
        phone: args.phone || null,
        industry: args.industry || null,
        website: args.website || null,
        location: args.location || null,
        sales_stage: args.sales_stage || 'lead',
        value: Number(args.value) || 0,
        description: args.notes || null,
        source: args.source || null,
        custom_fields: args.metadata || {},
        is_active: true,
      })
      .select('id, name, email')
      .single();
    if (error) throw error;
    return data;
  },
});

registerTool('crm', {
  name: 'get_leads',
  description:
    'Retrieve leads from the CRM pipeline with accurate pagination and total counts. Excludes converted/closed-lost by default.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    status: z.string().optional(),
    stage: z.string().optional(),
    source: z.string().optional(),
    assigned_to: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).optional().default(20),
    offset: z.number().int().min(0).optional().default(0),
    cursor: z.string().optional(),
    sort_by: z.enum(['created_at', 'status', 'stage', 'business_name', 'updated_at']).optional(),
    sort_order: z.enum(['asc', 'desc']).optional(),
    fields: z.string().optional(),
    exclude_converted: z.boolean().optional().default(true),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      status: { type: 'string' },
      stage: { type: 'string' },
      source: { type: 'string' },
      assigned_to: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
      offset: { type: 'number' },
      cursor: { type: 'string' },
      sort_by: { type: 'string' },
      sort_order: { type: 'string', enum: ['asc', 'desc'] },
      fields: { type: 'string' },
      exclude_converted: { type: 'boolean', default: true },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const { fetchLeadsPaginated } = await import('@/lib/crm/fetchLeads');
    return fetchLeadsPaginated({
      tenantId: args.tenant_id,
      status: args.status,
      stage: args.stage,
      source: args.source,
      assignedTo: args.assigned_to,
      limit: args.limit,
      offset: args.offset,
      cursor: args.cursor,
      sortBy: args.sort_by,
      sortOrder: args.sort_order,
      fields: args.fields,
      excludeConverted: args.exclude_converted,
    });
  },
});
