import { createHash, randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { decodeBase64Media, uploadSocialMediaFromBuffer } from '@/lib/social/mediaUpload';

const BUCKET = 'public-assets';
const MAX_CHUNK_BYTES = 512 * 1024;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function fail(code: string, message: string): never {
  throw new Error(`${code}: ${message}`);
}

export async function createMediaUploadSession(input: {
  tenantId: string;
  userId: string;
  filename: string;
  mimeType: string;
  expectedByteSize: number;
  expectedChecksumSha256: string;
  chunkCount: number;
}) {
  if (!input.filename.trim()) fail('MEDIA_INPUT_MISSING', 'filename is required');
  if (!input.mimeType.trim()) fail('MEDIA_INPUT_MISSING', 'mime_type is required');
  if (!Number.isSafeInteger(input.expectedByteSize) || input.expectedByteSize <= 0) {
    fail('MEDIA_DIMENSIONS_INVALID', 'expected_byte_size must be a positive integer');
  }
  if (!/^[a-f0-9]{64}$/i.test(input.expectedChecksumSha256)) {
    fail('MEDIA_CHECKSUM_INVALID', 'expected_checksum_sha256 must be 64 hexadecimal characters');
  }
  if (!Number.isSafeInteger(input.chunkCount) || input.chunkCount < 1 || input.chunkCount > 10000) {
    fail('MEDIA_CHUNK_COUNT_INVALID', 'chunk_count must be between 1 and 10000');
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('media_upload_sessions').insert({
    tenant_id: input.tenantId,
    user_id: input.userId,
    filename: input.filename.trim(),
    mime_type: input.mimeType.trim().toLowerCase(),
    expected_byte_size: input.expectedByteSize,
    expected_checksum_sha256: input.expectedChecksumSha256.toLowerCase(),
    chunk_count: input.chunkCount,
    expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  }).select('id, status, expires_at, chunk_count').single();
  if (error || !data) fail('MEDIA_UPLOAD_SESSION_CREATE_FAILED', error?.message || 'session was not created');
  return { ...data, max_chunk_bytes: MAX_CHUNK_BYTES };
}

async function loadOwnedSession(tenantId: string, userId: string, sessionId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('media_upload_sessions')
    .select('*').eq('id', sessionId).eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (error) fail('MEDIA_UPLOAD_SESSION_READ_FAILED', error.message);
  if (!data) fail('MEDIA_UPLOAD_SESSION_NOT_FOUND', 'session does not belong to the active workspace');
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await admin.from('media_upload_sessions').update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', sessionId).eq('tenant_id', tenantId);
    fail('MEDIA_UPLOAD_SESSION_EXPIRED', 'create a new upload session');
  }
  return data;
}

export async function uploadMediaChunk(input: {
  tenantId: string;
  userId: string;
  sessionId: string;
  chunkIndex: number;
  contentBase64: string;
  expectedChunkChecksumSha256?: string;
}) {
  const session = await loadOwnedSession(input.tenantId, input.userId, input.sessionId);
  if (session.status !== 'open') fail('MEDIA_UPLOAD_SESSION_NOT_OPEN', `session status is ${session.status}`);
  if (!Number.isSafeInteger(input.chunkIndex) || input.chunkIndex < 0 || input.chunkIndex >= session.chunk_count) {
    fail('MEDIA_CHUNK_INDEX_INVALID', 'chunk_index is outside the declared range');
  }

  const bytes = decodeBase64Media(input.contentBase64);
  if (bytes.length > MAX_CHUNK_BYTES) fail('MEDIA_CHUNK_TOO_LARGE', `maximum chunk size is ${MAX_CHUNK_BYTES} bytes`);
  const checksum = sha256(bytes);
  if (input.expectedChunkChecksumSha256 &&
      checksum !== input.expectedChunkChecksumSha256.toLowerCase()) {
    fail('MEDIA_TRANSPORT_TRUNCATED', 'chunk checksum does not match the client checksum');
  }

  const admin = createSupabaseAdminClient();
  const storagePath = `media-staging/${input.tenantId}/${input.sessionId}/${input.chunkIndex}.part`;
  const { error: storageError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: 'application/octet-stream',
    upsert: true,
  });
  if (storageError) fail('MEDIA_STORAGE_WRITE_FAILED', storageError.message);

  const { data: storedBlob, error: readError } = await admin.storage.from(BUCKET).download(storagePath);
  if (readError || !storedBlob) fail('MEDIA_STORAGE_INTEGRITY_FAILED', 'chunk could not be read back');
  const stored = Buffer.from(await storedBlob.arrayBuffer());
  if (stored.length !== bytes.length || sha256(stored) !== checksum) {
    fail('MEDIA_STORAGE_INTEGRITY_FAILED', 'stored chunk differs from received bytes');
  }

  const { error: chunkError } = await admin.from('media_upload_chunks').upsert({
    session_id: input.sessionId,
    tenant_id: input.tenantId,
    chunk_index: input.chunkIndex,
    byte_size: bytes.length,
    checksum_sha256: checksum,
    storage_path: storagePath,
  }, { onConflict: 'session_id,chunk_index' });
  if (chunkError) fail('MEDIA_CHUNK_RECORD_FAILED', chunkError.message);

  const { data: rows } = await admin.from('media_upload_chunks')
    .select('byte_size').eq('session_id', input.sessionId).eq('tenant_id', input.tenantId);
  const receivedBytes = (rows || []).reduce((sum, row) => sum + Number(row.byte_size || 0), 0);
  await admin.from('media_upload_sessions').update({
    received_chunks: rows?.length || 0,
    received_bytes: receivedBytes,
    updated_at: new Date().toISOString(),
  }).eq('id', input.sessionId).eq('tenant_id', input.tenantId);

  return {
    ok: true,
    session_id: input.sessionId,
    chunk_index: input.chunkIndex,
    byte_size: bytes.length,
    checksum_sha256: checksum,
    received_chunks: rows?.length || 0,
    expected_chunks: session.chunk_count,
  };
}

