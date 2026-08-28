import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  fetchUnlinkedDocOsDocuments,
  mergeCatalogRows,
  type CatalogDocumentRow,
} from '@/lib/documents/docOsCatalogBridge';

const querySchema = z.object({
  q: z.string().trim().max(200).optional().default(''),
  status: z.string().trim().max(50).optional(),
  type: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(80).optional(),
  entityId: z.string().uuid().optional(),
  vault: z.enum(['true', 'false']).optional(),
  view: z
    .enum([
      'all',
      'mine',
      'shared',
      'favourites',
      'templates',
      'requests',
      'approvals',
      'recent',
      'expiring',
      'archive',
      'trash',
      'settings',
    ])
    .optional(),
  includeDocOs: z.enum(['true', 'false']).optional().default('true'),
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

const classifySchema = z.object({
  action: z.literal('classify'),
  classifications: z
    .array(
      z.object({
        id: z.string().uuid(),
        category: z.enum(['Agreement', 'Financial', 'Tax', 'Identity']),
        securityLevel: z.enum(['public', 'internal', 'confidential', 'restricted']),
      })
    )
    .min(1)
    .max(200),
});

const DOCUMENT_SELECT =
  'id,title,name,description,document_type,status,owner_user_id,mime_type,size_bytes,storage_path,expiry_date,archived_at,deleted_at,approval_status,signature_status,version,metadata,created_at,updated_at,doc_os_document_id';

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user, admin } = await requireTenantAccess(tenantId, req);
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid document filters' }, { status: 400 });
    const { q, status, type, entityType, entityId, vault, view, includeDocOs, page, limit } =
      parsed.data;

    if (view === 'templates') {
      const { data, error, count } = await admin
        .from('document_templates')
        .select('id,name,document_type,created_at,updated_at,is_system', { count: 'exact' })
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .order('updated_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);
      if (error) throw error;
      const documents = (data || []).map((row: Record<string, any>) => ({
        id: row.id,
        name: row.name,
        title: row.name,
        document_type: row.document_type,
        status: 'template',
        version: 1,
        approval_status: 'not_requested',
        signature_status: 'not_requested',
        updated_at: row.updated_at || row.created_at,
        created_at: row.created_at,
        metadata: { is_system: row.is_system, source: 'template' },
      }));
      return NextResponse.json({ documents, total: count || documents.length, page, limit, view });
    }

    if (view === 'requests') {
      const { data, error, count } = await admin
        .from('document_requests')
        .select('id,title,document_type,status,deadline,created_at,updated_at,recipient_email', {
          count: 'exact',
        })
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);
      if (error) throw error;
      const documents = (data || []).map((row: Record<string, any>) => ({
        id: row.id,
        name: row.title,
        title: row.title,
        document_type: row.document_type,
        status: row.status,
        version: 1,
        approval_status: 'not_requested',
        signature_status: 'not_requested',
        expiry_date: row.deadline ? String(row.deadline).slice(0, 10) : null,
        updated_at: row.updated_at || row.created_at,
        created_at: row.created_at,
        metadata: { recipient_email: row.recipient_email, source: 'request' },
      }));
      return NextResponse.json({ documents, total: count || documents.length, page, limit, view });
    }

    if (view === 'settings') {
      const { data: brand } = await admin
        .from('document_brand_profiles')
        .select('legal_business_name,trading_name,business_email,jurisdiction,default_currency,updated_at')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return NextResponse.json({
        settings: {
          brand: brand || null,
          retention_default_days: 2555,
          default_confidentiality: 'internal',
        },
        documents: [],
        total: 0,
        page,
        limit,
        view,
      });
    }

    let ids: string[] | null = null;
    if (entityType && entityId) {
      const { data: links, error } = await admin
        .from('document_relationships')
        .select('document_id')
        .eq('tenant_id', tenantId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);
      if (error) throw error;
      const linkedDocumentIds = ((links || []) as Array<{ document_id: string }>).map(
        (link) => link.document_id
      );
      if (!linkedDocumentIds.length) {
        return NextResponse.json({ documents: [], total: 0, page, limit });
      }
      ids = linkedDocumentIds;
    }

    if (view === 'shared' && user.email) {
      const { data: shares, error: shareError } = await admin
        .from('document_shares')
        .select('document_id')
        .eq('tenant_id', tenantId)
        .eq('recipient_email', user.email)
        .is('revoked_at', null);
      if (shareError) throw shareError;
      ids = ((shares || []) as Array<{ document_id: string }>).map((row) => row.document_id);
      if (!ids.length) {
        return NextResponse.json({ documents: [], total: 0, page, limit, view });
      }
    }

    if (view === 'favourites') {
      const { data: favourites, error: favError } = await admin
        .from('favorites')
        .select('entity_id')
        .eq('user_id', user.id)
        .eq('entity_type', 'document');
      if (favError) throw favError;
      ids = ((favourites || []) as Array<{ entity_id: string }>).map((row) => row.entity_id);
      if (!ids.length) {
        return NextResponse.json({ documents: [], total: 0, page, limit, view });
      }
    }

    let query = admin.from('documents').select(DOCUMENT_SELECT, { count: 'exact' }).eq('tenant_id', tenantId);

    if (view === 'trash') {
      query = query.not('deleted_at', 'is', null);
    } else {
      query = query.is('deleted_at', null);
    }

    if (ids) query = query.in('id', ids);
    if (view === 'mine') query = query.eq('owner_user_id', user.id);
    if (view === 'approvals') query = query.eq('approval_status', 'pending');
    if (view === 'archive' || status === 'archived') {
      query = query.or('status.eq.archived,archived_at.not.is.null');
    }
    if (view === 'expiring') {
      query = query
        .not('expiry_date', 'is', null)
        .lte(
          'expiry_date',
          new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10)
        );
    }
    if (vault === 'true') {
      query = query.or('metadata->>vault.eq.true,metadata.cs.{"vault":true}');
    }
    if (q) {
      const escaped = q.replace(/[%_,()]/g, ' ').trim();
      query = query.or(`name.ilike.%${escaped}%,title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
    }
    if (status && view !== 'archive') query = query.eq('status', status);
    if (type) query = query.eq('document_type', type);

    const from = (page - 1) * limit;
    const rangeEnd = view === 'recent' ? Math.max(limit, 20) - 1 : from + limit - 1;
    const rangeStart = view === 'recent' ? 0 : from;
    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(rangeStart, rangeEnd);
    if (error) {
      console.error('[documents] GET query failed', {
        tenantId,
        error: error.message,
        code: error.code,
        details: error.details,
      });
      throw error;
    }

    let documents = (data || []) as CatalogDocumentRow[];

    if (includeDocOs === 'true' && view !== 'trash' && vault !== 'true') {
      const bridged = await fetchUnlinkedDocOsDocuments(admin, tenantId, {
        limit,
        q: q || undefined,
        ownerUserId: view === 'mine' ? user.id : undefined,
      });
      documents = mergeCatalogRows(documents, bridged);
    }

    if (view === 'approvals') {
      const { data: docOsApprovals } = await admin
        .from('doc_os_approvals')
        .select('document_id,status,created_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .limit(limit);
      const pendingDocOsIds = new Set(
        ((docOsApprovals || []) as Array<{ document_id: string }>).map((row) => row.document_id)
      );
      if (pendingDocOsIds.size) {
        const bridged = await fetchUnlinkedDocOsDocuments(admin, tenantId, { limit });
        for (const row of bridged) {
          if (pendingDocOsIds.has(row.id) && !documents.some((doc) => doc.id === row.id)) {
            documents.push({ ...row, approval_status: 'pending' });
          }
        }
      }
    }

    if (view === 'recent') {
      documents = documents.slice(0, 20);
    }

    const total =
      view === 'recent'
        ? documents.length
        : (count || 0) +
          (includeDocOs === 'true' && view !== 'trash' && vault !== 'true'
            ? documents.filter((row) => row.source === 'doc_os').length
            : 0);

    return NextResponse.json({ documents, total, page, limit, view: view || 'all' });
  } catch (error) {
    return routeErrorResponse(error, 'Documents could not be loaded', req);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user, admin } = await requireTenantAccess(tenantId, req);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success)
      return NextResponse.json(
        { error: 'Invalid document', details: parsed.error.flatten() },
        { status: 422 }
      );
    const input = parsed.data;

    const { data: document, error } = await admin
      .from('documents')
      .insert({
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
      })
      .select()
      .single();
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
      tenant_id: tenantId,
      document_id: document.id,
      actor_user_id: user.id,
      action: 'document_created',
      new_values: { name: input.name, status: 'draft' },
    });
    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'document_created',
      payload: { documentId: document.id, actorUserId: user.id },
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Document could not be created', req);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user, admin } = await requireTenantAccess(tenantId, req);
    const body = await req.json().catch(() => ({}));
    const classify = classifySchema.safeParse(body);
    if (!classify.success) {
      return NextResponse.json({ error: 'Invalid classify payload' }, { status: 422 });
    }

    for (const item of classify.data.classifications) {
      const { data: existing } = await admin
        .from('documents')
        .select('metadata')
        .eq('tenant_id', tenantId)
        .eq('id', item.id)
        .maybeSingle();
      if (!existing) continue;
      const metadata = {
        ...((existing.metadata as Record<string, unknown>) || {}),
        category: item.category,
        security_level: item.securityLevel,
        vault: true,
      };
      await admin
        .from('documents')
        .update({ metadata, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('id', item.id);
      await admin.from('document_activity').insert({
        tenant_id: tenantId,
        document_id: item.id,
        actor_user_id: user.id,
        action: 'document_classified',
        new_values: { category: item.category, security_level: item.securityLevel },
      });
    }

    return NextResponse.json({ success: true, updated: classify.data.classifications.length });
  } catch (error) {
    return routeErrorResponse(error, 'Documents could not be updated', req);
  }
}
