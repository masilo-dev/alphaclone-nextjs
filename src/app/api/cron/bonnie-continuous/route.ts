import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { refreshDigitalTwin } from '@/lib/bonnie/os/digitalTwin';
import { syncBusinessKnowledgeGraph } from '@/lib/bonnie/os/knowledgeGraph';
import { runCognitiveLoop } from '@/lib/bonnie/os/cognitiveLoop';

export const dynamic = 'force-dynamic';

/**
 * Continuous observation for Bonnie Agentic OS.
 * Refreshes digital twin + knowledge graph per tenant; runs a lightweight
 * cognitive monitor when health risk is elevated.
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

        const health = Number(twin.snapshot.kpis.health_score || 100);
        if (health < 75 || (twin.snapshot.risks || []).length > 0) {
          const cognitive = await runCognitiveLoop({
            tenantId,
            goal: 'Continuous business monitor: review digital twin risks, prioritize next actions across departments, and update memory with actionable patterns.',
            triggerType: 'continuous',
            executeActions: true,
          });
          cognitiveRunId = cognitive.runId;
          cognitiveStatus = cognitive.status;
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
