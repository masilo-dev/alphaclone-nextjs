import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';
import { getPlaybookDefinition } from './playbookService';
import { verifyInvoiceSent, verifyLeadCreated, verifyOutreachDelivery, verifySocialPostPublished } from './verificationService';

type RuntimeContext = {
  tenantId: string;
  userId: string;
  inputs: Record<string, unknown>;
  autoHighRisk: boolean;
};

function isHighRiskAction(action: string): boolean {
  return action === 'send_outreach' || action === 'send_invoice_reminder' || action.startsWith('bulk_');
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
    if (existing) return { success: true, deduplicated: true, run: existing };
  }

  const { data: run, error: runError } = await supabase
    .from('automation_runs')
    .insert({
      tenant_id: params.tenantId,
      user_id: params.userId,
      playbook_id: playbook.id,
      status: 'running',
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

  for (const step of playbook.steps) {
    await supabase.from('automation_run_steps').insert({
      tenant_id: params.tenantId,
      run_id: run.id,
      step_id: step.id,
      action: step.action,
      status: 'pending',
      attempt_count: 0,
      risk_level: step.risk,
    });
  }

  return { success: true, run };
}

export async function executeRun(runId: string, tenantId: string, autoHighRisk: boolean) {
  const supabase = createSupabaseAdminClient();
  const { data: run, error: runError } = await supabase
    .from('automation_runs')
    .select('id, tenant_id, status, playbook_id, inputs')
    .eq('tenant_id', tenantId)
    .eq('id', runId)
    .maybeSingle();
  if (runError || !run) return { success: false, error: runError?.message || 'Run not found' };
  if (String(run.status) === 'cancelled') return { success: false, error: 'Run is cancelled.' };

  const { data: steps, error: stepsError } = await supabase
    .from('automation_run_steps')
    .select('id, step_id, action, status, attempt_count, risk_level')
    .eq('tenant_id', tenantId)
    .eq('run_id', runId)
    .order('created_at', { ascending: true });
  if (stepsError) return { success: false, error: stepsError.message };

  const inputs = (run.inputs || {}) as Record<string, unknown>;

  for (const step of steps || []) {
    if (String(step.status) === 'completed') continue;
    const action = String(step.action || '');
    const highRisk = isHighRiskAction(action) || String(step.risk_level) === 'high';
    if (highRisk && !autoHighRisk) {
      await supabase
        .from('automation_run_steps')
        .update({
          status: 'approval_required',
          error_message: 'High-risk action requires approval by policy.',
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', step.id);
      await supabase
        .from('automation_runs')
        .update({ status: 'approval_required', updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('id', runId);
      return { success: true, status: 'approval_required', run_id: runId, step_id: step.step_id };
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

      if (action === 'create_lead') {
        const payload = {
          tenant_id: tenantId,
          owner_id: inputs.user_id || null,
          business_name: String(inputs.business_name || inputs.lead_name || 'Inbound lead'),
          email: inputs.lead_email ? String(inputs.lead_email) : null,
          phone: inputs.lead_phone ? String(inputs.lead_phone) : null,
          source: String(inputs.source || 'automation_playbook'),
          stage: 'lead',
          status: 'new',
        };
        const { data, error } = await supabase.from('leads').insert(payload).select('id, business_name, source').single();
        if (error) throw new Error(error.message);
        output = { lead_id: data.id, lead: data };
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
            assigned_to: inputs.user_id ? String(inputs.user_id) : null,
          })
          .select('id, title, status')
          .single();
        if (error) throw new Error(error.message);
        output = { task_id: data.id, task: data };
      } else if (action === 'send_outreach') {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('lead_outreach_log')
          .insert({
            tenant_id: tenantId,
            lead_name: String(inputs.lead_name || inputs.business_name || 'Lead'),
            lead_email: String(inputs.lead_email || ''),
            subject: String(inputs.subject || 'Follow-up from AlphaClone'),
            body_html: String(inputs.body_html || inputs.body || ''),
            tracking_id: String(inputs.tracking_id || randomUUID()),
            pitch_angle: String(inputs.pitch_angle || 'automation_playbook'),
            industry: String(inputs.industry || ''),
            score: Number(inputs.score || 0),
            status: 'queued',
            provider: String(inputs.provider || ''),
            sent_at: now,
          })
          .select('id, tracking_id, status')
          .single();
        if (error) throw new Error(error.message);
        output = { outreach_log_id: data.id, tracking_id: data.tracking_id, status: data.status };
      } else if (action === 'verify_outreach_delivery') {
        const verification = await verifyOutreachDelivery(
          tenantId,
          typeof inputs.tracking_id === 'string' ? inputs.tracking_id : undefined,
          typeof inputs.outreach_log_id === 'string' ? inputs.outreach_log_id : undefined
        );
        output = { verification };
      } else if (action === 'send_invoice_reminder') {
        const invoiceId = String(inputs.invoice_id || '');
        if (!invoiceId) throw new Error('invoice_id is required for send_invoice_reminder.');
        const { error } = await supabase
          .from('invoices')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('id', invoiceId);
        if (error) throw new Error(error.message);
        output = { invoice_id: invoiceId, status: 'sent' };
      } else if (action === 'verify_invoice_sent') {
        const invoiceId = String(inputs.invoice_id || '');
        if (!invoiceId) throw new Error('invoice_id is required for verify_invoice_sent.');
        const verification = await verifyInvoiceSent(tenantId, invoiceId);
        output = { verification };
      } else {
        throw new Error(`Unsupported playbook action: ${action}`);
      }

      await supabase
        .from('automation_run_steps')
        .update({
          status: 'completed',
          output,
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('tenant_id', tenantId)
        .eq('id', step.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Step execution failed';
      await supabase
        .from('automation_run_steps')
        .update({
          status: 'failed',
          error_message: message,
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', step.id);
      await supabase
        .from('automation_runs')
        .update({
          status: 'failed',
          last_error: message,
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', runId);
      return { success: false, run_id: runId, error: message };
    }
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
    .select('step_id, action, status, attempt_count, error_message, output, started_at, finished_at')
    .eq('tenant_id', tenantId)
    .eq('run_id', runId)
    .order('created_at', { ascending: true });
  if (stepsError) return { success: false, error: stepsError.message };
  return { success: true, run, steps: steps || [] };
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
    .in('status', ['pending', 'running', 'approval_required']);
  return { success: true, run_id: runId, status: 'cancelled' };
}

export async function retryRunStep(runId: string, tenantId: string, stepId: string, autoHighRisk: boolean) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('automation_run_steps')
    .update({ status: 'pending', error_message: null, updated_at: new Date().toISOString() })
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

