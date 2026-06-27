import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { runBonnieAgent } from '@/lib/bonnie/bonnieAgent';
import { mapToolResultsForApi, findPendingApproval } from '@/lib/bonnie/bonnieApiMappers';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { consumeAiUnitsOr429 } from '@/lib/quotas/tenantAiUnitsQuota';
import { UNITS_PER_CHAT_TURN } from '@/config/aiUsageQuotas';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId || '').trim();
    const instruction = String(body.instruction || '').trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const pathname = String(body.pathname || '').trim();
    const moduleContext = body.moduleContext ? String(body.moduleContext).trim() : undefined;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    if (!instruction) {
      return NextResponse.json({ error: 'instruction is required' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId);
    const supabase = await createSupabaseServerClient();
    const { data: authUser } = await supabase.auth.getUser();
    const userId = authUser.user?.id || user.id;

    const admin = createSupabaseAdminClient();
    const { data: tenantRow } = await admin.from('tenants').select('subscription_plan').eq('id', tenantId).maybeSingle();
    const blocked = await consumeAiUnitsOr429(admin, tenantId, (tenantRow?.subscription_plan as string) || 'free', UNITS_PER_CHAT_TURN);
    if (blocked) return blocked;

    const result = await runBonnieAgent({
      tenantId,
      userId,
      instruction,
      pathname: pathname || undefined,
      moduleContext: moduleContext as any,
      history: history
        .filter((m: any) => m?.role && m?.content)
        .slice(-8)
        .map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content),
        })),
    });

    const pending = findPendingApproval(result.toolResults);

    return NextResponse.json({
      success: result.success,
      response: result.response,
      provider: result.provider,
      model: result.model,
      toolsExecuted: mapToolResultsForApi(result.toolResults),
      pendingApproval: pending
        ? {
            approvalId: pending.approvalId,
            tool: pending.tool,
            riskClass: pending.riskClass,
            preview: pending.preview,
            summary: pending.summary,
          }
        : null,
      logs: result.logs,
      rounds: result.rounds,
    });
  } catch (error) {
    console.error('[bonnie/instruct] failed:', error);
    return routeErrorResponse(error, 'Bonnie could not process that instruction. Try again in a moment.', request);
  }
}
