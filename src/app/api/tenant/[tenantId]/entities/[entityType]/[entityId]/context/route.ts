import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { buildEntityContextSummary, type EntityType } from '@/lib/audit/entityTimelineService';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = new Set<EntityType>(['lead', 'client', 'contact', 'contract', 'invoice', 'project']);

function parseEntityType(value: string): EntityType | null {
  return ALLOWED_TYPES.has(value as EntityType) ? (value as EntityType) : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; entityType: string; entityId: string }> },
) {
  try {
    const { tenantId, entityType, entityId } = await params;
    const parsedEntityType = parseEntityType(entityType);
    if (!parsedEntityType) {
      return NextResponse.json({ error: 'Unsupported entity type' }, { status: 400 });
    }

    const { admin } = await requireTenantAccess(tenantId, req);
    const context = await buildEntityContextSummary(
      admin,
      tenantId,
      parsedEntityType,
      entityId,
    );

    return NextResponse.json({ success: true, entity_type: entityType, entity_id: entityId, ...context });
  } catch (error) {
    return routeErrorResponse(error, 'Unable to load business context', req);
  }
}
