import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { dispatchHermesTask, isHermesConfigured } from '@/lib/hermes/client';
import { evaluateHermesPolicy, normalizeHermesPolicy } from '@/lib/hermes/policy';

export const dynamic = 'force-dynamic';

const createTaskSchema = z.object({
  tenantId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(20_000),
  sessionId: z.string().uuid().optional(),
  policy: z.enum(['READ', 'CREATE', 'EXTERNAL_ACTION', 'SENSITIVE']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '').trim();
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });

    const { admin } = await requireTenantAccess(tenantId, request);
    const { data, error } = await admin
      .from('agent_runs')
      .select('id, status, progress_pct, created_at, completed_at, metadata')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(request.nextUrl.searchParams.get('limit') || 50), 100));
    if (error) throw error;

    return NextResponse.json({ success: true, tasks: data || [], hermesConfigured: isHermesConfigured() });
  } catch (error) {
    return routeErrorResponse(error, 'Agent tasks could not be loaded', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createTaskSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid agent task', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const input = parsed.data;
    const { user, admin } = await requireTenantAccess(input.tenantId, request);
    const policy = normalizeHermesPolicy(input.policy);
    const decision = evaluateHermesPolicy(policy);

    const { data: task, error } = await admin
      .from('agent_runs')
      .insert({
        tenant_id: input.tenantId,
        user_id: user.id,
        conversation_id: input.sessionId || null,
        title: input.prompt.slice(0, 120),
        description: input.prompt,
        execution_mode: decision.requiresApproval ? 'approval_required' : 'semi_autonomous',
        status: decision.allowed ? 'pending' : 'waiting',
        progress_pct: 0,
        metadata: {
          ...(input.metadata || {}),
          runtime: 'hermes',
          policy,
          policyDecision: decision,
          prompt: input.prompt,
          sessionId: input.sessionId || null,
        },
      })
      .select('id, status, progress_pct, created_at, metadata')
      .single();
    if (error) throw error;

    if (!decision.allowed) {
      return NextResponse.json({
        success: true,
        task,
        dispatched: false,
        requiresApproval: decision.requiresApproval,
        reason: decision.reason,
      }, { status: 202 });
    }

    const dispatch = await dispatchHermesTask({
      tenantId: input.tenantId,
      userId: user.id,
      taskId: task.id,
      sessionId: input.sessionId,
      prompt: input.prompt,
      metadata: input.metadata,
    });

    await admin
      .from('agent_runs')
      .update({
        status: dispatch.dispatched ? (dispatch.status === 'local_queued' ? 'planning' : 'pending') : 'failed',
        metadata: {
          ...(task.metadata || {}),
          hermes: dispatch,
        },
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', task.id);

    return NextResponse.json({ success: true, taskId: task.id, dispatch }, { status: dispatch.dispatched ? 202 : 503 });
  } catch (error) {
    return routeErrorResponse(error, 'Agent task could not be created', request);
  }
}
