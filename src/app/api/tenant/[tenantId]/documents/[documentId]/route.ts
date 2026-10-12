import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { mapDocOsRowToCatalog } from '@/lib/documents/docOsCatalogBridge';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(['draft','in_review','changes_requested','approved','issued','active','superseded','expired','archived']).optional(),
  documentType: z.string().trim().max(80).optional(),
  expiryDate: z.string().date().nullable().optional(),
  archived: z.boolean().optional(),
  deleted: z.boolean().optional(),
});

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string; documentId: string }> }) {
  try {
    const { tenantId, documentId } = await context.params;
    const ids = z.object({ tenantId: z.string().uuid(), documentId: z.string().uuid() }).parse({ tenantId, documentId });
    const { admin } = await requireTenantAccess(ids.tenantId, req);
    // The list bridges Doc OS identities. Resolve those same identities before detail fan-out.
    let { data: document, error: documentError } = await admin.from('documents').select('*')
      .eq('tenant_id', ids.tenantId).eq('id', ids.documentId).is('deleted_at', null).maybeSingle();
    if (documentError) throw documentError;
    if (!document) {
      const linked = await admin.from('documents').select('*').eq('tenant_id', ids.tenantId)
        .eq('doc_os_document_id', ids.documentId).maybeSingle();
      if (linked.error) throw linked.error;
      // A linked soft-deleted record must not become visible through the bridge.
      if (linked.data?.deleted_at) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      document = linked.data;
    }
    if (!document) {
      const bridge = await admin.from('doc_os_documents').select('*').eq('tenant_id', ids.tenantId)
        .eq('document_id', ids.documentId).is('archived_at', null).maybeSingle();
      if (bridge.error) throw bridge.error;
      if (!bridge.data) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      return NextResponse.json({ document: mapDocOsRowToCatalog(bridge.data), relationships: [], activity: [],
        versions: [], legacyVersions: [], intelligenceJobs: [], findings: [], comparisons: [],
        detailAvailability: 'doc_os_summary' }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    const canonicalId = document.id;
    const [relationshipResult, activityResult, versionResult, legacyVersionResult, intelligenceJobsResult, findingsResult, comparisonsResult] = await Promise.all([
      admin.from('document_relationships').select('*').eq('tenant_id', ids.tenantId).eq('document_id', canonicalId),
      admin.from('document_activity').select('*').eq('tenant_id', ids.tenantId).eq('document_id', canonicalId).order('created_at', { ascending: false }).limit(100),
      admin.from('document_versions').select('*').eq('tenant_id', ids.tenantId).eq('document_id', canonicalId).order('version_number', { ascending: false }).limit(100),
      admin.from('tenant_document_versions').select('*').eq('tenant_id', ids.tenantId).eq('document_id', canonicalId).order('version', { ascending: false }).limit(100),
      admin.from('document_intelligence_jobs').select('*').eq('tenant_id', ids.tenantId).eq('document_id', canonicalId).order('created_at', { ascending: false }).limit(50),
      admin.from('document_findings').select('*').eq('tenant_id', ids.tenantId).eq('document_id', canonicalId).order('created_at', { ascending: false }).limit(250),
      admin.from('document_comparisons').select('*').eq('tenant_id', ids.tenantId).eq('document_id', canonicalId).order('created_at', { ascending: false }).limit(25),
    ]);
    return NextResponse.json({
      document,
      relationships: relationshipResult.data || [],
      activity: activityResult.data || [],
      versions: versionResult.data || [],
      legacyVersions: legacyVersionResult.data || [],
      intelligenceJobs: intelligenceJobsResult.data || [],
      findings: findingsResult.data || [],
      comparisons: comparisonsResult.data || [],
    });
  } catch (error) {
    return routeErrorResponse(error, 'Document could not be loaded', req);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string; documentId: string }> }) {
  try {
    const { tenantId, documentId } = await context.params;
    const { user, admin } = await requireTenantAccess(tenantId, req);
    const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid document update' }, { status: 422 });
    const { data: previous } = await admin.from('documents').select('*').eq('tenant_id', tenantId).eq('id', documentId).maybeSingle();
    if (!previous) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (previous.signature_status === 'signed' && parsed.data.status !== 'archived') {
      return NextResponse.json({ error: 'Signed documents are immutable; create an amendment instead' }, { status: 409 });
    }
    const updates = {
      ...(parsed.data.name ? { name: parsed.data.name, title: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.documentType ? { document_type: parsed.data.documentType } : {}),
      ...(parsed.data.expiryDate !== undefined ? { expiry_date: parsed.data.expiryDate } : {}),
      ...(parsed.data.archived !== undefined ? { archived_at: parsed.data.archived ? new Date().toISOString() : null, status: parsed.data.archived ? 'archived' : 'active' } : {}),
      ...(parsed.data.deleted !== undefined ? { deleted_at: parsed.data.deleted ? new Date().toISOString() : null } : {}),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await admin.from('documents').update(updates).eq('tenant_id', tenantId).eq('id', documentId).select().single();
    if (error) throw error;
    await admin.from('document_activity').insert({
      tenant_id: tenantId, document_id: documentId, actor_user_id: user.id,
      action: parsed.data.deleted ? 'moved_to_trash' : parsed.data.archived ? 'archived' : 'document_updated',
      previous_values: previous, new_values: updates,
    });
    return NextResponse.json({ document: data });
  } catch (error) {
    return routeErrorResponse(error, 'Document could not be updated', req);
  }
}
