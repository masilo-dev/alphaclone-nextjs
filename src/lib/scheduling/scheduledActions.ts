import { assertPermission } from '@/lib/mcp/connector/permissions';
import type { ConnectorPermission } from '@/lib/mcp/connector/types';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { classifyMcpToolTier, deriveStableMcpIdempotencyKey } from '@/lib/mcp/toolRiskTiers';
import { resolveScheduleTime, validateTimezone, parseCron, nextCronRun } from './scheduleTime';

export function isSchedulableTool(name: string): boolean {
  return !/^(schedule_|list_scheduled_actions|cancel_scheduled_action|approve_|reject_|run_|orchestrate_|nexus_)/.test(name)
    && classifyMcpToolTier(name) !== 'READ';
}
export function schedulePermission(tool: string): ConnectorPermission {
  if (/contract/.test(tool)) return 'contracts:write';
  if (/invoice|payment|refund|payout/.test(tool)) return 'finance:write';
  if (/campaign|outreach|bulk.*email/.test(tool)) return 'marketing:write';
  if (/email/.test(tool)) return 'email:send';
  if (/social|facebook|instagram|linkedin|post/.test(tool)) return 'social:publish';
  return 'automation:execute';
}

export type ScheduledActionInput = {
  tenantId: string; userId: string; toolName: string; args: Record<string, unknown>;
  scheduledAt: string; timezone?: string; repeatCron?: string;
  metadata?: Record<string, unknown>;
  allowDue?: boolean;
};

