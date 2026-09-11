import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { chaseOpenGoals, runCognitiveLoop } from '@/lib/bonnie/os';

export const dynamic = 'force-dynamic';

/**
 * Autonomous goal chasing for Bonnie Agentic BOS.
 * Resumes active/monitoring/blocked goals per tenant.
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const supabase = createSupabaseAdminClient();
  const ranAt = new Date().toISOString();

  try {
    const { data: tenants, error } = await supabase.from('tenants').select('id').limit(200);
    if (error) throw error;

    const results: Array<Record<string, unknown>> = [];

    for (const tenant of tenants || []) {
      const tenantId = tenant.id as string;
      try {
        const chased = await chaseOpenGoals({
          tenantId,
          limit: 5,
          runCognitive: async (goal) =>
            runCognitiveLoop({
              tenantId,
              goal: goal.description || goal.title,
              triggerType: 'continuous',
              goalId: goal.id,
              conversationId: goal.conversation_id || undefined,
              workflowId: goal.workflow_id || undefined,
              executeActions: true,
            }),
        });
        results.push({ tenantId, success: true, ...chased });
      } catch (tenantErr: unknown) {
        const message = tenantErr instanceof Error ? tenantErr.message : String(tenantErr);
        results.push({ tenantId, success: false, error: message });
      }
    }

    try {
      await supabase.from('automation_cron_logs').insert({
        trigger_type: 'bonnie-goals-chase',
        status: 'success',
        payload: { processed: results.length, results: results.slice(0, 50) },
        ran_at: ranAt,
      });
    } catch {
      // Best-effort telemetry
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      timestamp: ranAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
