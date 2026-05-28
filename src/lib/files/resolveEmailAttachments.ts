import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { EmailAttachment } from '@/lib/email/sendEmail';

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = String(row[key] || '').trim();
    if (value) return value;
  }
  return '';
}

export async function resolveEmailAttachmentsFromFileIds(
  tenantId: string,
  documentFileIds: string[]
): Promise<EmailAttachment[]> {
  const ids = [...new Set(documentFileIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];

  const supabase = createSupabaseAdminClient();
  let rows: Record<string, unknown>[] = [];
  const fileUploads = await supabase
    .from('file_uploads')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('id', ids);

  if (!fileUploads.error && fileUploads.data?.length) {
    rows = fileUploads.data as Record<string, unknown>[];
  } else {
    const documents = await supabase
      .from('documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('id', ids);
    if (documents.error) {
      throw new Error(fileUploads.error?.message || documents.error.message);
    }
    rows = (documents.data || []) as Record<string, unknown>[];
  }

  const attachments: EmailAttachment[] = [];
  for (const row of rows) {
    const filename = pickString(row, ['original_filename', 'filename', 'name', 'title']) || 'attachment';
    const storagePath = pickString(row, ['storage_path', 'path', 'file_path']);
    const contentType = pickString(row, ['file_type', 'content_type', 'mime_type']) || 'application/octet-stream';
    const bucket = pickString(row, ['bucket', 'storage_bucket']) || 'uploads';

    if (!storagePath) {
      const base64Content = pickString(row, ['content_base64', 'base64']);
      if (base64Content) {
        attachments.push({ filename, content: base64Content, content_type: contentType });
        continue;
      }
      throw new Error(`File ${filename} has no storage path or base64 content`);
    }

    const { data: blob, error } = await supabase.storage.from(bucket).download(storagePath);
    if (error || !blob) {
      throw new Error(error?.message || `Could not download ${filename}`);
    }
    attachments.push({
      filename,
      content: Buffer.from(await blob.arrayBuffer()).toString('base64'),
      content_type: contentType,
    });
  }

  const missing = ids.filter((id) => !rows.some((row) => String(row.id) === id));
  if (missing.length) throw new Error(`File(s) not found or inaccessible: ${missing.join(', ')}`);
  return attachments;
}
