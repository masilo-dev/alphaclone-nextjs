import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const querySchema = z.object({
  q: z.string().trim().max(200).optional().default(''),
  status: z.string().trim().max(50).optional(),
  type: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(80).optional(),
  entityId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).nullable().optional(),
  documentType: z.string().trim().min(1).max(80).default('general_file'),
  content: z.string().max(1_000_000).nullable().optional(),
  entityType: z.string().trim().max(80).optional(),
  entityId: z.string().uuid().optional(),
  relationshipType: z.string().trim().max(80).default('attachment'),
  expiryDate: z.string().date().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { admin } = await requireTenantAccess(tenantId, req);
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid document filters' }, { status: 400 });
    const { q, status, type, entityType, entityId, page, limit } = parsed.data;

    let ids: string[] | null = null;
    if (entityType && entityId) {
      const { data: links, error } = await admin.from('document_relationships')
        .select('document_id').eq('tenant_id', tenantId).eq('entity_type', entityType).eq('entity_id', entityId);
      if (error) throw error;
      const linkedDocumentIds = ((links || []) as Array<{ document_id: string }>)
        .map((link) => link.document_id);
      if (!linkedDocumentIds.length) {
        return NextResponse.json({ documents: [], total: 0, page, limit });
      }
      ids = linkedDocumentIds;
    }

    let query = admin.from('documents')
      .select(
        'id,title,name,description,document_type,status,owner_user_id,mime_type,size_bytes,storage_path,expiry_date,archived_at,deleted_at,metadata,created_at,updated_at',
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);
    if (ids) query = query.in('id', ids);
    if (q) {
      const escaped = q.replace(/[%_,()]/g, ' ').trim();
      query = query.or(`name.ilike.%${escaped}%,title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
    }
    if (status) query = query.eq('status', status);
    if (type) query = query.eq('document_type', type);
    const from = (page - 1) * limit;
    const { data, error, count } = await query.order('updated_at', { ascending: false }).range(from, from + limit - 1);
    if (error) {
      console.error('[documents] GET query failed', { tenantId, error: error.message, code: error.code, details: error.details });
      throw error;
    }

    return NextResponse.json({ documents: data || [], total: count || 0, page, limit });
  } catch (error) {
    return routeErrorResponse(error, 'Documents could not be loaded', req);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user, admin } = await requireTenantAccess(tenantId, req);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid document', details: parsed.error.flatten() }, { status: 422 });
    const input = parsed.data;

    const { data: document, error } = await admin.from('documents').insert({
      tenant_id: tenantId,
      name: input.name,
      title: input.name,
      description: input.description ?? null,
      document_type: input.documentType,
      status: 'draft',
      content: input.content ?? null,
      owner_user_id: user.id,
      uploaded_by: user.id,
      expiry_date: input.expiryDate ?? null,
      metadata: input.metadata || {},
    }).select().single();
    if (error) throw error;

    if (input.entityType && input.entityId) {
      const { error: relationshipError } = await admin.from('document_relationships').insert({
        tenant_id: tenantId,
        document_id: document.id,
        entity_type: input.entityType,
        entity_id: input.entityId,
        relationship_type: input.relationshipType,
        is_primary: true,
        created_by: user.id,
      });
      if (relationshipError) throw relationshipError;
    }
    await admin.from('document_activity').insert({
      tenant_id: tenantId, document_id: document.id, actor_user_id: user.id,
      action: 'document_created', new_values: { name: input.name, status: 'draft' },
    });
    await admin.from('business_automation_events').insert({
      tenant_id: tenantId, event_type: 'document_created',
      payload: { documentId: document.id, actorUserId: user.id },
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Document could not be created', req);
  }
}
