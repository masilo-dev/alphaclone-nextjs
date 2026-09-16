import { NextRequest, NextResponse } from 'next/server';
import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireClientPortalAccessDoubleGuarded } from '@/lib/auth/clientPortalAuth';
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
      .select('document:documents(id, storage_path, deleted_at)')
      .eq('tenant_id', client.tenant_id)
      .eq('entity_type', 'client')
      .eq('entity_id', client.id)
      .eq('document_id', documentId)
      .maybeSingle();
    if (error) throw error;
    const document = Array.isArray((link as any)?.document) ? (link as any).document[0] : (link as any)?.document;
    if (!document || document.deleted_at || !document.storage_path) {
      return NextResponse.json({ error: 'Document is unavailable' }, { status: 404 });
    }

    for (const bucket of ['uploads', 'documents', 'files']) {
      const { data } = await admin.storage.from(bucket).createSignedUrl(document.storage_path, 900);
      if (data?.signedUrl) return NextResponse.redirect(data.signedUrl);
    }
    return NextResponse.json({ error: 'Document file is unavailable' }, { status: 404 });
  } catch (error) {
    console.error('[client-finance/document]', error);
    return NextResponse.json({ error: 'Document could not be opened' }, { status: 500 });
  }
}
