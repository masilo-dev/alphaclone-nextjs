import { NextRequest, NextResponse } from 'next/server';
import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireClientPortalAccessDoubleGuarded } from '@/lib/auth/clientPortalAuth';
import { readStoredFile, storageReference } from '@/lib/clientPortal/files';
import { resolveClientByPortalToken } from '@/services/finance/clientFinancePortalService';

export const dynamic = 'force-dynamic';

function mapAuthError(code: string): { status: number; message: string } {
  switch (code) {
    case 'NO_SESSION':
    case 'BAD_TOKEN':
    case 'SALT_ROTATED':
    case 'SESSION_REVOKED':
      return { status: 401, message: 'Session expired or invalid. Please log in again.' };
    case 'CLIENT_INACTIVE':
      return { status: 403, message: 'This portal account is not active.' };
    case 'TOKEN_MISMATCH':
      return { status: 403, message: 'Session does not match this portal.' };
    case 'BAD_PORTAL_TOKEN':
      return { status: 404, message: 'Portal not found.' };
    case 'INTERNAL_ERROR':
      return { status: 500, message: 'Server error.' };
    default:
      return { status: 403, message: 'Access denied.' };
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim();
  const documentId = req.nextUrl.searchParams.get('documentId')?.trim();
  if (!token || !documentId) return NextResponse.json({ error: 'token and documentId are required' }, { status: 400 });

  try {
    const admin = await resolveSupabaseAdminClient();
    const guarded = await requireClientPortalAccessDoubleGuarded(admin, token, resolveClientByPortalToken);
    if (!guarded.ok) {
      const { status, message } = mapAuthError(guarded.error.code);
      return NextResponse.json({ error: message, code: guarded.error.code }, { status });
    }
    const client = guarded.resolvedClient;

    const { data: link, error } = await admin
      .from('document_relationships')
      .select('document_id')
      .eq('tenant_id', client.tenant_id)
      .in('entity_type', ['client', 'customer'])
      .eq('entity_id', client.id)
      .eq('document_id', documentId)
      .limit(1).maybeSingle();
    if (error) throw error;
    if (!link) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    const { data: document, error: documentError } = await admin.from('documents').select('*')
      .eq('id', documentId).eq('tenant_id', client.tenant_id).is('deleted_at', null).maybeSingle();
    if (documentError) throw documentError;
    if (!document?.storage_path) return NextResponse.json({ error: 'The business has not attached a file to this document.', code: 'FILE_REFERENCE_MISSING' }, { status: 404 });
    const ref = storageReference(document.storage_path, document.storage_bucket || document.metadata?.storage_bucket || 'documents', process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
    if (!ref) return NextResponse.json({ error: 'The document has an invalid storage reference. Ask the business to repair it.' }, { status: 404 });
    const file = await readStoredFile(admin, [ref], document.metadata?.file_sha256);
    if (file) {
      const download = req.nextUrl.searchParams.get('download') === '1';
      const filename = String(document.title || document.name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
      // Active HTML/SVG uploads must never execute under the application's origin.
      const type = file.contentType.split(';')[0];
      const previewable = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'].includes(type);
      return new NextResponse(Uint8Array.from(file.bytes).buffer, { headers: {
        'Content-Type': previewable ? type : 'application/octet-stream',
        'Content-Disposition': `${download || !previewable ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "sandbox", 'Referrer-Policy': 'no-referrer',
      } });
    }
    return NextResponse.json({ error: 'Document file is unavailable' }, { status: 404 });
  } catch (error) {
    console.error('[client-finance/document]', error);
    return NextResponse.json({ error: 'Document could not be opened' }, { status: 500 });
  }
}
