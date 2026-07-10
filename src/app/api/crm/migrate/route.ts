import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { dataMigrationService } from '@/services/migration/DataMigrationService';

const bodySchema = z.object({
  tenantId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
    }

    await requireTenantAccess(parsed.data.tenantId);
    const result = await dataMigrationService.runFullMigration();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return routeErrorResponse(error, 'CRM migration failed', req);
  }
}
