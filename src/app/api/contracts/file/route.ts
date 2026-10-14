import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { readContractFile } from '@/lib/clientPortal/files';

/** A completed signing token can read only its own executed agreement, until expiry/revocation. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Signing token required' }, { status: 400 });
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
  try {
    const admin = createSupabaseAdminClient();
    const { data: link, error } = await admin.from('contract_signing_tokens')
      .select('tenant_id, contract_id, used_at, expires_at, revoked_at, metadata').eq('token', token).maybeSingle();
    if (error || !link || link.revoked_at || !Number.isFinite(Date.parse(link.expires_at)) || Date.parse(link.expires_at) <= Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired signing link' }, { status: 410, headers });
    }
    if (!link.used_at || !link.metadata?.signature_event_id) return NextResponse.json({ error: 'This signer has not completed signing' }, { status: 403, headers });
    const { data: contract, error: contractError } = await admin.from('contracts').select('*')
      .eq('id', link.contract_id).eq('tenant_id', link.tenant_id).maybeSingle();
    if (contractError || !contract || contract.tenant_id !== link.tenant_id) return NextResponse.json({ error: 'Contract not found' }, { status: 404, headers });
    if (!['fully_signed', 'signed', 'completed'].includes(contract.status)) {
      return NextResponse.json({ error: 'The completed PDF is available after all required parties sign' }, { status: 409, headers });
    }
    const stored = await readContractFile(admin, contract, process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
    if (!stored) return NextResponse.json({ error: 'Completed PDF is not available yet. Contact the sender.', code: 'SIGNED_FILE_MISSING' }, { status: 404, headers });
    return new NextResponse(Uint8Array.from(stored.bytes).buffer, { headers: { ...headers,
      'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="contract-${contract.id}.pdf"`, 'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return NextResponse.json({ error: 'Completed contract could not be loaded' }, { status: 500, headers });
  }
}
