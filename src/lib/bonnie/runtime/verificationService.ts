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
    .select('id, status, title, task_type, structured_input, structured_output, failure_reason, idempotency_key')
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
    (t) =>
      t.task_type === 'specialist' ||
      t.task_type === 'communicate' ||
      t.task_type === 'social.publish' ||
      t.task_type === 'email.send' ||
      t.task_type === 'invoice.send' ||
      t.task_type === 'contract.lifecycle' ||
      t.task_type === 'contract.signed' ||
      t.task_type === 'outcome.execute_step'
  );
  const missingRefs = sideEffectTasks.filter((t) => {
    if (refTaskIds.has(t.id)) return false;
    if (t.task_type === 'outcome.execute_step') {
      const input = (t.structured_input || {}) as Record<string, unknown>;
      const output = (t.structured_output || {}) as Record<string, unknown>;
      const mode = input.mode;
      if (mode !== 'execute_now') return false;
      const tool = String(input.tool || '');
      if (tool.includes('publish') || tool === 'send_email') {
        return !output.provider_reference && !output.message_id && !output.social_post_id;
      }
      return false;
    }
    if (t.task_type === 'email.send') {
      const output = (t.structured_output || {}) as Record<string, unknown>;
      return !output.message_id && !output.provider;
    }
    if (t.task_type === 'social.publish') {
      const output = (t.structured_output || {}) as Record<string, unknown>;
      return !output.provider_reference && !output.external_id;
    }
    if (t.task_type === 'invoice.send') {
      const output = (t.structured_output || {}) as Record<string, unknown>;
      return !output.message_id && output.lifecycle_status !== 'sent';
    }
    if (t.task_type === 'contract.lifecycle') {
      const output = (t.structured_output || {}) as Record<string, unknown>;
      return output.status !== 'sent' && !output.contract_id;
    }
    if (t.task_type === 'contract.signed') {
      const output = (t.structured_output || {}) as Record<string, unknown>;
      return !output.project_id && !output.contract_id;
    }
    return true;
  });
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

/**
 * Business Outcome Verification
 * ─────────────────────────────────────────────────────────────────────────────
 * Asserts that a completed agent task produced a **verifiable business effect**,
 * not just a technical HTTP 200 response.
 *
 * verification_tier:
 *   'technical'  → tool returned success (necessary but not sufficient)
 *   'provider'   → external provider reference recorded (e.g. LinkedIn post ID)
 *   'db_state'   → downstream DB record reached the expected state
 *   'delivery'   → confirmed read/delivery signal from provider
 */
export type OutcomeVerificationTier =
  | 'technical'
  | 'provider'
  | 'db_state'
  | 'delivery';

export type BusinessOutcomeResult = {
  taskId: string;
  tier: OutcomeVerificationTier;
  verified: boolean;
  detail: string;
};

/**
 * Verify a task produced a real business outcome beyond a technical success flag.
 * Maps task_type to the appropriate evidence check.
 */
