import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { buildPaginationMeta, normalizePagination } from '@/lib/mcp/connector/pagination';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';

defineConnectorTool({
  module: 'documents-ops',
  name: 'search_documents',
  description: 'Search workspace documents and files by name or content metadata.',
  permission: 'documents:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    query: z.string().min(1),
    limit: z.number().int().min(1).max(100).optional().default(25),
    offset: z.number().int().min(0).optional().default(0),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      query: { type: 'string' },
      limit: { type: 'number' },
      offset: { type: 'number' },
    },
    required: ['tenant_id', 'query'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { limit, offset } = normalizePagination(args);
    const q = args.query.replace(/[%_]/g, ' ').trim();

    let { data: docs, error: docErr, count } = await supabase
      .from('documents')
      .select('id, title, name, mime_type, created_at, updated_at, storage_path, version', { count: 'exact' })
      .eq('tenant_id', args.tenant_id)
      .or(`title.ilike.%${q}%,name.ilike.%${q}%`)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (docErr?.code === '42P01') {
      // Fall back to collaboration_documents (no tenant_id in some dumps — filter by title only when possible)
      const { data: collab, error, count: cCount } = await supabase
        .from('collaboration_documents')
        .select('id, title, type, version, created_at, updated_at', { count: 'exact' })
        .ilike('title', `%${q}%`)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throwConnectorError('QUERY_FAILED', error.message);
      return okResult(
        'search_documents',
        {
          documents: (collab || []).map((d: any) => ({
            ...d,
            name: d.title,
            mime_type: 'text/plain',
            storage_path: null,
          })),
          source: 'collaboration_documents',
        },
        {
          pagination: buildPaginationMeta({
            limit,
            offset,
            returned: (collab || []).length,
            total: cCount ?? null,
          }),
        }
      );
    }
    if (docErr) throwConnectorError('QUERY_FAILED', docErr.message);
    return okResult('search_documents', { documents: docs || [] }, {
      pagination: buildPaginationMeta({
        limit,
        offset,
        returned: (docs || []).length,
        total: count ?? null,
      }),
    });
  },
});

defineConnectorTool({
  module: 'documents-ops',
  name: 'upload_document',
  description:
    'Register an uploaded document metadata record. Provide storage_path from Alphaclone file upload or a public URL.',
  permission: 'documents:write',
  rateLimitClass: 'write',
  auditAction: 'mcp_upload_document',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    name: z.string().min(1),
    storage_path: z.string().min(1),
    mime_type: z.string().optional(),
    size_bytes: z.number().int().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      storage_path: { type: 'string' },
      mime_type: { type: 'string' },
      size_bytes: { type: 'number' },
      metadata: { type: 'object' },
    },
    required: ['tenant_id', 'name', 'storage_path'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const payload = {
      tenant_id: args.tenant_id,
      name: args.name,
      title: args.name,
      storage_path: args.storage_path,
      mime_type: args.mime_type || 'application/octet-stream',
      size_bytes: args.size_bytes || null,
      metadata: args.metadata || {},
      uploaded_by: ctx.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { data, error } = await supabase.from('documents').insert(payload).select().single();
    if (error?.code === '42P01') {
      ({ data, error } = await supabase.from('files').insert(payload).select().single());
    }
    if (error) throwConnectorError('CREATE_FAILED', error.message);
    return data;
  },
});

defineConnectorTool({
  module: 'documents-ops',
  name: 'retrieve_document',
  description: 'Retrieve a document record and a signed download URL when available.',
  permission: 'documents:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    document_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let document: any = null;
    let table = 'documents';

    const primary = await supabase
      .from('documents')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.document_id)
      .maybeSingle();

    if (primary.data) {
      document = primary.data;
    } else {
      const fallback = await supabase
        .from('files')
        .select('*')
        .eq('tenant_id', args.tenant_id)
        .eq('id', args.document_id)
        .maybeSingle();
      if (fallback.error && fallback.error.code !== '42P01') {
        throwConnectorError('QUERY_FAILED', fallback.error.message);
      }
      document = fallback.data;
      table = 'files';
    }

    if (!document) throwConnectorError('NOT_FOUND', 'Document not found');

    let downloadUrl: string | null = null;
    const path = document.storage_path || document.path;
    if (path && typeof path === 'string' && !path.startsWith('http')) {
      try {
        const { data: signed } = await supabase.storage
          .from('documents')
          .createSignedUrl(path, 3600);
        downloadUrl = signed?.signedUrl || null;
        if (!downloadUrl) {
          const { data: signedFiles } = await supabase.storage
            .from('files')
            .createSignedUrl(path, 3600);
          downloadUrl = signedFiles?.signedUrl || null;
        }
      } catch {
        downloadUrl = null;
      }
    } else if (typeof path === 'string' && path.startsWith('http')) {
      downloadUrl = path;
    }

    return { document, table, download_url: downloadUrl };
  },
});

defineConnectorTool({
  module: 'documents-ops',
  name: 'document_versions',
  description: 'List version history for a document or contract.',
  permission: 'documents:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    document_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();

    const { data: versions, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .eq('document_id', args.document_id)
      .order('version', { ascending: false })
      .limit(100);

    if (!error) return { versions: versions || [] };

    if (error.code === '42P01') {
      const { data: contractVersions } = await supabase
        .from('contract_versions')
        .select('*')
        .eq('tenant_id', args.tenant_id)
        .eq('contract_id', args.document_id)
        .order('created_at', { ascending: false })
        .limit(100);
      return { versions: contractVersions || [], source: 'contract_versions' };
    }

    throwConnectorError('QUERY_FAILED', error.message);
  },
});
