import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getPlaybookDefinition } from './playbookService';
import { verifyInvoiceSent, verifyLeadCreated, verifyOutreachDelivery, verifySocialPostPublished } from './verificationService';
import { classifyActionRisk } from '@/lib/mcp/capabilityManifest';
import { sanitizeForAudit } from '@/lib/mcp/actionReceipts';

type RuntimeContext = {
  tenantId: string;
  userId: string;
  inputs: Record<string, unknown>;
  autoHighRisk: boolean;
};

const WORKFLOW_STATES = new Set([
  'queued',
  'running',
  'awaiting_approval',
  'partially_completed',
  'completed',
  'failed',
  'cancelled',
]);

function isHighRiskAction(action: string): boolean {
  return (
    action === 'send_outreach' ||
    action === 'send_invoice_reminder' ||
    action.startsWith('bulk_') ||
    classifyActionRisk(action) !== 'none'
  );
}

function normalizeStatus(status: string): string {
  if (status === 'approval_required') return 'awaiting_approval';
  return WORKFLOW_STATES.has(status) ? status : status;
}

async function createPortableApproval(params: {
  tenantId: string;
  userId: string;
  runId: string;
  stepId: string;
  action: string;
  riskLevel: string;
  inputs: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const summary = `Approve ${params.action} for workflow run ${params.runId}`;
  const { data, error } = await supabase
    .from('automation_approvals')
    .insert({
      tenant_id: params.tenantId,
      run_id: params.runId,
      step_id: params.stepId,
      status: 'pending',
      reason: summary,
      action_summary: summary,
      risk_level: params.riskLevel,
      expires_at: expiresAt,
      approve_tool: 'approve_workflow_step',
      reject_tool: 'reject_workflow_step',
      client_portable: true,
      correlation_id: crypto.randomUUID(),
      payload: sanitizeForAudit({
        action: params.action,
        inputs: params.inputs,
        requested_by: params.userId,
      }),
    })
    .select('id, expires_at, approve_tool, reject_tool, risk_level, action_summary')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function startPlaybookRun(params: RuntimeContext & { playbookId: string }) {
  const supabase = createSupabaseAdminClient();
  const playbook = getPlaybookDefinition(params.playbookId);
  if (!playbook) {
    return { success: false, error: `Unknown playbook: ${params.playbookId}` };
  }

  const idempotencyKey =
    typeof params.inputs.idempotency_key === 'string' && params.inputs.idempotency_key.trim()
      ? params.inputs.idempotency_key.trim()
      : null;

  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from('automation_runs')
      .select('id, playbook_id, status, started_at, finished_at')
      .eq('tenant_id', params.tenantId)
      .eq('idempotency_key', idempotencyKey)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      return {
        success: true,
        deduplicated: true,
        run: { ...existing, status: normalizeStatus(String(existing.status)) },
      };
    }
  }

  const { data: run, error: runError } = await supabase
    .from('automation_runs')
    .insert({
      tenant_id: params.tenantId,
      user_id: params.userId,
      playbook_id: playbook.id,
      status: 'queued',
      inputs: params.inputs,
      policy: { auto_high_risk: params.autoHighRisk },
      idempotency_key: idempotencyKey,
      started_at: new Date().toISOString(),
    })
    .select('id, playbook_id, status, started_at')
    .single();

  if (runError || !run) {
    return { success: false, error: runError?.message || 'Failed to create automation run' };
  }

  // Insert steps BEFORE executing so the runner never races an empty step list
  for (const step of playbook.steps) {
    await supabase.from('automation_run_steps').insert({
      tenant_id: params.tenantId,
      run_id: run.id,
      step_id: step.id,
      action: step.action,
      status: 'queued',
      attempt_count: 0,
      risk_level: step.risk,
      input: params.inputs,
    });
  }

  await supabase
    .from('automation_runs')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('tenant_id', params.tenantId)
    .eq('id', run.id);

  executeRun(run.id, params.tenantId, params.autoHighRisk).catch((err) => {
    console.error(`[Automation] Background execution failed for run ${run.id}:`, err);
  });

  return { success: true, run: { ...run, status: 'running' } };
}

