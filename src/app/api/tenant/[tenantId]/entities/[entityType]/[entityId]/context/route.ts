import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { buildEntityContextSummary, type EntityType } from '@/lib/audit/entityTimelineService';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = new Set<EntityType>(['lead', 'client', 'contact', 'contract', 'invoice', 'project']);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; entityType: string; entityId: string }> },
) {
  try {
    const { tenantId, entityType, entityId } = await params;
    if (!ALLOWED_TYPES.has(entityType)) {
      return NextResponse.json({ error: 'Unsupported entity type' }, { status: 400 });
    }

    const { admin } = await requireTenantAccess(tenantId, req);
    const context = await buildEntityContextSummary(
      admin,
      tenantId,
      entityType as EntityType,
      entityId,
    );

    return NextResponse.json({ success: true, entity_type: entityType, entity_id: entityId, ...context });
  } catch (error) {
    return routeErrorResponse(error, 'Unable to load business context', req);
  }
}
