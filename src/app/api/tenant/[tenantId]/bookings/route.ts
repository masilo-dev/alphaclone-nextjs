import { NextResponse } from 'next/server';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
export async function GET(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { admin } = await requireTenantRole(tenantId, ['owner','admin','tenant_admin','super_admin'], req);
    const { data, error } = await admin.from('bookings')
      .select('id,client_name,client_email,start_time,end_time,status,video_call_id')
      .eq('tenant_id', tenantId).order('start_time', { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ bookings: data || [] });
  } catch (error) { return routeErrorResponse(error, 'Bookings could not be loaded', req); }
}