export async function executeRun(runId: string, tenantId: string, autoHighRisk: boolean) {
  const supabase = createSupabaseAdminClient();
  const { data: run, error: runError } = await supabase
    .from('automation_runs')
    .select('id, tenant_id, status, playbook_id, inputs, user_id')
    .eq('tenant_id', tenantId)
    .eq('id', runId)
    .maybeSingle();
  if (runError || !run) return { success: false, error: runError?.message || 'Run not found' };
  if (String(run.status) === 'cancelled') return { success: false, error: 'Run is cancelled.' };

  const { data: steps, error: stepsError } = await supabase
    .from('automation_run_steps')
    .select(
      'id, step_id, action, status, attempt_count, risk_level, approval_id, provider_reference, verification_evidence'
    )
    .eq('tenant_id', tenantId)
    .eq('run_id', runId)
    .order('created_at', { ascending: true });
  if (stepsError) return { success: false, error: stepsError.message };

  const inputs = (run.inputs || {}) as Record<string, unknown>;
  let completedCount = 0;
  let blockedForApproval = false;

  for (const step of steps || []) {
    const stepStatus = normalizeStatus(String(step.status));
    if (stepStatus === 'completed') {
      completedCount += 1;
      continue;
    }
    if (stepStatus === 'awaiting_approval') {
      blockedForApproval = true;
      break;
    }
    if (stepStatus === 'cancelled' || stepStatus === 'failed') break;

    const action = String(step.action || '');
    const highRisk = isHighRiskAction(action) || String(step.risk_level) === 'high';

    // Never silently skip high-risk actions. Create a portable approval when auto_high_risk=false.
    if (highRisk && !autoHighRisk) {
      const approval = await createPortableApproval({
        tenantId,
        userId: String(run.user_id || inputs.user_id || ''),
        runId,
        stepId: step.step_id,
        action,
        riskLevel: String(step.risk_level || 'high'),
        inputs,
      });

      await supabase
        .from('automation_run_steps')
        .update({
          status: 'awaiting_approval',
          approval_id: approval.id,
          error_message: null,
          sanitized_output: {
            approval_id: approval.id,
            approve_tool: approval.approve_tool,
            reject_tool: approval.reject_tool,
            expires_at: approval.expires_at,
            risk_level: approval.risk_level,
            action_summary: approval.action_summary,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', step.id);

      await supabase
        .from('automation_runs')
        .update({
          status: 'awaiting_approval',
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', runId);

      return {
        success: true,
        status: 'awaiting_approval',
        run_id: runId,
        step_id: step.step_id,
        approval_id: approval.id,
        approval: {
          approval_id: approval.id,
          action_summary: approval.action_summary,
          risk_level: approval.risk_level,
          expiration_time: approval.expires_at,
          approve_tool_name: approval.approve_tool,
          reject_tool_name: approval.reject_tool,
        },
      };
    }

    await supabase
      .from('automation_run_steps')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        attempt_count: Number(step.attempt_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', step.id);

    try {
      let output: Record<string, unknown> = {};
      let providerReference: string | null = null;
      let verificationEvidence: Record<string, unknown> = {};

      if (action === 'create_lead') {
        const businessName = String(inputs.business_name || inputs.lead_name || 'Inbound lead').trim();
        const email = inputs.lead_email ? String(inputs.lead_email).trim().toLowerCase() : null;
        const phone = inputs.lead_phone ? String(inputs.lead_phone).trim() : null;

        let query = supabase.from('leads').select('id, business_name, source').eq('tenant_id', tenantId);
        const orConditions = [`business_name.ilike.${businessName.replace(/[%_]/g, '\\$&')}`];
        if (email) orConditions.push(`email.ilike.${email}`);
        if (phone) orConditions.push(`phone.eq.${phone}`);
        query = query.or(orConditions.join(','));
        const { data: existingLeads, error: searchError } = await query.limit(1);

        if (!searchError && existingLeads && existingLeads.length > 0) {
          output = { lead_id: existingLeads[0].id, lead: existingLeads[0], duplicated: true };
          providerReference = String(existingLeads[0].id);
        } else {
          const payload: Record<string, unknown> = {
            tenant_id: tenantId,
            owner_id: inputs.user_id || run.user_id || null,
            business_name: businessName,
            email: email || null,
            phone: phone || null,
            source: String(inputs.source || 'automation_playbook'),
            stage: 'lead',
            status: 'new',
            updated_at: new Date().toISOString(),
          };
          let { data, error } = await supabase.from('leads').insert(payload).select('id, business_name, source').single();
          if (error && /column|does not exist|42703/i.test(error.message || '')) {
            delete payload.status;
            delete payload.updated_at;
            ({ data, error } = await supabase.from('leads').insert(payload).select('id, business_name, source').single());
          }
          if (error) throw new Error(error.message);
          if (!data) throw new Error('Lead insert returned no data');
          output = { lead_id: data.id, lead: data };
          providerReference = String(data.id);
          verificationEvidence = await verifyLeadCreated(tenantId, data.id);
        }
      } else if (action === 'create_task') {
        const title = String(inputs.task_title || 'Follow up inbound lead');
        const description = String(inputs.task_description || 'Automatically created by playbook.');
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            tenant_id: tenantId,
            title,
            description,
            status: 'todo',
            priority: 'medium',
            assigned_to: inputs.user_id ? String(inputs.user_id) : run.user_id || null,
          })
          .select('id, title, status')
          .single();
        if (error) throw new Error(error.message);
        output = { task_id: data.id, task: data };
        providerReference = String(data.id);
      } else if (action === 'send_outreach') {
        const now = new Date().toISOString();
        const trackingId = String(inputs.tracking_id || crypto.randomUUID());
        const dryRun = process.env.TEST_MODE === 'true' || process.env.MCP_DRY_RUN === 'true';
        const { data, error } = await supabase
          .from('lead_outreach_log')
          .insert({
            tenant_id: tenantId,
            lead_name: String(inputs.lead_name || inputs.business_name || 'Lead'),
            lead_email: String(inputs.lead_email || ''),
            subject: String(inputs.subject || 'Follow-up from AlphaClone'),
            body_html: String(inputs.body_html || inputs.body || ''),
            tracking_id: trackingId,
            pitch_angle: String(inputs.pitch_angle || 'automation_playbook'),
            industry: String(inputs.industry || ''),
            score: Number(inputs.score || 0),
            status: dryRun ? 'dry_run_queued' : 'queued',
            provider: String(inputs.provider || (dryRun ? 'dry_run' : '')),
            sent_at: now,
          })
          .select('id, tracking_id, status, provider')
          .single();
        if (error) throw new Error(error.message);
        output = {
          outreach_log_id: data.id,
          tracking_id: data.tracking_id,
          status: data.status,
          delivery_evidence: {
            queued_at: now,
            dry_run: dryRun,
            provider: data.provider,
          },
        };
        providerReference = String(data.tracking_id);
        verificationEvidence = {
          outreach_log_id: data.id,
          tracking_id: data.tracking_id,
          status: data.status,
        };
      } else if (action === 'verify_outreach_delivery') {
        const verification = await verifyOutreachDelivery(
          tenantId,
          typeof inputs.tracking_id === 'string' ? inputs.tracking_id : undefined,
          typeof inputs.outreach_log_id === 'string' ? inputs.outreach_log_id : undefined
        );
        output = { verification };
        verificationEvidence = verification as unknown as Record<string, unknown>;
        if ((verification as any)?.status === 'failed' || (verification as any)?.ok === false) {
          throw new Error((verification as any)?.message || 'Outreach delivery verification failed');
        }
      } else if (action === 'send_invoice_reminder') {
        const invoiceId = String(inputs.invoice_id || '');
        if (!invoiceId) throw new Error('invoice_id is required for send_invoice_reminder.');
        const { error } = await supabase
          .from('business_invoices')
          .update({ status: 'sent', updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('id', invoiceId);
        if (error) {
          const fallback = await supabase
            .from('invoices')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('tenant_id', tenantId)
            .eq('id', invoiceId);
          if (fallback.error) throw new Error(fallback.error.message);
        }
        output = { invoice_id: invoiceId, status: 'sent' };
        providerReference = invoiceId;
      } else if (action === 'verify_invoice_sent') {
        const invoiceId = String(inputs.invoice_id || '');
        if (!invoiceId) throw new Error('invoice_id is required for verify_invoice_sent.');
        const verification = await verifyInvoiceSent(tenantId, invoiceId);
        output = { verification };
        verificationEvidence = verification as unknown as Record<string, unknown>;
      } else {
        throw new Error(`Unsupported playbook action: ${action}`);
      }

      const completedAt = new Date().toISOString();
      await supabase
        .from('automation_run_steps')
        .update({
          status: 'completed',
          output,
          sanitized_output: sanitizeForAudit(output),
          provider_reference: providerReference,
          verification_evidence: verificationEvidence,
          finished_at: completedAt,
          completed_at: completedAt,
          updated_at: completedAt,
          error_message: null,
        })
        .eq('tenant_id', tenantId)
        .eq('id', step.id);
      completedCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Step execution failed';
      const failedAt = new Date().toISOString();
      await supabase
        .from('automation_run_steps')
        .update({
          status: 'failed',
          error_message: message,
          finished_at: failedAt,
          completed_at: failedAt,
          updated_at: failedAt,
        })
        .eq('tenant_id', tenantId)
        .eq('id', step.id);
      await supabase
        .from('automation_runs')
        .update({
          status: 'failed',
          last_error: message,
          finished_at: failedAt,
          updated_at: failedAt,
        })
        .eq('tenant_id', tenantId)
        .eq('id', runId);
      // Never report completed when any required step failed
      return { success: false, run_id: runId, status: 'failed', error: message };
    }
  }

  if (blockedForApproval) {
    return { success: true, status: 'awaiting_approval', run_id: runId };
  }

  const totalSteps = (steps || []).length;
  const finalStatus =
    completedCount === 0
      ? 'failed'
      : completedCount < totalSteps
        ? 'partially_completed'
        : 'completed';

  // Only mark completed when EVERY step completed
  if (finalStatus !== 'completed') {
    await supabase
      .from('automation_runs')
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_error:
          finalStatus === 'partially_completed'
            ? 'One or more steps did not complete'
            : 'No steps completed',
      })
      .eq('tenant_id', tenantId)
      .eq('id', runId);
    return { success: false, run_id: runId, status: finalStatus };
  }

  await supabase
    .from('automation_runs')
    .update({ status: 'completed', finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', runId);

  return { success: true, run_id: runId, status: 'completed' };
}

export async function getRunStatus(runId: string, tenantId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: run, error: runError } = await supabase
    .from('automation_runs')
    .select('id, playbook_id, status, started_at, finished_at, last_error, inputs')
    .eq('tenant_id', tenantId)
    .eq('id', runId)
    .maybeSingle();
  if (runError || !run) return { success: false, error: runError?.message || 'Run not found' };
  const { data: steps, error: stepsError } = await supabase
    .from('automation_run_steps')
    .select(
      'step_id, action, status, attempt_count, error_message, output, sanitized_output, input, started_at, finished_at, completed_at, approval_id, provider_reference, verification_evidence'
    )
    .eq('tenant_id', tenantId)
    .eq('run_id', runId)
    .order('created_at', { ascending: true });
  if (stepsError) return { success: false, error: stepsError.message };

  const normalizedSteps = (steps || []).map((s) => ({
    ...s,
    status: normalizeStatus(String(s.status)),
    completed_at: s.completed_at || s.finished_at,
  }));

  return {
    success: true,
    run: { ...run, status: normalizeStatus(String(run.status)) },
    steps: normalizedSteps,
  };
}

export async function cancelRun(runId: string, tenantId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('automation_runs')
    .update({ status: 'cancelled', finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', runId);
  if (error) return { success: false, error: error.message };
  await supabase
    .from('automation_run_steps')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('run_id', runId)
    .in('status', ['pending', 'queued', 'running', 'awaiting_approval', 'approval_required']);
  return { success: true, run_id: runId, status: 'cancelled' };
}

export async function approveWorkflowStep(params: {
  tenantId: string;
  userId: string;
  approvalId: string;
  runId?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: approval, error } = await supabase
    .from('automation_approvals')
    .select('*')
    .eq('tenant_id', params.tenantId)
    .eq('id', params.approvalId)
    .maybeSingle();
  if (error || !approval) return { success: false, error: error?.message || 'Approval not found' };
  if (String(approval.status) !== 'pending') {
    return { success: false, error: `Approval is ${approval.status}` };
  }

  await supabase
    .from('automation_approvals')
    .update({
      status: 'approved',
      approved_by: params.userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', params.tenantId)
    .eq('id', params.approvalId);

  await supabase
    .from('automation_run_steps')
    .update({ status: 'queued', error_message: null, updated_at: new Date().toISOString() })
    .eq('tenant_id', params.tenantId)
    .eq('run_id', approval.run_id)
    .eq('step_id', approval.step_id);

  await supabase
    .from('automation_runs')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('tenant_id', params.tenantId)
    .eq('id', approval.run_id);

  // Resume with autoHighRisk=true for the previously blocked step
  return executeRun(String(approval.run_id), params.tenantId, true);
}

export async function rejectWorkflowStep(params: {
  tenantId: string;
  userId: string;
  approvalId: string;
  reason?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: approval, error } = await supabase
    .from('automation_approvals')
    .select('*')
    .eq('tenant_id', params.tenantId)
    .eq('id', params.approvalId)
    .maybeSingle();
  if (error || !approval) return { success: false, error: error?.message || 'Approval not found' };

  await supabase
    .from('automation_approvals')
    .update({
      status: 'rejected',
      approved_by: params.userId,
      approved_at: new Date().toISOString(),
      reason: params.reason || 'Rejected via MCP',
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', params.tenantId)
    .eq('id', params.approvalId);

  await supabase
    .from('automation_run_steps')
    .update({
      status: 'cancelled',
      error_message: params.reason || 'Rejected via MCP',
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', params.tenantId)
    .eq('run_id', approval.run_id)
    .eq('step_id', approval.step_id);

  await supabase
    .from('automation_runs')
    .update({
      status: 'cancelled',
      last_error: params.reason || 'Rejected via MCP',
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', params.tenantId)
    .eq('id', approval.run_id);

  return { success: true, status: 'cancelled', run_id: approval.run_id, approval_id: params.approvalId };
}

export async function resumeWorkflow(runId: string, tenantId: string, autoHighRisk = false) {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('automation_runs')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', runId);
  return executeRun(runId, tenantId, autoHighRisk);
}

export async function retryRunStep(runId: string, tenantId: string, stepId: string, autoHighRisk: boolean) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('automation_run_steps')
    .update({ status: 'queued', error_message: null, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('run_id', runId)
    .eq('step_id', stepId);
  if (error) return { success: false, error: error.message };
  await supabase
    .from('automation_runs')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', runId);
  return executeRun(runId, tenantId, autoHighRisk);
}

export async function runVerification(action: string, tenantId: string, args: Record<string, unknown>) {
  if (action === 'verify_lead_created') {
    return verifyLeadCreated(tenantId, String(args.lead_id || ''));
  }
  if (action === 'verify_outreach_delivery') {
    return verifyOutreachDelivery(
      tenantId,
      typeof args.tracking_id === 'string' ? args.tracking_id : undefined,
      typeof args.log_id === 'string' ? args.log_id : undefined
    );
  }
  if (action === 'verify_social_post_published') {
    return verifySocialPostPublished(tenantId, String(args.social_post_id || ''));
  }
  if (action === 'verify_invoice_sent') {
    return verifyInvoiceSent(tenantId, String(args.invoice_id || ''));
  }
  return {
    status: 'unknown',
    retryable: false,
    message: `Unknown verification action: ${action}`,
    evidence: {},
  };
}
