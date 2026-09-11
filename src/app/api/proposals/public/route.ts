import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: proposal, error } = await admin
    .from('proposals')
    .select('id, title, status, content, tenant_id, client_id, accepted_at, created_at')
    .eq('public_token', token)
    .maybeSingle();

  if (error || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, settings')
    .eq('id', proposal.tenant_id)
    .maybeSingle();

  const settings = (tenant?.settings || {}) as Record<string, unknown>;
  const brandingRaw = (settings.branding || {}) as Record<string, unknown>;

  return NextResponse.json({
    proposal,
    branding: {
      name: tenant?.name || 'Your Business',
      logoUrl: brandingRaw.logoUrl as string | undefined,
      primaryColor: brandingRaw.primaryColor as string | undefined,
    },
  });
}
