import { inferMcpAttribution, formatAttributionLabel } from '@/lib/audit/sourceAttribution';
import { translateMcpToolToBusinessEvent } from '@/lib/audit/businessAuditEngine';
import { humanizeTechnicalFailure } from '@/lib/copy/businessFriendlyErrors';
import { isMutatingMcpTool, type TenantBusinessEventInput } from './eventCatalog';
import { emitTenantBusinessEvent } from './emitTenantBusinessEvent';

function parseToolResultText(content: unknown): Record<string, unknown> {
  if (!Array.isArray(content) || !content[0]) return {};
  const text = (content[0] as { text?: string }).text;
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

function eventTypeForTool(toolName: string, success: boolean): string {
  const n = toolName.toLowerCase();
  if (n.includes('lead')) return success ? 'lead.created' : 'mcp.action_failed';
  if (n.includes('outreach') || n.includes('send_email')) return success ? 'email.sent' : 'email.failed';
  if (n.includes('publish') || n.includes('social')) return success ? 'social.post_published' : 'social.post_failed';
  if (n.includes('invoice') || n.includes('payment')) return success ? 'invoice.created' : 'payment.failed';
  if (n.includes('contract')) return success ? 'contract.sent' : 'mcp.action_failed';
  if (n.includes('meeting') || n.includes('booking')) return success ? 'meeting.booked' : 'mcp.action_failed';
  if (n.includes('campaign')) return success ? 'campaign.completed' : 'campaign.failed';
  if (n.includes('import')) return success ? 'lead.imported_bulk' : 'mcp.action_failed';
  if (n.includes('create_client') || n.includes('add_client')) return success ? 'crm.client_created' : 'mcp.action_failed';
  if (n.includes('create_project') || n.includes('add_project')) return success ? 'project.created' : 'mcp.action_failed';
  return success ? 'mcp.action_completed' : 'mcp.action_failed';
}

function actionUrlForTool(toolName: string): string | undefined {
  const n = toolName.toLowerCase();
  if (n.includes('lead')) return '/dashboard/leads';
  if (n.includes('invoice')) return '/dashboard/business/invoices';
  if (n.includes('contract')) return '/dashboard/business/contracts';
  if (n.includes('social') || n.includes('publish')) return '/dashboard/social';
  if (n.includes('deal') || n.includes('pipeline')) return '/dashboard/deals';
  if (n.includes('project')) return '/dashboard/business/projects';
  if (n.includes('client')) return '/dashboard/crm/accounts';
  if (n.includes('outreach') || n.includes('send_email')) return '/dashboard/outreach/inbox';
  if (n.includes('campaign')) return '/dashboard/business/campaigns';
  if (n.includes('meeting') || n.includes('booking')) return '/dashboard/calendar';
  return '/dashboard';
}

function deriveExecutionOutcome(
  toolName: string,
  success: boolean,
  output: Record<string, unknown>,
): { effectiveSuccess: boolean; partial: boolean } {
  if (!success) return { effectiveSuccess: false, partial: false };

  const succeededCount = Number(output.succeeded_count ?? output.created ?? 0);
  const failedCount = Number(output.failed_count ?? 0);
  const isBulk = toolName.toLowerCase().includes('bulk');

  if (isBulk) {
    if (succeededCount <= 0) return { effectiveSuccess: false, partial: false };
    return { effectiveSuccess: true, partial: failedCount > 0 };
  }

  return { effectiveSuccess: true, partial: false };
}

/**
 * Called after MCP tool execution. Mutating tools emit tenant-visible business events.
 * Notification failures are swallowed — they must never affect quota or business persistence.
 */
export async function notifyAfterMcpToolExecution(params: {
  tenantId: string;
  userId: string;
  toolName: string;
  args: Record<string, unknown>;
  success: boolean;
  resultContent?: unknown;
  errorMessage?: string | null;
  source?: TenantBusinessEventInput['source'];
}): Promise<void> {
  if (!isMutatingMcpTool(params.toolName)) return;

  const output = parseToolResultText(params.resultContent);
  const rawError = params.errorMessage || (typeof output.error === 'string' ? output.error : null);
  if (rawError && !output.error) {
    output.error = rawError;
  }

  const { effectiveSuccess, partial } = deriveExecutionOutcome(params.toolName, params.success, output);

  const attribution = inferMcpAttribution({
    toolName: params.toolName,
    connectorHint: (params.args.connector_hint as string) || (params.args.source as string),
    userId: params.userId,
  });

  const translated = translateMcpToolToBusinessEvent(
    params.toolName,
    { ...params.args, source_agent: attribution.source_agent },
    output,
    effectiveSuccess,
  );

  const eventType = eventTypeForTool(params.toolName, effectiveSuccess);
  const entityId =
    (output.id as string) ||
    (output.lead_id as string) ||
    (output.invoice_id as string) ||
    (params.args.entity_id as string) ||
    undefined;

  const failureMessage = !effectiveSuccess && rawError
    ? humanizeTechnicalFailure(rawError, { tool: params.toolName })
    : translated.result;

  await emitTenantBusinessEvent({
    eventType,
    tenantId: params.tenantId,
    userId: params.userId,
    actor: formatAttributionLabel(attribution),
    source: params.source || 'mcp',
    title: translated.event,
    message: failureMessage,
    actionUrl: actionUrlForTool(params.toolName),
    entityType: eventType.split('.')[0],
    entityId,
    clientName: (params.args.client_name as string) || (params.args.clientName as string),
    status: effectiveSuccess ? 'success' : 'failed',
    metadata: {
      tool: params.toolName,
      next_action: translated.nextAction,
      succeeded_count: output.succeeded_count,
      failed_count: output.failed_count,
      partial,
    },
  }).catch((err) => {
    console.warn('[mcpToolNotificationHook]', params.toolName, err);
  });
}
