/**
 * Upload photos to Facebook Graph API using multipart bytes (avoids URL fetch failures).
 */

export async function uploadFacebookPhotoFromBytes(params: {
  pageId: string;
  pageAccessToken: string;
  buffer: Buffer;
  mimeType: string;
  filename: string;
  caption?: string;
  published?: boolean;
}): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; status: number; body: Record<string, unknown> }> {
  const form = new FormData();
  form.append('access_token', params.pageAccessToken);
  const blob = new Blob([params.buffer], { type: params.mimeType || 'application/octet-stream' });
  form.append('source', blob, params.filename || 'upload.jpg');
  if (params.caption) form.append('caption', params.caption);
  if (params.published === false) form.append('published', 'false');

  const res = await fetch(`https://graph.facebook.com/v21.0/${params.pageId}/photos`, {
    method: 'POST',
    body: form,
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok || body?.error) {
    return { ok: false, status: res.status, body };
  }
  return { ok: true, body };
}

export async function uploadFacebookVideoFromBytes(params: {
  pageId: string;
  pageAccessToken: string;
  buffer: Buffer;
  mimeType: string;
  filename: string;
  description?: string;
}): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; status: number; body: Record<string, unknown> }> {
  const form = new FormData();
  form.append('access_token', params.pageAccessToken);
  const blob = new Blob([params.buffer], { type: params.mimeType || 'video/mp4' });
  form.append('source', blob, params.filename || 'upload.mp4');
  if (params.description) form.append('description', params.description);

  const res = await fetch(`https://graph.facebook.com/v21.0/${params.pageId}/videos`, {
    method: 'POST',
    body: form,
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok || body?.error) {
    return { ok: false, status: res.status, body };
  }
  return { ok: true, body };
}
