import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { auditSeverityFromStatus } from '@/lib/audit/auditSeverity';
import { sanitizeUserFacingError } from '@/lib/copy/businessFriendlyErrors';

function failureResultLine(toolName: string, output: Record<string, any>): string {
  const raw =
    (output?.error && typeof output.error === 'object'
      ? (output.error as { message?: string }).message
      : null) ||
    (typeof output?.error === 'string' ? output.error : null);
  return sanitizeUserFacingError(raw, { tool: toolName, preferGeneric: true });
}

export interface BusinessActivityParams {
  tenantId: string;
  event: string;
  actor?: string;
  client?: string;
  businessContext?: string;
  relatedRecordType?: string;
  relatedRecordId?: string;
  result?: string;
  status?: 'success' | 'failed' | 'waiting' | 'blocked' | 'at_risk' | 'pending_approval' | string;
  nextAction?: string;
  owner?: string;
  timestamp?: string;
  technicalDetails?: Record<string, any>;
}

export interface BusinessActivityRecord {
  id: string;
  tenant_id: string;
  action: string; // Event title
  user_email: string | null; // Actor
  entity_type: string | null; // Related record type
  entity_id: string | null; // Related record ID
  severity: 'info' | 'warning' | 'error' | 'critical';
  created_at: string;
  metadata: {
    event: string;
    actor: string;
    client?: string;
    business_context?: string;
    related_record?: string;
    result?: string;
    status: string;
    next_action?: string;
    owner?: string;
    is_business_activity: true;
    technical_details?: Record<string, any>;
  };
}

/**
 * Standardized Business Audit Logger for AlphaClone Systems.
 * Writes to public.audit_logs with a structured business metadata payload
 * that human founders, managers, and salespeople can understand without technical jargon.
 */
