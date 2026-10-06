import { NextResponse } from 'next/server';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';
export async function POST(req: Request) {
  try {
    const { tenantId } = z.object({ tenantId: z.string().uuid() }).parse(await req.json());
    await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);
    return NextResponse.json({ error: 'Add-on checkout unavailable until production products and tax are configured' }, { status: 503 });
  } catch (error) { return routeErrorResponse(error, 'Add-on checkout is unavailable', req); }
}