export async function verifyBusinessOutcome(params: {
  tenantId: string;
  taskId: string;
  taskType?: string;
  structuredOutput?: Record<string, unknown>;
}): Promise<BusinessOutcomeResult> {
  const admin = createSupabaseAdminClient();
  const { tenantId, taskId, taskType, structuredOutput } = params;

  // 1. Social / outreach publishing — require provider external reference
  if (
    taskType === 'communicate' ||
    taskType === 'publish' ||
    taskType === 'social.publish' ||
    (structuredOutput?.tool_name as string | undefined)?.startsWith('publish_')
  ) {
    const { data: refs } = await admin
      .from('agent_external_references')
      .select('id, provider, external_id')
      .eq('tenant_id', tenantId)
      .eq('task_id', taskId)
      .limit(1);

    if (!refs?.length) {
      return {
        taskId,
        tier: 'technical',
        verified: false,
        detail: 'Social/outreach tool returned success but no provider post ID was recorded. Technical 200 ≠ published.',
      };
    }
    return {
      taskId,
      tier: 'provider',
      verified: true,
      detail: `Provider ${refs[0].provider} confirmed with external ID ${refs[0].external_id}.`,
    };
  }

  // 2. Invoice send — require provider message id or sent lifecycle state
  if (taskType === 'invoice.send') {
    const messageId = structuredOutput?.message_id;
    const lifecycleStatus = structuredOutput?.lifecycle_status;
    if (messageId || lifecycleStatus === 'sent') {
      return {
        taskId,
        tier: 'provider',
        verified: true,
        detail: messageId
          ? `Invoice send verified with message ID ${messageId}.`
          : 'Invoice marked sent with delivery evidence.',
      };
    }
    return {
      taskId,
      tier: 'technical',
      verified: false,
      detail: 'Invoice send task completed without provider message ID or sent state.',
    };
  }

  // 3. Email send — require provider message id in structured output
  if (taskType === 'email.send' || (structuredOutput?.tool_name as string | undefined) === 'send_email') {
    const messageId = structuredOutput?.message_id || structuredOutput?.emailId;
    const provider = structuredOutput?.provider;
    if (messageId && provider) {
      return {
        taskId,
        tier: 'provider',
        verified: true,
        detail: `Email accepted by ${provider} with message ID ${messageId}.`,
      };
    }
    return {
      taskId,
      tier: 'technical',
      verified: false,
      detail: 'Email task completed without provider message ID — delivery unverified.',
    };
  }

  // 4. Outcome execute step — map tool to evidence tier
  if (taskType === 'outcome.execute_step') {
    const tool = String(structuredOutput?.tool || '');
    if (tool.includes('publish')) {
      const postId = structuredOutput?.social_post_id;
      const providerRef = structuredOutput?.provider_reference;
      if (providerRef || postId) {
        return {
          taskId,
          tier: 'provider',
          verified: true,
          detail: providerRef
            ? `Outcome publish verified with provider reference ${providerRef}.`
            : `Outcome publish recorded social_post_id ${postId}.`,
        };
      }
    }
    if (tool === 'send_email') {
      const messageId = structuredOutput?.message_id;
      if (messageId) {
        return {
          taskId,
          tier: 'provider',
          verified: true,
          detail: `Outcome email verified with message ID ${messageId}.`,
        };
      }
    }
  }

  // 5. Invoice / billing — require invoice row in terminal state
  if (taskType === 'billing' || (structuredOutput?.tool_name as string | undefined)?.includes('invoice')) {
    const invoiceId = structuredOutput?.invoice_id as string | undefined;
    if (invoiceId) {
      const { data: invoice } = await admin
        .from('business_invoices')
        .select('id, status')
        .eq('tenant_id', tenantId)
        .eq('id', invoiceId)
        .maybeSingle();

      if (!invoice) {
        return { taskId, tier: 'technical', verified: false, detail: `Invoice ${invoiceId} not found in DB.` };
      }
      const terminalStates = ['sent', 'paid', 'overdue', 'cancelled'];
      const isTerminal = terminalStates.includes(invoice.status);
      return {
        taskId,
        tier: 'db_state',
        verified: isTerminal,
        detail: isTerminal
          ? `Invoice ${invoiceId} is in state: ${invoice.status}.`
          : `Invoice ${invoiceId} still in draft state. Was it actually sent?`,
      };
    }
  }

  // 6. Contract — require contract row in non-draft state
  if (taskType === 'contract' || (structuredOutput?.tool_name as string | undefined)?.includes('contract')) {
    const contractId = structuredOutput?.contract_id as string | undefined;
    if (contractId) {
      const { data: contract } = await admin
        .from('contracts')
        .select('id, status')
        .eq('tenant_id', tenantId)
        .eq('id', contractId)
        .maybeSingle();

      if (!contract) {
        return { taskId, tier: 'technical', verified: false, detail: `Contract ${contractId} not found in DB.` };
      }
      const actionStates = ['sent', 'signed', 'countered', 'accepted', 'active'];
      const isActioned = actionStates.includes(contract.status);
      return {
        taskId,
        tier: 'db_state',
        verified: isActioned,
        detail: isActioned
          ? `Contract ${contractId} is in state: ${contract.status}.`
          : `Contract ${contractId} still in draft/pending. No business action confirmed.`,
      };
    }
  }

  // 7. General specialist tasks — fall back to provider ref check
  const { data: refs } = await admin
    .from('agent_external_references')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('task_id', taskId)
    .limit(1);

  if (refs?.length) {
    return { taskId, tier: 'provider', verified: true, detail: 'Provider reference recorded.' };
  }

  // Fallback: cannot verify beyond technical execution
  return {
    taskId,
    tier: 'technical',
    verified: false,
    detail: 'No downstream business evidence found. Tool may have succeeded technically but outcome is unverified.',
  };
}