export async function scheduleAction(input: ScheduledActionInput) {
  if (!isSchedulableTool(input.toolName)) throw new Error('This tool cannot be scheduled as a frozen action');
  await assertPermission(input.tenantId, input.userId, schedulePermission(input.toolName));
  const scheduledAt = resolveScheduleTime(input.scheduledAt, input.timezone, new Date(0));
  const timezone = input.timezone ? validateTimezone(input.timezone) : 'UTC';
  if (input.repeatCron) parseCron(input.repeatCron);
  const admin = createSupabaseAdminClient();
  const key = deriveStableMcpIdempotencyKey({ tenantId: input.tenantId, toolName: input.toolName, args: { ...input.args, scheduling_user: input.userId, scheduled_at: scheduledAt, repeat_cron: input.repeatCron || null } });
  const prior = await admin.from('scheduled_mcp_actions').select('*').eq('tenant_id', input.tenantId).eq('idempotency_key', key).maybeSingle();
  if (prior.error) throw prior.error;
  if (prior.data) return prior.data;
  if (!input.allowDue) resolveScheduleTime(input.scheduledAt, input.timezone);

  const { getTool } = await import('@/lib/mcp/tool-registry');
  const { normalizeToolArguments } = await import('@/lib/mcp/normalizeToolArguments');
  const tool = getTool(input.toolName);
  if (!tool) throw new Error('Unknown action tool');
  const args = { ...input.args, tenant_id: input.tenantId, user_id: input.userId };
  // Remove only scheduler controls. Payload, media, destination and provider are frozen.
  delete (args as Record<string, unknown>).scheduled_at;
  delete (args as Record<string, unknown>).schedule_timezone;
  delete (args as Record<string, unknown>).repeat_cron;
  if (/^(create_social_post|create_linkedin_post|create_post_with_ai_image|create_post|create_bulk_email_campaign)/.test(input.toolName)) {
    (args as Record<string, unknown>).publish_now = true;
  }
  const normalized = await normalizeToolArguments(input.toolName, args, { tenantId: input.tenantId, userId: input.userId });
  const metadata = { ...input.metadata };
  if (input.toolName === 'send_email' && !Array.isArray(normalized.to)) {
    const { resolveMcpEmailRecipient } = await import('@/lib/email/resolveMcpEmailRecipient');
    normalized.to = (await resolveMcpEmailRecipient(admin, input.tenantId, normalized)).email;
  }
  if (input.toolName === 'send_contract' || input.toolName === 'send_invoice') {
    const contract = input.toolName === 'send_contract';
    const table = contract ? 'contracts' : 'business_invoices';
    const id = normalized[contract ? 'contract_id' : 'invoice_id'];
    const document = await admin.from(table).select('*').eq('id', id).eq('tenant_id', input.tenantId).maybeSingle();
    if (document.error) throw document.error;
    if (!document.data) throw new Error('Document not found in this workspace');
    metadata.document_revision = { table, id, updated_at: document.data.updated_at || null };
    if (!normalized.recipient_email) {
      const explicit = normalized.recipients || normalized.to;
      if (explicit) normalized.recipient_email = Array.isArray(explicit) ? explicit[0] : explicit;
      else {
        const { resolvePartyEmail } = await import('@/lib/contracts/contractCoherenceServer');
        normalized.recipient_email = await resolvePartyEmail(admin, input.tenantId, document.data.client_id) || document.data.client_email;
      }
    }
    if (!normalized.recipient_email) throw new Error('An explicit document recipient email is required');
  }
  const mediaFields = ['media_url', 'image_url', 'video_url'];
  if (Array.isArray(normalized.media_urls) || mediaFields.some(field => typeof normalized[field] === 'string') || Array.isArray(normalized.attachments)) {
    const { ingestMediaInput } = await import('@/lib/media/ingestMedia');
    const ingest = (url: string) => ingestMediaInput({ tenantId: input.tenantId, userId: input.userId, media: { type: 'url', url } });
    if (Array.isArray(normalized.media_urls)) {
      const assets = [];
      for (const url of normalized.media_urls) assets.push(await ingest(String(url)));
      normalized.media_urls = assets.map(asset => asset.url);
    }
    for (const field of mediaFields) if (typeof normalized[field] === 'string') normalized[field] = (await ingest(normalized[field] as string)).url;
    if (Array.isArray(normalized.attachments)) {
      const attachments = [];
      for (const attachment of normalized.attachments) {
        if (attachment && typeof attachment === 'object' && typeof attachment.url === 'string') {
          const asset = await ingest(attachment.url);
          attachments.push({ ...attachment, type: 'asset_id', asset_id: asset.id, url: undefined });
        } else attachments.push(attachment);
      }
      normalized.attachments = attachments;
    }
  }
  tool.inputSchema.parse(normalized); // Validate now as well as at execution.
  const { data: member, error: membershipError } = await admin.from('tenant_users').select('user_id').eq('tenant_id', input.tenantId).eq('user_id', input.userId).maybeSingle();
  if (membershipError) throw membershipError;
  if (!member) throw new Error('Workspace access is required to schedule an action');
  const payload = { tenant_id: input.tenantId, user_id: input.userId, tool_name: input.toolName, args: normalized, scheduled_at: scheduledAt, timezone, repeat_cron: input.repeatCron || null, idempotency_key: key, approved_at: new Date().toISOString(), metadata };
  const { data, error } = await admin.from('scheduled_mcp_actions').upsert(payload, { onConflict: 'tenant_id,idempotency_key', ignoreDuplicates: true }).select('*').maybeSingle();
  if (error) throw error;
  if (data) return data;
  const existing = await admin.from('scheduled_mcp_actions').select('*').eq('tenant_id', input.tenantId).eq('idempotency_key', key).single();
  if (existing.error) throw existing.error;
  return existing.data;
}

export function scheduledActionResponse(job: Record<string, any>) {
  return { ok: true, data: { action_id: job.id, tool: job.tool_name, status: job.status, scheduled_at: job.scheduled_at, timezone: job.timezone, repeat_cron: job.repeat_cron, approval_state: 'approved' }, execution_truth: { status: 'SCHEDULED', verification_state: 'SCHEDULED', approval_state: 'approved', may_claim_completed: false, user_message: `Saved for ${job.scheduled_at}. AlphaClone will execute without another approval; delivery is not yet completed.` } };
}

export function executionOutcome(result: any): { status: string; error?: string } {
  let parsed: any;
  try { parsed = JSON.parse(result?.content?.[0]?.text || '{}'); } catch { parsed = {}; }
  const truth = parsed.execution_truth || parsed.data?.execution_truth;
  const status = String(truth?.status || parsed.data?.delivery_status || parsed.data?.status || parsed.status || '').toLowerCase();
  if (status.includes('unknown') || status === 'timeout') return { status: 'unknown', error: 'Provider outcome requires reconciliation; do not resend' };
  if (result?.isError || parsed.ok === false || parsed.success === false || parsed.data?.success === false || status === 'failed') return { status: 'failed', error: parsed.error?.message || parsed.error || parsed.message || 'Scheduled action failed' };
  if (['provider_accepted', 'dispatched', 'requested', 'queued', 'running', 'processing'].includes(status)) return { status: 'provider_accepted' };
  if (['completed', 'verified', 'delivered', 'published', 'sent', 'succeeded'].includes(status)) return { status: 'completed' };
  return { status: 'provider_accepted' }; // Accepted execution is not verified delivery.
}

