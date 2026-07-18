import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const annotationSchema = z.array(z.record(z.string(), z.unknown())).max(500);
const classificationSchema = z.object({ id: z.string().uuid(), category: z.enum(['Agreement', 'Financial', 'Tax', 'Identity']), securityLevel: z.enum(['public', 'internal', 'confidential', 'restricted']) });
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('soft_delete'), fileId: z.string().uuid() }),
  z.object({ action: z.literal('restore'), fileId: z.string().uuid() }),
  z.object({ action: z.literal('annotations'), fileId: z.string().uuid(), annotations: annotationSchema }),
  z.object({ action: z.literal('classify'), classifications: z.array(classificationSchema).min(1).max(200) }),
]);

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = actionSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid file operation' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    if (parsed.data.action === 'classify') {
      for (const item of parsed.data.classifications) {
        const { error } = await admin.from('file_uploads').update({ category: item.category, tags: ['vault', `security:${item.securityLevel}`, 'encrypted'] }).eq('tenant_id', tenantId).eq('id', item.id).contains('tags', ['vault']);
        if (error) throw error;
      }
    } else {
      const updates = parsed.data.action === 'soft_delete' ? { deleted_at: new Date().toISOString() } : parsed.data.action === 'restore' ? { deleted_at: null } : { annotations: parsed.data.annotations };
      const { data, error } = await admin.from('file_uploads').update(updates).eq('tenant_id', tenantId).eq('id', parsed.data.fileId).select('id').maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: `file_${parsed.data.action}`, payload: { actorUserId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'File operation failed', req); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const fileId = req.nextUrl.searchParams.get('fileId');
    const admin = createSupabaseAdminClient();
    let query = admin.from('file_uploads').select('id, storage_path').eq('tenant_id', tenantId).not('deleted_at', 'is', null);
    if (fileId) {
      if (!z.string().uuid().safeParse(fileId).success) return NextResponse.json({ error: 'Valid fileId required' }, { status: 400 });
      query = query.eq('id', fileId);
    }
    const { data: files, error: readError } = await query;
    if (readError) throw readError;
    const paths = (files || []).map((file) => file.storage_path).filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await admin.storage.from('uploads').remove(paths);
      if (storageError) throw storageError;
    }
    const ids = (files || []).map((file) => file.id);
    if (ids.length) {
      const { error } = await admin.from('file_uploads').delete().eq('tenant_id', tenantId).in('id', ids);
      if (error) throw error;
    }
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'files_permanently_deleted', payload: { fileIds: ids, actorUserId: user.id } });
    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) { return routeErrorResponse(error, 'Files could not be permanently deleted', req); }
}
