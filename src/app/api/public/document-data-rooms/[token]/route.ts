import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params; if (!token || token.length < 32) return NextResponse.json({ error: 'Invalid data room link' }, { status: 400 });
  const admin = createSupabaseAdminClient(); const tokenHash = createHash('sha256').update(token).digest('hex');
  const { data: room, error } = await admin.from('document_data_rooms').select('id,tenant_id,name,status,expires_at,items:document_data_room_items(id,allow_download,sort_order,document:documents(id,name,title,mime_type,size_bytes,storage_path,summary))').eq('token_hash',tokenHash).maybeSingle();
  if (error || !room || room.status !== 'active' || (room.expires_at && new Date(room.expires_at) <= new Date())) return NextResponse.json({ error: 'This data room is unavailable or expired' }, { status: 404 });
  const items = [];
  for (const item of room.items || []) { const document = Array.isArray(item.document) ? item.document[0] : item.document; if (!document) continue; let previewUrl: string | null = null; if (document.storage_path) { for (const bucket of ['uploads','documents','files']) { const { data } = await admin.storage.from(bucket).createSignedUrl(document.storage_path, 900); if (data?.signedUrl) { previewUrl = data.signedUrl; break; } } } items.push({ id: item.id, allowDownload: item.allow_download, sortOrder: item.sort_order, document: { id: document.id, name: document.title || document.name, mimeType: document.mime_type, sizeBytes: document.size_bytes, summary: document.summary, previewUrl } }); }
  return NextResponse.json({ success: true, dataRoom: { name: room.name, expiresAt: room.expires_at, items } });
}
