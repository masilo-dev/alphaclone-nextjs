import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { extractTenantBranding } from '@/lib/tenantBranding';

/** A signing token grants access only to its issuer's configured logo, never arbitrary uploads. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return new NextResponse('Not found', { status: 404 });
  try {
    const admin = createSupabaseAdminClient();
    const { data: link, error } = await admin.from('contract_signing_tokens')
      .select('tenant_id, expires_at, revoked_at, used_at')
      .eq('token', token).is('revoked_at', null).is('used_at', null).maybeSingle();
    if (error || !link || !Number.isFinite(Date.parse(link.expires_at)) || Date.parse(link.expires_at) <= Date.now()) {
      return new NextResponse('Not found', { status: 404 });
    }
    const { data: tenant } = await admin.from('tenants').select('name, logo_url, settings').eq('id', link.tenant_id).maybeSingle();
    const { data: business } = await admin.from('business_settings').select('*').eq('tenant_id', link.tenant_id).maybeSingle();
    const logo = extractTenantBranding({ ...tenant, business_settings: business } as Parameters<typeof extractTenantBranding>[0]).logoUrl;
    const path = logo?.match(/^\/api\/storage\/([^/]+)\/(.+)$/);
    if (!path || !path[2].startsWith(`tenant/${link.tenant_id}/`) || path[2].split('/').some(part => part === '..' || part === '.')) {
      return new NextResponse('Not found', { status: 404 });
    }
    const { data: blob, error: downloadError } = await admin.storage.from(path[1]).download(path[2]);
    if (downloadError || !blob || !/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(blob.type)) {
      return new NextResponse('Not found', { status: 404 });
    }
    return new NextResponse(blob, { headers: {
      'Content-Type': blob.type,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    } });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
