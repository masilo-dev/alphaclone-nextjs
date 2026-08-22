import { createSupabaseAdminClient } from '@/lib/supabase-admin';

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
  severity: 'low' | 'medium' | 'high' | 'critical';
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
  const severity =
    status === 'failed' || status === 'blocked'
      ? 'high'
      : status === 'at_risk'
      ? 'medium'
      : 'low';

  const businessMetadata = {
    event: params.event,
    actor,
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
      user_email: actor.includes('@') ? actor : null,
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

  if (normalizedTool.includes('send_email') || normalizedTool.includes('outreach')) {
    return {
      event: 'Sales outreach email sent',
      businessContext: `Outreach email triggered to ${input.to || input.recipient || 'Prospect'}.`,
      result: success
        ? `Email sent regarding ${input.subject || 'Proposal/Follow-up'}.`
        : `Failed to deliver email: ${output.error || 'Provider connection issue'}`,
      nextAction: 'Await prospect reply / SLA monitoring.',
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

  // Fallback human readable translation
  const readableName = toolName.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    event: `${readableName} executed`,
    businessContext: `Automated operation executed by Bonnie via MCP.`,
    result: success ? 'Task completed successfully.' : `Task failed: ${output.error || 'Execution error'}`,
    nextAction: success ? 'Proceed with standard operational workflow.' : 'Review error details and retry.',
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
