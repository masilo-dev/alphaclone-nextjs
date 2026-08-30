import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { refreshDigitalTwin } from '@/lib/bonnie/os/digitalTwin';
import { syncBusinessKnowledgeGraph } from '@/lib/bonnie/os/knowledgeGraph';
import { chaseOpenGoals, runCognitiveLoop } from '@/lib/bonnie/os';

export const dynamic = 'force-dynamic';

/**
 * Continuous observation for Bonnie Agentic OS.
 * Refreshes digital twin + knowledge graph per tenant; runs a lightweight
 * cognitive monitor when health risk is elevated; chases open goals.
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
      const tenantId = tenant.id;
      try {
        const twin = await refreshDigitalTwin(tenantId, 'continuous');
        const kg = await syncBusinessKnowledgeGraph(tenantId, 40);
        let cognitiveRunId: string | null = null;
        let cognitiveStatus: string | null = null;
        let goalsChased = 0;

        const health = Number(twin.snapshot.kpis.health_score || 100);
        const hasRisks = (twin.snapshot.risks || []).length > 0;
        const cognitive = await runCognitiveLoop({
          tenantId,
          goal: health < 75 || hasRisks
            ? 'Continuous business monitor: review digital twin risks, prioritize next actions across departments, and update memory with actionable patterns.'
            : 'Lightweight continuous monitor: refresh workspace health, scan for blockers, and queue follow-ups without mutating data unless critical.',
          triggerType: 'continuous',
          executeActions: health < 75 || hasRisks,
        });
        cognitiveRunId = cognitive.runId;
        cognitiveStatus = cognitive.status;

        try {
          const chase = await chaseOpenGoals({
            tenantId,
            limit: 3,
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
          goalsChased = chase.chased;
        } catch (chaseErr) {
          console.warn('[bonnie-continuous] goal chase failed:', chaseErr);
        }

        results.push({
          tenantId,
          success: true,
          twinId: twin.id,
          health,
          kgNodes: kg.nodes,
          kgEdges: kg.edges,
          cognitiveRunId,
          cognitiveStatus,
          goalsChased,
        });
      } catch (tenantErr: unknown) {
        const message = tenantErr instanceof Error ? tenantErr.message : String(tenantErr);
        results.push({ tenantId, success: false, error: message });
      }
    }

    try {
      await supabase.from('automation_cron_logs').insert({
        trigger_type: 'bonnie-continuous',
        status: 'success',
        payload: { processed: results.length, results: results.slice(0, 50) },
        ran_at: ranAt,
      });
    } catch {
      // Best-effort cron log; never fail the continuous runner on telemetry writes.
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