export async function finalizeMediaUploadSession(input: {
  tenantId: string;
  userId: string;
  sessionId: string;
}) {
  const session = await loadOwnedSession(input.tenantId, input.userId, input.sessionId);
  if (session.status === 'completed' && session.asset_id) {
    return { ok: true, session_id: session.id, asset_id: session.asset_id, status: 'ready', idempotent: true };
  }
  if (session.status !== 'open') fail('MEDIA_UPLOAD_SESSION_NOT_OPEN', `session status is ${session.status}`);

  const admin = createSupabaseAdminClient();
  const { data: chunks, error } = await admin.from('media_upload_chunks').select('*')
    .eq('session_id', input.sessionId).eq('tenant_id', input.tenantId).order('chunk_index');
  if (error) fail('MEDIA_CHUNK_READ_FAILED', error.message);
  if (!chunks || chunks.length !== session.chunk_count) {
    fail('MEDIA_CHUNKS_INCOMPLETE', `received ${chunks?.length || 0} of ${session.chunk_count} chunks`);
  }
  for (let index = 0; index < chunks.length; index++) {
    if (chunks[index].chunk_index !== index) fail('MEDIA_CHUNKS_INCOMPLETE', `missing chunk ${index}`);
  }

  await admin.from('media_upload_sessions').update({ status: 'finalizing', updated_at: new Date().toISOString() })
    .eq('id', input.sessionId).eq('tenant_id', input.tenantId).eq('status', 'open');

  try {
    const parts: Buffer[] = [];
    for (const chunk of chunks) {
      const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(chunk.storage_path);
      if (downloadError || !blob) fail('MEDIA_STORAGE_INTEGRITY_FAILED', `chunk ${chunk.chunk_index} unavailable`);
      const part = Buffer.from(await blob.arrayBuffer());
      if (part.length !== chunk.byte_size || sha256(part) !== chunk.checksum_sha256) {
        fail('MEDIA_STORAGE_INTEGRITY_FAILED', `chunk ${chunk.chunk_index} failed integrity verification`);
      }
      parts.push(part);
    }
    const assembled = Buffer.concat(parts);
    if (assembled.length !== Number(session.expected_byte_size) ||
        sha256(assembled) !== session.expected_checksum_sha256) {
      fail('MEDIA_TRANSPORT_TRUNCATED', 'assembled bytes do not match expected byte size/checksum');
    }

    const asset = await uploadSocialMediaFromBuffer({
      tenantId: input.tenantId,
      userId: input.userId,
      filename: session.filename,
      mimeType: session.mime_type,
      buffer: assembled,
      correlationId: randomUUID(),
    });
    await admin.from('media_upload_sessions').update({
      status: 'completed', asset_id: asset.media_asset_id, updated_at: new Date().toISOString(),
    }).eq('id', input.sessionId).eq('tenant_id', input.tenantId);
    await admin.storage.from(BUCKET).remove(chunks.map((chunk) => chunk.storage_path));
    return { ok: true, session_id: session.id, asset_id: asset.media_asset_id, status: 'ready', ...asset };
  } catch (error) {
    await admin.from('media_upload_sessions').update({
      status: 'failed',
      failure_code: error instanceof Error ? error.message.split(':')[0] : 'MEDIA_UPLOAD_FINALIZE_FAILED',
      updated_at: new Date().toISOString(),
    }).eq('id', input.sessionId).eq('tenant_id', input.tenantId);
    throw error;
  }
}