export async function recordBusinessActivity(
  params: BusinessActivityParams
): Promise<{ id: string; success: boolean; error?: string }> {
  const admin = createSupabaseAdminClient();

  const timestamp = params.timestamp || new Date().toISOString();
  const actor = params.actor || 'System Automation';
  const status = params.status || 'success';
  const severity = auditSeverityFromStatus(status);

  const actorEmail = actor.includes('@') ? actor : null;

  const businessMetadata = {
    event: params.event,
    actor,
    ...(actorEmail ? { user_email: actorEmail } : {}),
    client: params.client || undefined,
    business_context: params.businessContext || undefined,
    related_record: params.relatedRecordType
      ? `${params.relatedRecordType}${params.relatedRecordId ? ` (${params.relatedRecordId})` : ''}`
      : undefined,
    result: params.result || 'Operation executed',
    status,
    next_action: params.nextAction || undefined,
    owner: params.owner || actor,
    is_business_activity: true as const,
    ...(params.technicalDetails ? { technical_details: params.technicalDetails } : {}),
  };

  const { data, error } = await admin
    .from('audit_logs')
    .insert({
      tenant_id: params.tenantId,
      action: params.event,
      entity_type: params.relatedRecordType || 'business_process',
      entity_id: params.relatedRecordId || null,
      resource_type: params.relatedRecordType || 'business_process',
      resource_id: params.relatedRecordId || null,
      severity,
      created_at: timestamp,
      metadata: businessMetadata,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[recordBusinessActivity] Audit insert error:', error.message);
    return { id: '', success: false, error: error.message };
  }

  return { id: data.id, success: true };
}

// ── Translation Helpers ──────────────────────────────────────────────────

/**
 * Translates raw MCP tool executions into human-readable business events.
 */
export function translateMcpToolToBusinessEvent(
  toolName: string,
  input: Record<string, any>,
  output: Record<string, any>,
  success: boolean
): {
  event: string;
  businessContext: string;
  result: string;
  nextAction?: string;
} {
  const normalizedTool = toolName.toLowerCase();

  if (normalizedTool.includes('create_leads') || normalizedTool.includes('create_lead') || normalizedTool.includes('add_lead')) {
    const count = Number(output.successful || output.count || output.created || 1);
    const agent = input.source_agent || 'External MCP Client';
    return {
      event: count > 1 ? `${count} leads added` : 'Lead added to CRM',
      businessContext: `${agent} via AlphaClone MCP added ${count > 1 ? `${count} leads` : `lead "${input.name || input.business_name || input.email || 'New lead'}"`}.`,
      result: success
        ? `${count} lead(s) now in your pipeline.`
        : `Lead creation failed: ${output.error || 'Unknown error'}`,
      nextAction: 'Review and assign follow-up tasks.',
    };
  }

  if (normalizedTool.includes('send_email') || normalizedTool.includes('outreach') || normalizedTool.includes('bulk_email')) {
    const recipient = input.to || input.recipient || input.email || 'prospect';
    const agent = input.source_agent || 'External MCP Client';
    const requested = Number(output.requested || 0);
    const sent = Number(output.updated_or_sent || output.sent || 0);
    const blocked = Number(output.skipped || 0);
    return {
      event: requested > 1 ? `Outreach batch processed (${sent}/${requested})` : 'Outreach email sent',
      businessContext: `${agent} via AlphaClone MCP sent outreach to ${recipient}.`,
      result: success
        ? blocked > 0
          ? `${sent} sent, ${blocked} blocked (unsubscribed/suppressed).`
          : `Email sent regarding ${input.subject || 'follow-up'}.`
        : `Failed to deliver: ${output.error || 'Provider issue'}`,
      nextAction: 'Await prospect reply or review delivery report.',
    };
  }

  if (normalizedTool.includes('create_project')) {
    return {
      event: 'Project created',
      businessContext: `Project "${input.name || input.title || 'New Project'}" initialized via MCP.`,
      result: success
        ? `Project created for ${input.client_name || input.clientName || 'Client'}.`
        : `Project creation failed: ${output.error || 'Unknown error'}`,
      nextAction: 'Collect client assets and assign initial milestone tasks.',
    };
  }

  if (normalizedTool.includes('invoice') || normalizedTool.includes('payment')) {
    return {
      event: 'Invoice action executed',
      businessContext: `Financial operation on invoice #${input.invoiceId || input.id || ''}.`,
      result: success
        ? `Invoice process completed successfully.`
        : `Invoice processing failed: ${output.error || 'System error'}`,
      nextAction: 'Verify ledger balance and billing status.',
    };
  }

  if (normalizedTool.includes('create_client') || normalizedTool.includes('add_client')) {
    const name = input.name || input.company_name || input.client_name || 'New client';
    return {
      event: 'Client added to CRM',
      businessContext: `Client "${name}" was added to your workspace.`,
      result: success
        ? `${name} is now in your client list.`
        : `Client creation failed: ${output.error || 'Unknown error'}`,
      nextAction: 'Review client profile and link contacts or deals.',
    };
  }

  if (normalizedTool.includes('create_contact') || normalizedTool.includes('add_contact')) {
    const name = input.name || input.full_name || input.email || 'New contact';
    return {
      event: 'Contact added',
      businessContext: `Contact "${name}" was added to your CRM.`,
      result: success
        ? `${name} is saved and ready for outreach.`
        : `Contact creation failed: ${output.error || 'Unknown error'}`,
      nextAction: 'Assign to a client or start a follow-up sequence.',
    };
  }

  if (normalizedTool.includes('publish_social') || normalizedTool.includes('publish_post')) {
    const network = input.platform || input.network || 'social channel';
    return {
      event: 'Social post published',
      businessContext: `A post was published to ${network}.`,
      result: success
        ? `Your post is live on ${network}.`
        : failureResultLine('publish_social_post', output),
      nextAction: 'Check Social Command Center for reach and engagement.',
    };
  }

  if (normalizedTool.includes('import') && (normalizedTool.includes('bulk') || normalizedTool.includes('leads') || normalizedTool.includes('contacts'))) {
    const imported = Number(output.succeeded_count ?? output.created ?? output.imported ?? 0);
    const failed = Number(output.failed_count ?? 0);
    return {
      event: imported > 1 ? `${imported} records imported` : 'Bulk import completed',
      businessContext: `Bulk import finished with ${imported} record(s) added.`,
      result: success
        ? failed > 0
          ? `${imported} imported, ${failed} skipped or failed.`
          : `${imported} record(s) are now in your workspace.`
        : failureResultLine(toolName, output),
      nextAction: 'Review imported records and assign follow-ups.',
    };
  }

  // Fallback human readable translation
  const readableName = toolName.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    event: `${readableName} executed`,
    businessContext: `Automated operation executed by Bonnie via MCP.`,
    result: success ? 'Task completed successfully.' : failureResultLine(toolName, output),
    nextAction: success ? 'Proceed with standard operational workflow.' : 'Review the action in AlphaClone and try again, or contact AlphaClone Systems support.',
  };
}

/**
 * Translates AI Agent / Bonnie decisions into business activity logs.
 */
export function translateAiActivityToBusinessEvent(
  agentName: string,
  action: string,
  clientName?: string,
  recommendation?: string
): {
  event: string;
  businessContext: string;
  result: string;
  nextAction?: string;
} {
  return {
    event: `${agentName} recommended action`,
    businessContext: `AI agent analyzed account history and performance metrics.`,
    result: recommendation ? `Recommendation: ${recommendation}` : `Action executed: ${action}`,
    nextAction: 'Awaiting team owner approval or confirmation.',
  };
}

/**
 * Translates social publishing failure into human business narrative.
 */
export function translateFailureToBusinessEvent(
  moduleName: string,
  operation: string,
  reason: string,
  actionRequired: string
): {
  event: string;
  businessContext: string;
  result: string;
  nextAction: string;
} {
  return {
    event: `${moduleName} action failed`,
    businessContext: `Automated ${operation} could not complete.`,
    result: `Failure reason: ${reason}`,
    nextAction: actionRequired,
  };
}
