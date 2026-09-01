import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { requestOutcome } from '@/lib/mcp/outcomeOrchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const tenantId = String(body.tenantId || body.tenant_id || '');
    const { user } = await requireTenantAccess(tenantId, request);

    const result = await requestOutcome({
      tenantId,
      userId: user.id,
      outcome_key: typeof body.outcome_key === 'string' ? body.outcome_key : undefined,
      intent: typeof body.intent === 'string' ? body.intent : undefined,
      objective: typeof body.objective === 'string' ? body.objective : undefined,
      params: (body.params as Record<string, unknown>) || body,
      idempotency_key: typeof body.idempotency_key === 'string' ? body.idempotency_key : undefined,
      source: 'api:bonnie/outcomes/execute',
    });

    return NextResponse.json({ success: result.ok, ...result });
  } catch (error) {
    return routeErrorResponse(error, 'Outcome execution could not be started', request);
  }
}
