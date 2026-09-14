import { NextRequest, NextResponse } from 'next/server';
import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveClientByPortalToken } from '@/services/finance/clientFinancePortalService';

export const dynamic = 'force-dynamic';

/**
 * Exchanges a client-portal token for a short-lived URL to one explicitly
 * shared document. Never expose a raw storage path to the browser.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim();
  const documentId = req.nextUrl.searchParams.get('documentId')?.trim();
  if (!token || !documentId) return NextResponse.json({ error: 'token and documentId are required' }, { status: 400 });

  try {
    const admin = await resolveSupabaseAdminClient();
    const client = await resolveClientByPortalToken(admin, token);
    if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });

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