export async function runDueScheduledActions(limit = 5) {
  const admin = createSupabaseAdminClient();
  const { data: jobs, error } = await admin.rpc('claim_due_scheduled_mcp_actions', { p_limit: limit });
  if (error) throw error;
  const { executeTool } = await import('@/lib/mcp/tool-registry');
  const counts = { claimed: jobs?.length || 0, completed: 0, failed: 0, unknown: 0 };
  for (const job of jobs || []) {
    let outcome: { status: string; error?: string };
    let result: unknown;
    let executionStarted = false;
    try {
      const member = await admin.from('tenant_users').select('user_id').eq('tenant_id', job.tenant_id).eq('user_id', job.user_id).maybeSingle();
      if (member.error) throw member.error;
      if (!member.data) throw new Error('Scheduling user no longer has workspace access');
      await assertPermission(job.tenant_id, job.user_id, schedulePermission(job.tool_name));
      if (!job.approved_at || !isSchedulableTool(job.tool_name)) throw new Error('Invalid scheduled action authorization');
      if (job.metadata?.document_revision) {
        const revision = job.metadata.document_revision;
        if (!['contracts', 'business_invoices'].includes(revision.table)) throw new Error('Invalid document revision');
        const current = await admin.from(revision.table).select('updated_at').eq('tenant_id', job.tenant_id).eq('id', revision.id).maybeSingle();
        if (current.error) throw current.error;
        if (!current.data || (current.data.updated_at || null) !== revision.updated_at) throw new Error('Scheduled document was edited; schedule the revised document explicitly');
      }
      if (job.metadata?.enrollment_id) {
        const enrollment = await admin.from('email_sequence_enrollments').select('status').eq('id', job.metadata.enrollment_id).eq('tenant_id', job.tenant_id).maybeSingle();
        if (enrollment.error) throw enrollment.error;
        if (enrollment.data?.status !== 'active') {
          const update = await admin.from('scheduled_mcp_actions').update({ status: 'cancelled', last_error: 'Sequence enrollment is no longer active', completed_at: new Date().toISOString() }).eq('id', job.id).eq('tenant_id', job.tenant_id).eq('status', 'running');
          if (update.error) throw update.error;
          continue;
        }
      }
      const occurrenceKey = `${job.idempotency_key}:${job.scheduled_at}`;
      executionStarted = true;
      result = await executeTool(job.tenant_id, job.user_id, job.tool_name, { ...job.args, idempotency_key: occurrenceKey }, { executionSource: 'cron', skipPolicyEvaluation: true });
      outcome = executionOutcome(result);
    } catch (error) {
      // A thrown network error can follow a provider write. Never replay blindly.
      outcome = { status: executionStarted ? 'unknown' : 'failed', error: error instanceof Error ? error.message : String(error) };
    }
    const update: Record<string, unknown> = { status: outcome.status, result, last_error: outcome.error || null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (job.repeat_cron && ['completed', 'provider_accepted'].includes(outcome.status)) {
      update.status = 'scheduled';
      update.scheduled_at = nextCronRun(job.repeat_cron, job.timezone).toISOString();
      update.claimed_at = null;
    }
    const saved = await admin.from('scheduled_mcp_actions').update(update).eq('id', job.id).eq('tenant_id', job.tenant_id).eq('status', 'running');
    if (saved.error) throw saved.error;
    if (job.metadata?.enrollment_id) {
      const success = ['completed', 'provider_accepted'].includes(outcome.status);
      const progress = success
        ? { current_step: Number(job.metadata.step_index) + 1, ...(job.metadata.last_step ? { status: 'completed' } : {}) }
        : { status: 'paused' };
      const enrollment = await admin.from('email_sequence_enrollments').update(progress).eq('id', job.metadata.enrollment_id).eq('tenant_id', job.tenant_id);
      if (enrollment.error) throw enrollment.error;
    }

    if (outcome.status === 'unknown') counts.unknown++;
    else if (outcome.status === 'failed') counts.failed++;
    else counts.completed++;
  }
  return counts;
}
