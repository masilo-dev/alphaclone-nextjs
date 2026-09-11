import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { isExecutionFeatureEnabled } from '@/lib/projects/executionFeatureFlags';
import { getListmonkHealth, isListmonkConfigured } from '@/lib/marketing/listmonkClient';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId } = await context.params;
    const { admin } = await requireTenantAccess(tenantId, req);
    const enabled = await isExecutionFeatureEnabled(admin, 'LISTMONK_ENABLED', tenantId);

    if (!enabled) {
      return NextResponse.json({
        enabled: false,
        configured: isListmonkConfigured(),
        healthy: false,
        state: 'disabled',
      });
    }

    const health = await getListmonkHealth();
    return NextResponse.json({
      enabled: true,
      configured: health.configured,
      healthy: health.ok,
      state: health.ok ? 'healthy' : 'degraded',
      error: health.ok ? null : health.error,
    }, { status: health.ok ? 200 : 503 });
  } catch (error) {
    return routeErrorResponse(error, 'Listmonk health could not be checked', req);
  }
}
