import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

export type StorageReference = { bucket: string; path: string };
/** Parse stored references only; never fetch arbitrary URLs or forward credentials. */
export function storageReference(value: unknown, bucket = 'documents', storageOrigin?: string): StorageReference | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  let path = value.trim();
  if (/^https?:/i.test(path)) {
    try {
      const url = new URL(path);
      if (!storageOrigin || url.origin !== new URL(storageOrigin).origin) return null;
      const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
      if (!match) return null;
      bucket = decodeURIComponent(match[1]); path = decodeURIComponent(match[2]);
    } catch { return null; }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(bucket) || path.startsWith('/') || path.includes('\\') || path.split('/').some(p => p === '..' || p === '.') || /[?#\u0000-\u001f]/.test(path)) return null;
  return { bucket, path };
}
export async function readStoredFile(admin: SupabaseClient, refs: StorageReference[], expectedHash?: string) {
  const seen = new Set<string>();
  for (const ref of refs) {
    const key = `${ref.bucket}/${ref.path}`; if (seen.has(key)) continue; seen.add(key);
    const { data, error } = await admin.storage.from(ref.bucket).download(ref.path);
    if (error || !data) continue;
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (expectedHash && createHash('sha256').update(bytes).digest('hex') !== expectedHash) throw new Error('FILE_INTEGRITY_MISMATCH');
    return { bytes, contentType: data.type || 'application/octet-stream' };
  }
  return null;
}
export async function readContractFile(admin: SupabaseClient, contract: Record<string, any>, storageOrigin?: string) {
  const metadata = contract.metadata || {};
  const signed = ['client_signed', 'fully_signed', 'signed', 'completed'].includes(String(contract.status).toLowerCase());
  const refs: StorageReference[] = [];
  const add = (value: unknown, bucket: string) => { const r = storageReference(value, bucket, storageOrigin); if (r) refs.push(r); };
  add(contract.signed_pdf_url || metadata.signed_pdf_url, 'contracts');
  add(contract.pdf_url, 'contracts');
  add(metadata.signed_pdf_path || metadata.pdf_path || contract.storage_path, metadata.storage_bucket || 'contracts');
  // Catalog entries must belong to this tenant AND this contract. A client link
  // alone is not enough to substitute another agreement's file.
  const linked = await admin.from('document_relationships').select('document_id').eq('tenant_id', contract.tenant_id).eq('entity_type', 'contract').eq('entity_id', contract.id);
  if (linked.error) throw linked.error;
  const ids = [...new Set((linked.data || []).map((x: any) => x.document_id))];
  if (ids.length) {
    const documents = await admin.from('documents').select('*').eq('tenant_id', contract.tenant_id).in('id', ids).is('deleted_at', null);
    if (documents.error) throw documents.error;
    for (const doc of documents.data || []) {
      if (signed && doc.metadata?.source !== 'contract_pdf' && doc.signature_status !== 'signed') continue;
      add(doc.storage_path, doc.storage_bucket || doc.metadata?.storage_bucket || 'contracts');
    }
  }
  refs.push({bucket:'contracts', path:`contracts/${contract.tenant_id}/${contract.id}.pdf`});
  const result = await readStoredFile(admin, refs, metadata.signed_pdf_sha256 || metadata.pdf_sha256);
  if (result && new TextDecoder().decode(result.bytes.slice(0,5)) !== '%PDF-') throw new Error('INVALID_PDF_FILE');
  return result;
}
