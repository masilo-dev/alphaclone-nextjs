/** Resolve saved file references without treating full URLs as uploads keys. */
export function documentPreviewUrl(document: { storage_path?: string | null; storage_bucket?: string | null; metadata?: Record<string, unknown> | null; tags?: string[] | null }, tenantId: string): string | null {
  const reference = document.storage_path;
  if (!reference) return null;
  let bucket = document.storage_bucket || String(document.metadata?.storage_bucket || document.tags?.find(tag => tag.startsWith('bucket:'))?.slice(7) || 'uploads');
  let path = reference;
  if (/^https?:\/\//i.test(reference)) {
    const url = new URL(reference);
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!match) return url.protocol === 'https:' ? reference : null;
    bucket = decodeURIComponent(match[1]);
    path = match[2].split('/').map(decodeURIComponent).join('/');
  } else if (reference.startsWith('/api/storage/')) {
    const url = new URL(reference, 'https://preview.invalid');
    url.searchParams.set('tenantId', tenantId);
    return `${url.pathname}${url.search}`;
  }
  return `/api/storage/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}?tenantId=${encodeURIComponent(tenantId)}`;
}
