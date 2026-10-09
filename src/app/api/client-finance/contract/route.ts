import { NextRequest, NextResponse } from 'next/server';
import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireClientPortalAccessDoubleGuarded } from '@/lib/auth/clientPortalAuth';
import { portalOwnsResource } from '@/lib/auth/portalResourceOwnership';
import { resolveClientByPortalToken } from '@/services/finance/clientFinancePortalService';
import { readContractFile } from '@/lib/clientPortal/files';
import { generateThemedContractPdfBuffer } from '@/lib/documents/themedDocumentPdf';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim();
  const contractId = req.nextUrl.searchParams.get('contractId')?.trim();
  if (!token || !contractId || !/^[0-9a-f-]{36}$/i.test(contractId)) {
    return NextResponse.json({ error: 'Valid portal and contract are required' }, { status: 400 });
  }
  try {
    const admin = await resolveSupabaseAdminClient();
    const access = await requireClientPortalAccessDoubleGuarded(admin, token, resolveClientByPortalToken);
    if (!access.ok) return NextResponse.json({ error: 'Portal access denied' }, { status: access.error.http });
    const client = access.resolvedClient;
    const { data, error } = await admin.from('contracts')
      .select('*')
      .eq('tenant_id', client.tenant_id).eq('client_id', client.id).eq('id', contractId).maybeSingle();
    if (error) throw error;
    if (
      !portalOwnsResource(
        { clientId: client.id, tenantId: client.tenant_id },
        data ? { id: data.id, tenant_id: data.tenant_id, client_id: data.client_id } : null
      )
    ) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }
    const shared = ['sent', 'viewed', 'negotiating', 'active', 'client_signed', 'fully_signed', 'signed', 'completed'].includes(String(data.status || '').toLowerCase());
    if (!shared) {
      const { data: recipient } = await admin.from('business_clients').select('email')
        .eq('tenant_id', client.tenant_id).eq('id', client.id).maybeSingle();
      const { data: signingToken } = await admin.from('contract_signing_tokens').select('contract_id')
        .eq('tenant_id', client.tenant_id).eq('contract_id', contractId)
        .eq('signer_email', String(recipient?.email || '').toLowerCase())
        .is('used_at', null).is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
      if (!signingToken) return NextResponse.json({ error: 'Contract has not been shared with you' }, { status: 404 });
    }
    if (req.nextUrl.searchParams.get('download') === '1' || req.nextUrl.searchParams.get('view') === '1') {
      const download = req.nextUrl.searchParams.get('download') === '1';
      const stored = await readContractFile(admin, data, process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
      let pdf: ArrayBuffer;
      if (stored) {
        pdf = Uint8Array.from(stored.bytes).buffer;
      } else {
        const signed = ['client_signed', 'fully_signed', 'signed', 'completed'].includes(String(data.status || '').toLowerCase());
        if (signed) return NextResponse.json({ error: 'The original signed PDF is missing from its recorded storage locations. Contact the business to restore the original file; signature evidence has been preserved.', code: 'SIGNED_FILE_MISSING', contractId }, { status: 404 });
        const [{ data: tenant }, { data: recipient }] = await Promise.all([
          admin.from('tenants').select('name, logo_url, settings').eq('id', client.tenant_id).maybeSingle(),
          admin.from('business_clients').select('name, email').eq('tenant_id', client.tenant_id).eq('id', client.id).maybeSingle(),
        ]);
        const generated = await generateThemedContractPdfBuffer(data, tenant, recipient || undefined);
        pdf = Uint8Array.from(generated).buffer;
      }
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="contract-${contractId}.pdf"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    return NextResponse.json({ contract: { id: data.id, title: data.title, content: data.content, status: data.status, updated_at: data.updated_at } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[client-finance/contract]', error);
    return NextResponse.json({ error: 'Contract could not be loaded. Retry or contact the business with the contract reference.', code: 'CONTRACT_LOAD_FAILED' }, { status: 500 });
  }
}
