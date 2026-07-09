import { NextRequest } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { runBonnieAgent } from '@/lib/bonnie/bonnieAgent';
import { mapToolResultsForApi, findPendingApproval } from '@/lib/bonnie/bonnieApiMappers';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { consumeAiUnitsOr429 } from '@/lib/quotas/tenantAiUnitsQuota';
import { UNITS_PER_CHAT_TURN } from '@/config/aiUsageQuotas';

export const runtime = 'nodejs';
export const maxDuration = 120;

function sseEncode(event: string, data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId || '').trim();
    const instruction = String(body.instruction || '').trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const pathname = String(body.pathname || '').trim();
    const moduleContext = body.moduleContext ? String(body.moduleContext).trim() : undefined;

    if (!tenantId || !instruction) {
      return new Response(JSON.stringify({ error: 'tenantId and instruction are required' }), { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId);
    const supabase = await createSupabaseServerClient();
    const { data: authUser } = await supabase.auth.getUser();
    const userId = authUser.user?.id || user.id;

    const admin = createSupabaseAdminClient();
    const { data: tenantRow } = await admin.from('tenants').select('subscription_plan').eq('id', tenantId).maybeSingle();
    const blocked = await consumeAiUnitsOr429(admin, tenantId, (tenantRow?.subscription_plan as string) || 'free', UNITS_PER_CHAT_TURN);
    if (blocked) return blocked;

    const stream = new ReadableStream({
      async start(controller) {
        const push = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(sseEncode(event, data));
        };

        try {
          push('phase', { phase: 'thinking' });

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
            onStreamToken: (token) => push('token', { text: token }),
          });

          if (result.toolResults.length > 0) {
            push('phase', { phase: 'executing' });
            push('tools', { tools: mapToolResultsForApi(result.toolResults) });
          }

          const pending = findPendingApproval(result.toolResults);

          push('done', {
            success: result.success,
            response: result.response,
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
            rounds: result.rounds,
            executionStatus: result.executionStatus,
          });
        } catch (error: any) {
          push('error', { message: error?.message || 'Bonnie stream failed' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Bonnie stream failed', request);
  }
}
