import { createHash } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ingestMediaInput } from '@/lib/media/ingestMedia';

export type MediaJobType = 'image' | 'video' | 'audio' | 'document';

export async function createMediaJob(input: {
  tenantId: string;
  userId: string;
  grantId?: string | null;
  type: MediaJobType;
  prompt?: string;
  provider?: string;
  sourceUrl?: string;
  inputMediaId?: string;
  options?: Record<string, unknown>;
  idempotencyKey?: string;
}) {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('mcp_jobs').insert({
    tenant_id: input.tenantId,
    user_id: input.userId,
    grant_id: input.grantId || null,
    job_type: `media:${input.type}`,
    status: 'queued',
    idempotency_key: input.idempotencyKey || null,
    input: {
      prompt: input.prompt,
      provider: input.provider,
      source_url: input.sourceUrl,
      input_media_id: input.inputMediaId,
      options: input.options || {},
    },
  }).select('id,status,created_at').single();
  if (error) {
    if (error.code === '23505') {
      const existing = await db.from('mcp_jobs')
        .select('id,status,created_at')
        .eq('tenant_id', input.tenantId)
        .eq('job_type', `media:${input.type}`)
        .eq('idempotency_key', input.idempotencyKey!)
        .single();
      if (existing.error) throw new Error(existing.error.message);
      return { job_id: existing.data.id, status: existing.data.status, status_tool: 'get_media_job' };
    }
    throw new Error(error.message);
  }
  return { job_id: data.id, status: data.status, status_tool: 'get_media_job' };
}

export async function uploadMedia(input: {
  tenantId: string;
  userId: string;
  filename: string;
  mimeType: string;
  contentBase64?: string;
  sourceUrl?: string;
  purpose?: string;
}) {
  if (!input.contentBase64 && !input.sourceUrl) {
    const error = new Error('This client must provide content_base64 or source_url.');
    error.name = 'CLIENT_MEDIA_TRANSFER_UNSUPPORTED';
    throw error;
  }
  const asset = await ingestMediaInput({
    tenantId: input.tenantId,
    userId: input.userId,
    purpose: input.purpose,
    media: input.contentBase64
      ? { type: 'base64', data: input.contentBase64, filename: input.filename, mimeType: input.mimeType }
      : { type: 'url', url: input.sourceUrl!, filename: input.filename },
  });
  return {
    media_id: asset.id,
    media_url: asset.url,
    mime_type: asset.mime_type,
    size_bytes: asset.size_bytes,
    status: asset.status,
    checksum: asset.checksum || (
      input.contentBase64
        ? createHash('sha256').update(Buffer.from(input.contentBase64, 'base64')).digest('hex')
        : null
    ),
    created_at: new Date().toISOString(),
  };
}

export async function getMediaJob(tenantId: string, jobId: string) {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('mcp_jobs')
    .select('id,job_type,status,result,error,attempts,created_at,updated_at,completed_at')
    .eq('tenant_id', tenantId)
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('RESOURCE_NOT_FOUND');
  return data;
}
