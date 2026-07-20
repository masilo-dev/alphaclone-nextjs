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

// ── Conversation / message persistence helpers ────────────────────────────────

async function upsertConversation(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  tenantId: string;
  userId: string;
  module?: string;
}): Promise<string | null> {
  try {
    // Find the most recent conversation for this user in this tenant
    const { data: existing } = await params.admin
      .from('bonnie_conversations')
      .select('id, updated_at')
      .eq('tenant_id', params.tenantId)
      .eq('user_id', params.userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Reuse if the conversation is less than 2 hours old (keeps sessions coherent)
    if (existing?.id) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      if (existing.updated_at > twoHoursAgo) {
        // Touch the updated_at so it stays "active"
        await params.admin
          .from('bonnie_conversations')
          .update({ updated_at: new Date().toISOString(), module: params.module || null })
          .eq('id', existing.id);
        return existing.id as string;
      }
    }

    // Create a new conversation
    const { data: created } = await params.admin
      .from('bonnie_conversations')
      .insert({
        tenant_id: params.tenantId,
        user_id: params.userId,
        module: params.module || null,
        title: 'Bonnie conversation',
      })
      .select('id')
      .single();

    return created?.id ?? null;
  } catch {
    return null;
  }
}

async function insertMessage(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  conversationId: string;
  tenantId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  tools?: unknown[] | null;
  approvalId?: string | null;
  executionStatus?: string | null;
  error?: boolean;
}): Promise<void> {
  try {
    await params.admin.from('bonnie_messages').insert({
      conversation_id: params.conversationId,
      tenant_id: params.tenantId,
      user_id: params.userId,
      role: params.role,
      content: params.content,
      tools: params.tools ?? null,
      approval_id: params.approvalId ?? null,
      execution_status: params.executionStatus ?? null,
      error: params.error ?? false,
    });
  } catch {
    // non-critical — message persistence should never break the stream
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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

    // Persist the conversation session and user message before streaming begins
    const conversationId = await upsertConversation({
      admin,
      tenantId,
      userId,
      module: moduleContext,
    });

    if (conversationId) {
      await insertMessage({
        admin,
        conversationId,
        tenantId,
        userId,
        role: 'user',
        content: instruction,
      });
    }

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
            conversationId: conversationId ?? undefined,
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

          // Persist the assistant response to the database
          if (conversationId) {
            await insertMessage({
              admin,
              conversationId,
              tenantId,
              userId,
              role: 'assistant',
              content: result.response,
              tools: mapToolResultsForApi(result.toolResults),
              approvalId: pending?.approvalId ?? null,
              executionStatus: result.executionStatus ?? null,
              error: !result.success,
            });
          }

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
            workflowId: result.workflowId ?? null,
            conversationId: conversationId ?? null,
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
