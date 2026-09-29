import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse, createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '';
    await requireTenantAccess(tenantId, req);
    const admin = createAdminSupabaseClientOrThrow();
    const { data, error } = await admin.from('tenants').select('settings').eq('id', tenantId).single();
    if (error) throw error;
    return NextResponse.json({ confirmed: Boolean((data.settings as Record<string, unknown> || {}).outreach_acknowledged_at) });
  } catch (error) {
    return routeErrorResponse(error, 'Outreach acknowledgement could not be loaded', req);
  }
}

function createSupabaseAdmin() { return createAdminSupabaseClientOrThrow(); }

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await req.json();
    const access = await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.from('tenants').select('settings').eq('id', tenantId).single();
    if (error) throw error;
    const settings = (data.settings || {}) as Record<string, unknown>;
    if (!settings.outreach_acknowledged_at) {
      const { error: updateError } = await admin.from('tenants').update({
        settings: { ...settings, outreach_acknowledged_at: new Date().toISOString(), outreach_acknowledged_by: access.user.id },
      }).eq('id', tenantId);
      if (updateError) throw updateError;
    }
    return NextResponse.json({ confirmed: true });
  } catch (error) {
    return routeErrorResponse(error, 'Outreach acknowledgement could not be saved', req);
  }
}
