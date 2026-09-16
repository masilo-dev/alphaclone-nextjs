import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import 'server-only';

import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { getTenantRecentActivity } from '@/services/finance/workspaceActivityService';

const schema = z.object({
  tenantId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = schema.safeParse({
      tenantId: searchParams.get('tenantId'),
      limit: searchParams.get('limit'),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Valid tenantId is required.' },
        { status: 400 }
      );
    }
    const { tenantId, limit } = parsed.data;
    const { admin } = await requireTenantAccess(tenantId, req);
    const { activity } = await getTenantRecentActivity(admin, tenantId, {
      limit: limit ?? 50,
    });
    return NextResponse.json({ activity });
  } catch (error) {
    return routeErrorResponse(error, 'Workspace activity could not be loaded', req);
  }
}
