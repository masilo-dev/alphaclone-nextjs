/**
 * Verification Agent — fresh-data checks; tool success ≠ goal success.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { VerificationResult } from './schemas';
import { verificationResultSchema } from './schemas';

export async function verifyRunOutcomes(params: {
  tenantId: string;
  runId: string;
}): Promise<VerificationResult> {
  const admin = createSupabaseAdminClient();
  const { data: tasks } = await admin
    .from('agent_tasks')
    .select('id, status, title, task_type, structured_output, failure_reason, idempotency_key')
    .eq('run_id', params.runId)
    .eq('tenant_id', params.tenantId);

  const list = tasks || [];
  const checks: VerificationResult['checks'] = [];

  const completed = list.filter((t) => t.status === 'COMPLETED' || t.status === 'SKIPPED');
  const failed = list.filter((t) => t.status === 'FAILED');
  const uncertain = list.filter((t) => t.status === 'EXECUTION_UNCERTAIN');
  const waiting = list.filter((t) =>
    String(t.status).startsWith('WAITING_') || t.status === 'RETRY_SCHEDULED' || t.status === 'PAUSED'
  );
  const running = list.filter((t) =>
    ['READY', 'QUEUED', 'CLAIMED', 'RUNNING', 'DRAFT'].includes(t.status)
  );

  checks.push({
    name: 'all_tasks_terminal_or_waiting_ok',
    passed: running.length === 0,
    detail: `${running.length} still runnable, ${waiting.length} waiting, ${completed.length} done, ${failed.length} failed`,
  });

  checks.push({
    name: 'no_uncertain_executions',
    passed: uncertain.length === 0,
    detail: uncertain.length
      ? uncertain.map((t) => t.title).join('; ')
      : 'No uncertain executions',
  });

  // External refs present for completed side-effect tasks
  const { data: refs } = await admin
    .from('agent_external_references')
    .select('id, task_id')
    .eq('tenant_id', params.tenantId)
    .in(
      'task_id',
      completed.map((t) => t.id).length ? completed.map((t) => t.id) : ['00000000-0000-0000-0000-000000000000']
    );

  const refTaskIds = new Set((refs || []).map((r) => r.task_id));
  const sideEffectTasks = completed.filter(
    (t) => t.task_type === 'specialist' || t.task_type === 'communicate'
  );
  const missingRefs = sideEffectTasks.filter((t) => !refTaskIds.has(t.id));
  checks.push({
    name: 'side_effects_have_provider_refs',
    passed: missingRefs.length === 0,
    detail:
      missingRefs.length === 0
        ? 'Provider references recorded'
        : `Missing refs: ${missingRefs.map((t) => t.title).join(', ')}`,
  });

  // Idempotency: no duplicate completed keys for this run's tasks
  const keys = completed.map((t) => t.idempotency_key).filter(Boolean) as string[];
  let dupes = 0;
  if (keys.length) {
    const { data: idems } = await admin
      .from('agent_idempotency_keys')
      .select('idempotency_key, state')
      .eq('tenant_id', params.tenantId)
      .in('idempotency_key', keys);
    const seen = new Set<string>();
    for (const row of idems || []) {
      if (seen.has(row.idempotency_key)) dupes += 1;
      seen.add(row.idempotency_key);
    }
  }
  checks.push({
    name: 'no_duplicate_idempotency_completions',
    passed: dupes === 0,
    detail: dupes === 0 ? 'No duplicates' : `${dupes} duplicate key rows`,
  });

  const allPassed = checks.every((c) => c.passed);
  let outcome: VerificationResult['outcome'] = 'UNVERIFIED';
  if (running.length > 0 || waiting.length > 0) outcome = 'BLOCKED';
  else if (uncertain.length > 0) outcome = 'BLOCKED';
  else if (failed.length && completed.length) outcome = 'COMPLETED_WITH_EXCEPTIONS';
  else if (failed.length && !completed.length) outcome = 'FAILED';
  else if (allPassed && completed.length) outcome = 'COMPLETED';
  else if (completed.length) outcome = 'PARTIALLY_COMPLETED';

  const result = verificationResultSchema.parse({
    verified: outcome === 'COMPLETED' || outcome === 'COMPLETED_WITH_EXCEPTIONS',
    outcome,
    checks,
    summary: `Verification ${outcome}: ${completed.length} completed, ${failed.length} failed, ${waiting.length} waiting, ${uncertain.length} uncertain.`,
  });

  // Persist verification row if table exists (additive migration)
  try {
    await admin.from('agent_verifications').insert({
      tenant_id: params.tenantId,
      run_id: params.runId,
      verification_type: 'goal_outcome',
      expected_outcome: 'COMPLETED',
      actual_outcome: result.outcome,
      status: result.verified ? 'passed' : outcome === 'BLOCKED' ? 'inconclusive' : 'failed',
      evidence: {
        verified: result.verified,
        checks: result.checks,
        summary: result.summary,
      },
      verified_at: new Date().toISOString(),
    });
  } catch {
    // table may not exist until migration is applied on Railway/Supabase
  }

  if (result.verified || outcome === 'FAILED' || outcome === 'COMPLETED_WITH_EXCEPTIONS') {
    await admin
      .from('agent_runs')
      .update({
        status:
          outcome === 'COMPLETED'
            ? 'completed'
            : outcome === 'COMPLETED_WITH_EXCEPTIONS'
              ? 'completed_with_exceptions'
              : outcome === 'FAILED'
                ? 'failed'
                : 'partially_completed',
        progress_pct: outcome.startsWith('COMPLETED') ? 100 : undefined,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_progress_at: new Date().toISOString(),
      })
      .eq('id', params.runId)
      .eq('tenant_id', params.tenantId);
  }

  return result;
}

export async function verifyTaskSideEffect(params: {
  tenantId: string;
  taskId: string;
  expectedProvider?: string;
}): Promise<{ ok: boolean; detail: string }> {
  const admin = createSupabaseAdminClient();
  const { data: refs } = await admin
    .from('agent_external_references')
    .select('*')
    .eq('tenant_id', params.tenantId)
    .eq('task_id', params.taskId)
    .limit(5);

  if (!refs?.length) {
    return { ok: false, detail: 'No external provider reference found' };
  }
  if (params.expectedProvider && !refs.some((r) => r.provider === params.expectedProvider)) {
    return { ok: false, detail: `Expected provider ${params.expectedProvider} not found` };
  }
  return { ok: true, detail: `Found ${refs.length} provider reference(s)` };
}
