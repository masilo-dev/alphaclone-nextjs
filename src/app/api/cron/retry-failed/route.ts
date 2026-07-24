import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { start } from 'workflow/api';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { guardCronTenantRow } from '@/lib/tenant/cronTenantGuard';

export const dynamic = 'force-dynamic';

// Workflow map for retries
import { dealStageChangedWorkflow } from '@/workflows/deal-flows';
import { invoiceOverdueWorkflow } from '@/workflows/invoice-flows';
import { leadCreatedWorkflow } from '@/workflows/lead-flows';
import { contractSignedWorkflow } from '@/workflows/contract-flows';
import { taskOverdueWorkflow } from '@/workflows/task-flows';

const WORKFLOW_MAP: Record<string, any> = {
  'deal_stage_changed': dealStageChangedWorkflow,
  'invoice_overdue': invoiceOverdueWorkflow,
  'lead_created': leadCreatedWorkflow,
  'contract_signed': contractSignedWorkflow,
  'task_overdue': taskOverdueWorkflow,
};

/**
 * Retry Sweeper
 * Identifies failed automation runs and re-queues them using exponential backoff.
 * Backoff: 1m, 5m, 15m.
 */
export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;

  const supabase = createSupabaseAdminClient();
  const ranAt = new Date().toISOString();

  try {
    // 1. Find failed runs that are eligible for retry
    // Eligibility: status='failed', retries < 3, updated_at < (now - delay)
    // Prefer retries column when present; fall back to filtering in memory for older schemas.
    let failedRuns: any[] | null = null;
    let fetchError: { message?: string } | null = null;

    {
      const primary = await supabase
        .from('automation_runs')
        .select('*')
        .eq('status', 'failed')
        .lt('retries', 3)
        .order('updated_at', { ascending: true });
      failedRuns = primary.data;
      fetchError = primary.error;
    }

    if (fetchError && /retries/i.test(fetchError.message || '')) {
      const fallback = await supabase
        .from('automation_runs')
        .select('*')
        .eq('status', 'failed')
        .order('updated_at', { ascending: true });
      failedRuns = (fallback.data || []).filter((run) => Number(run.retries || 0) < 3);
      fetchError = fallback.error;
    }

    if (fetchError) throw fetchError;

    if (!failedRuns || failedRuns.length === 0) {
      return NextResponse.json({ success: true, message: 'No runs to retry' });
    }

    const retriedCount = [];

    for (const run of failedRuns) {
      const retryCount = Number(run.retries || 0);
      const delayMinutes = [1, 5, 15][retryCount] || 60;
      const lastAttempt = new Date(run.updated_at).getTime();
      const now = Date.now();

      if (now - lastAttempt < delayMinutes * 60 * 1000) {
        continue; // Not yet time for retry
      }

      const guard = await guardCronTenantRow(run, 'automation_runs', {
        workflow_type: run.workflow_type,
      });
      if (!guard.ok) {
        continue;
      }

      try {
        const workflow = WORKFLOW_MAP[run.workflow_type];
        if (!workflow) throw new Error(`Unknown workflow type: ${run.workflow_type}`);

        // Re-start the workflow
        // In a real system, you might want to resume from the last failed step, 
        // but here we restart with the original payload stored in history or step logs.
        // For simplicity, we assume we can restart with the context we have.
        const { runId: newRunId } = await start(workflow, [
          { 
            tenantId: run.tenant_id, 
            payload: run.steps?.[0]?.context || {}, // Try to recover context from steps log
            retryOf: run.id 
          }
        ]);

        // Update the old run as 'retrying' and increment counter
        await supabase
          .from('automation_runs')
          .update({
            status: 'retrying',
            retries: retryCount + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', run.id);

        retriedCount.push({ oldRunId: run.id, newRunId });

      } catch (err: any) {
        console.error(`[Automation] Failed to retry run ${run.id}:`, err.message);
      }
    }

    await logCron('retry-failed', 'success', { retriedCount }, ranAt);
    return NextResponse.json({ success: true, retried_count: retriedCount.length, results: retriedCount });

  } catch (error: any) {
    console.error('[Automation] Retry sweeper failed:', error.message);
    await logCron('retry-failed', 'failed', { error: error.message }, ranAt);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function logCron(trigger: string, status: string, payload: any, ranAt: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.from('automation_cron_logs').insert({
    trigger_type: trigger,
    status,
    payload,
    ran_at: ranAt,
    error_message: status === 'failed' ? payload.error : null
  });
}
