import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';

/**
 * ChatGPT / OpenAI connector aliases.
 * Some ChatGPT modes expect generic `search` + `fetch` tools.
 */
defineConnectorTool({
  module: 'chatgpt-aliases',
  name: 'search',
  description:
    'Search the AlphaClone workspace (documents, CRM leads/contacts, and related business records). Use for discovery questions.',
  permission: 'documents:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    query: z.string().min(1),
    limit: z.number().int().min(1).max(50).optional().default(10),
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
    const q = args.query.replace(/[%_]/g, ' ').trim();
    const limit = args.limit ?? 10;

    const [docs, leads] = await Promise.all([
      supabase
        .from('documents')
        .select('id, title, name, mime_type, updated_at')
        .eq('tenant_id', args.tenant_id)
        .or(`title.ilike.%${q}%,name.ilike.%${q}%`)
        .order('updated_at', { ascending: false })
        .limit(limit),
      supabase
        .from('leads')
        .select('id, business_name, contact_name, email, status, updated_at')
        .eq('tenant_id', args.tenant_id)
        .or(
          `business_name.ilike.%${q}%,email.ilike.%${q}%,contact_name.ilike.%${q}%,phone.ilike.%${q}%`
        )
        .order('updated_at', { ascending: false })
        .limit(limit),
    ]);

    const results = [
      ...(docs.data || []).map((d) => ({
        id: `document:${d.id}`,
        type: 'document',
        title: d.title || d.name || d.id,
        url: `mcp://document/${d.id}`,
      })),
      ...(leads.data || []).map((l) => ({
        id: `lead:${l.id}`,
        type: 'lead',
        title: l.business_name || l.contact_name || l.email || l.id,
        url: `mcp://lead/${l.id}`,
      })),
    ].slice(0, limit);

    return okResult('search', {
      query: args.query,
      results,
      count: results.length,
      warnings: [docs.error?.message, leads.error?.message].filter(Boolean),
    });
  },
});

defineConnectorTool({
  module: 'chatgpt-aliases',
  name: 'fetch',
  description:
    'Fetch a workspace record by id or URI previously returned by search (documents, leads, contacts, etc.).',
  permission: 'documents:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    id: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      id: { type: 'string' },
    },
    required: ['tenant_id', 'id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const raw = args.id.replace(/^mcp:\/\//, '');
    const [type, maybeId] = raw.includes(':') ? raw.split(':', 2) : raw.split('/', 2);
    const id = maybeId || type;
    const kind = maybeId ? type : 'document';

    if (kind === 'document' || kind === 'documents') {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('tenant_id', args.tenant_id)
        .eq('id', id)
        .maybeSingle();
      if (error) throwConnectorError('INTERNAL', error.message);
      if (!data) throwConnectorError('NOT_FOUND', 'Document not found');
      return okResult('fetch', { type: 'document', record: data });
    }

    if (kind === 'lead' || kind === 'leads') {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('tenant_id', args.tenant_id)
        .eq('id', id)
        .maybeSingle();
      if (error) throwConnectorError('INTERNAL', error.message);
      if (!data) throwConnectorError('NOT_FOUND', 'Lead not found');
      return okResult('fetch', { type: 'lead', record: data });
    }

    // Fallback: try document id directly
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .eq('id', id)
      .maybeSingle();
    if (error) throwConnectorError('INTERNAL', error.message);
    if (!data) throwConnectorError('NOT_FOUND', `No record found for id: ${args.id}`);
    return okResult('fetch', { type: 'document', record: data });
  },
});
