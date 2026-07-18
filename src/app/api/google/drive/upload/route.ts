import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getValidGoogleAccessToken } from '@/services/google/googleAccessTokenService';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const tenantId = String(form.get('tenantId') || '').trim();
    const file = form.get('file');
    const filename = String(form.get('filename') || '').trim();
    if (!(file instanceof File) || !filename) return NextResponse.json({ error: 'File and filename are required' }, { status: 400 });
    if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: 'Google Drive uploads are limited to 25 MB.' }, { status: 413 });
    const { user } = await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    const accessToken = await getValidGoogleAccessToken({ admin, userId: user.id, tenantId });
    if (!accessToken) return NextResponse.json({ error: 'Reconnect Google Calendar with Drive access.' }, { status: 409 });
    const upload = new FormData();
    upload.set('metadata', new Blob([JSON.stringify({ name: filename, mimeType: file.type || 'application/octet-stream' })], { type: 'application/json' }));
    upload.set('file', file);
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: upload,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data.error?.message || 'Google Drive upload failed' }, { status: response.status === 403 ? 403 : 502 });
    return NextResponse.json({ success: true, file: data });
  } catch (error) { return routeErrorResponse(error, 'Google Drive upload failed', req); }
}
