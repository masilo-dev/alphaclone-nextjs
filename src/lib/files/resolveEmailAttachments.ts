import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { EmailAttachment } from '@/lib/email/sendEmail';

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = String(row[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function documentRowToAttachmentFields(row: Record<string, unknown>): {
  id: string;
  filename: string;
  storagePath: string;
  contentType: string;
  bucket: string;
  base64Content?: string;
} {
  const metadata =
    row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    filename:
      pickString(row, ['title', 'name', 'original_filename', 'filename']) || 'attachment',
    storagePath: pickString(row, ['storage_path', 'path', 'file_path']),
    contentType:
      pickString(row, ['mime_type', 'file_type', 'content_type']) || 'application/octet-stream',
    bucket:
      pickString(metadata, ['storage_bucket']) ||
      pickString(row, ['bucket', 'storage_bucket']) ||
      'uploads',
    base64Content: pickString(row, ['content_base64', 'base64']) || undefined,
  };
}

function fileUploadRowToAttachmentFields(row: Record<string, unknown>): ReturnType<
  typeof documentRowToAttachmentFields
> {
  return {
    id: String(row.id),
    filename: pickString(row, ['original_filename', 'filename', 'name']) || 'attachment',
    storagePath: pickString(row, ['storage_path', 'filename', 'path']),
    contentType: pickString(row, ['file_type', 'mime_type', 'content_type']) || 'application/octet-stream',
    bucket: pickString(row, ['bucket', 'storage_bucket']) || 'uploads',
    base64Content: pickString(row, ['content_base64', 'base64']) || undefined,
  };
}

async function loadAttachmentRows(
  tenantId: string,
  ids: string[]
): Promise<ReturnType<typeof documentRowToAttachmentFields>[]> {
  const supabase = createSupabaseAdminClient();
  const rows: ReturnType<typeof documentRowToAttachmentFields>[] = [];
  const resolvedIds = new Set<string>();

  const addRow = (fields: ReturnType<typeof documentRowToAttachmentFields>) => {
    if (!resolvedIds.has(fields.id)) {
      resolvedIds.add(fields.id);
      rows.push(fields);
    }
  };

  const { data: documents, error: documentsError } = await supabase
    .from('documents')
    .select('id, title, name, storage_path, mime_type, metadata, content')
    .eq('tenant_id', tenantId)
    .in('id', ids)
    .is('deleted_at', null);

  if (documentsError) throw new Error(documentsError.message);
  for (const doc of documents || []) {
    addRow(documentRowToAttachmentFields(doc as Record<string, unknown>));
  }

  const remainingAfterDocs = ids.filter((id) => !resolvedIds.has(id));
  if (remainingAfterDocs.length > 0) {
    const { data: bySourceFile } = await supabase
      .from('documents')
      .select('id, title, name, storage_path, mime_type, metadata, source_file_id')
      .eq('tenant_id', tenantId)
      .in('source_file_id', remainingAfterDocs)
      .is('deleted_at', null);
    for (const doc of bySourceFile || []) {
      const fields = documentRowToAttachmentFields(doc as Record<string, unknown>);
      const sourceId = String((doc as { source_file_id?: string }).source_file_id || '');
      if (sourceId && remainingAfterDocs.includes(sourceId)) {
        fields.id = sourceId;
      }
      addRow(fields);
    }
  }

  const remainingAfterCatalog = ids.filter((id) => !resolvedIds.has(id));
  if (remainingAfterCatalog.length > 0) {
    const { data: uploads, error: uploadsError } = await supabase
      .from('file_uploads')
      .select('id, document_id, original_filename, filename, storage_path, file_type, mime_type')
      .eq('tenant_id', tenantId)
      .in('id', remainingAfterCatalog);

    if (uploadsError) throw new Error(uploadsError.message);

    const linkedDocumentIds = [
      ...new Set(
        (uploads || [])
          .map((row) => String((row as { document_id?: string }).document_id || ''))
          .filter(Boolean)
      ),
    ];

    let linkedDocuments: Record<string, unknown>[] = [];
    if (linkedDocumentIds.length > 0) {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, name, storage_path, mime_type, metadata')
        .eq('tenant_id', tenantId)
        .in('id', linkedDocumentIds)
        .is('deleted_at', null);
      if (error) throw new Error(error.message);
      linkedDocuments = (data || []) as Record<string, unknown>[];
    }
    const documentById = new Map(linkedDocuments.map((doc) => [String(doc.id), doc]));

    for (const upload of uploads || []) {
      const uploadRow = upload as Record<string, unknown> & { document_id?: string };
      const documentId = uploadRow.document_id ? String(uploadRow.document_id) : '';
      const catalogDoc = documentId ? documentById.get(documentId) : null;
      if (catalogDoc) {
        const fields = documentRowToAttachmentFields(catalogDoc);
        fields.id = String(uploadRow.id);
        addRow(fields);
      } else {
        addRow(fileUploadRowToAttachmentFields(uploadRow));
      }
    }
  }

  const stillMissing = ids.filter((id) => !resolvedIds.has(id));
  if (stillMissing.length > 0) {
    const { data: workspaceFiles, error: workspaceError } = await supabase
      .from('workspace_files')
      .select('id, storage_url, file_name, file_type')
      .eq('tenant_id', tenantId)
      .in('id', stillMissing);

    if (workspaceError) throw new Error(workspaceError.message);
    for (const file of workspaceFiles || []) {
      addRow(
        fileUploadRowToAttachmentFields({
          id: (file as { id: string }).id,
          original_filename: (file as { file_name?: string }).file_name,
          storage_path: (file as { storage_url?: string }).storage_url,
          file_type: (file as { file_type?: string }).file_type,
          bucket: 'uploads',
        })
      );
    }
  }

  return rows;
}

export async function resolveEmailAttachmentsFromFileIds(
  tenantId: string,
  documentFileIds: string[]
): Promise<EmailAttachment[]> {
  const ids = [...new Set(documentFileIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];

  const supabase = createSupabaseAdminClient();
  const rows = await loadAttachmentRows(tenantId, ids);

  const attachments: EmailAttachment[] = [];
  for (const row of rows) {
    if (!row.storagePath) {
      if (row.base64Content) {
        attachments.push({
          filename: row.filename,
          content: row.base64Content,
          contentType: row.contentType,
        });
        continue;
      }
      throw new Error(`File ${row.filename} has no storage path or base64 content`);
    }

    const { data: blob, error } = await supabase.storage.from(row.bucket).download(row.storagePath);
    if (error || !blob) {
      throw new Error(error?.message || `Could not download ${row.filename}`);
    }
    attachments.push({
      filename: row.filename,
      content: Buffer.from(await blob.arrayBuffer()).toString('base64'),
      contentType: row.contentType,
    });
  }

  const missing = ids.filter((id) => !rows.some((row) => row.id === id));
  if (missing.length) throw new Error(`File(s) not found or inaccessible: ${missing.join(', ')}`);
  return attachments;
}
