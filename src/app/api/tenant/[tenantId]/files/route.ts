import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { tenantStoragePath } from '@/lib/tenant/platformTenant';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'application/json',
  'application/xml',
]);

const annotationSchema = z.array(z.record(z.string(), z.unknown())).max(500);
const classificationSchema = z.object({ id: z.string().uuid(), category: z.enum(['Agreement', 'Financial', 'Tax', 'Identity']), securityLevel: z.enum(['public', 'internal', 'confidential', 'restricted']) });
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('soft_delete'), fileId: z.string().uuid() }),
  z.object({ action: z.literal('restore'), fileId: z.string().uuid() }),
  z.object({ action: z.literal('annotations'), fileId: z.string().uuid(), annotations: annotationSchema }),
  z.object({ action: z.literal('classify'), classifications: z.array(classificationSchema).min(1).max(200) }),
]);

/**
 * POST multipart upload — bypasses Storage RLS via service role after membership check.
 * Fixes "new row violates row-level security policy" on client-side storage uploads.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user, admin } = await requireTenantAccess(tenantId, req);

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File exceeds the 100MB upload limit' }, { status: 400 });
    }

    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME.has(mimeType)) {
      return NextResponse.json({ error: `File type ${mimeType} is not allowed` }, { status: 400 });
    }

    const entityType = String(form.get('entityType') || '').trim() || null;
    const entityIdRaw = String(form.get('entityId') || '').trim();
    const entityId = z.string().uuid().safeParse(entityIdRaw).success ? entityIdRaw : null;
    const category = String(form.get('category') || '').trim() || null;
    const aiSummary = String(form.get('aiSummary') || '').trim() || null;
    let tags: string[] = [];
    try {
      const parsedTags = JSON.parse(String(form.get('tags') || '[]'));
      if (Array.isArray(parsedTags)) {
        tags = parsedTags.map((t) => String(t)).filter(Boolean).slice(0, 50);
      }
    } catch {
      tags = [];
    }

    const extension = (file.name.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '') || 'bin';
    const storagePath = tenantStoragePath(
      tenantId,
      'uploads',
      user.id,
      `${Date.now()}-${crypto.randomUUID()}.${extension}`
    );

    const bytes = Buffer.from(await file.arrayBuffer());
    const supabaseAdmin = admin || createSupabaseAdminClient();

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('uploads')
      .upload(storagePath, bytes, {
        contentType: mimeType,
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('[tenant/files] storage upload:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file to storage', detail: uploadError.message },
        { status: 500 }
      );
    }

    const { data: fileRecord, error: dbError } = await supabaseAdmin
      .from('file_uploads')
      .insert({
        user_id: user.id,
        tenant_id: tenantId,
        filename: storagePath,
        original_filename: file.name,
        file_type: mimeType,
        file_size: file.size,
        storage_path: uploadData?.path || storagePath,
        scan_status: 'clean',
        entity_type: entityType,
        entity_id: entityId,
        tags,
        category,
        ai_summary: aiSummary,
      })
      .select('id, storage_path')
      .single();

    if (dbError) {
      console.error('[tenant/files] file_uploads insert:', dbError);
      await supabaseAdmin.storage.from('uploads').remove([storagePath]).catch(() => undefined);
      return NextResponse.json(
        { error: 'Failed to record upload in database', detail: dbError.message },
        { status: 500 }
      );
    }

    // Register the same stored object in the shared Documents catalogue. This is
    // metadata only: no second storage object or public URL is created.
    const { data: documentRecord, error: documentError } = await supabaseAdmin
      .from('documents')
      .insert({
        tenant_id: tenantId,
        title: file.name,
        name: file.name,
        mime_type: mimeType,
        storage_path: fileRecord.storage_path,
        size_bytes: file.size,
        status: 'active',
        document_type: category || 'general_file',
        owner_user_id: user.id,
        uploaded_by: user.id,
        source_file_id: fileRecord.id,
        metadata: { tags, ai_summary: aiSummary, scan_status: 'clean' },
      })
      .select('id')
      .single();

    if (documentError) {
      console.error('[tenant/files] shared document insert:', documentError);
      await supabaseAdmin.from('file_uploads').delete().eq('tenant_id', tenantId).eq('id', fileRecord.id);
      await supabaseAdmin.storage.from('uploads').remove([storagePath]).catch(() => undefined);
      return NextResponse.json({ error: 'Failed to register shared document' }, { status: 500 });
    }

    await supabaseAdmin.from('file_uploads')
      .update({ document_id: documentRecord.id })
      .eq('tenant_id', tenantId)
      .eq('id', fileRecord.id);

    if (entityType && entityId) {
      const { error: relationshipError } = await supabaseAdmin.from('document_relationships').insert({
        tenant_id: tenantId,
        document_id: documentRecord.id,
        entity_type: entityType,
        entity_id: entityId,
        relationship_type: 'attachment',
        is_primary: true,
        created_by: user.id,
      });
      if (relationshipError) console.error('[tenant/files] document relationship:', relationshipError);
    }
    await supabaseAdmin.from('document_activity').insert({
      tenant_id: tenantId,
      document_id: documentRecord.id,
      actor_user_id: user.id,
      action: 'uploaded',
      new_values: { file_id: fileRecord.id, mime_type: mimeType, size_bytes: file.size },
    });

    const proxiedUrl = `/api/storage/uploads/${storagePath}`;
    return NextResponse.json({
      success: true,
      fileId: fileRecord.id,
      documentId: documentRecord.id,
      url: proxiedUrl,
      proxiedUrl,
      storagePath,
    });
  } catch (error) {
    return routeErrorResponse(error, 'File upload failed', req);
  }
}

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
    const paths = (files || []).map((file: any) => file.storage_path).filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await admin.storage.from('uploads').remove(paths);
      if (storageError) throw storageError;
    }
    const ids = (files || []).map((file: any) => file.id);
    if (ids.length) {
      const { error } = await admin.from('file_uploads').delete().eq('tenant_id', tenantId).in('id', ids);
      if (error) throw error;
    }
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'files_permanently_deleted', payload: { fileIds: ids, actorUserId: user.id } });
    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) { return routeErrorResponse(error, 'Files could not be permanently deleted', req); }
}
