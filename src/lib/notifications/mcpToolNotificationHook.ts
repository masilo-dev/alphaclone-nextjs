import { inferMcpAttribution, formatAttributionLabel } from '@/lib/audit/sourceAttribution';
import { translateMcpToolToBusinessEvent } from '@/lib/audit/businessAuditEngine';
import { isMutatingMcpTool } from './eventCatalog';
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
  return success ? 'mcp.action_completed' : 'mcp.action_failed';
}

function actionUrlForTool(toolName: string): string | undefined {
  const n = toolName.toLowerCase();
  if (n.includes('lead')) return '/dashboard/crm/leads';
  if (n.includes('invoice')) return '/dashboard/business/invoices';
  if (n.includes('contract')) return '/dashboard/business/contracts';
  if (n.includes('social') || n.includes('publish')) return '/dashboard/social';
  if (n.includes('campaign') || n.includes('outreach')) return '/dashboard/marketing/campaigns';
  if (n.includes('meeting') || n.includes('booking')) return '/dashboard/calendar';
  return '/dashboard';
}

/**
 * Called after MCP tool execution. Mutating tools emit tenant-visible business events.
 */
export async function notifyAfterMcpToolExecution(params: {
  tenantId: string;
  userId: string;
  toolName: string;
  args: Record<string, unknown>;
  success: boolean;
  resultContent?: unknown;
  errorMessage?: string | null;
}): Promise<void> {
  if (!isMutatingMcpTool(params.toolName)) return;

  const output = parseToolResultText(params.resultContent);
  if (params.errorMessage && !output.error) {
    output.error = params.errorMessage;
  }

  const attribution = inferMcpAttribution({
    toolName: params.toolName,
    connectorHint: (params.args.connector_hint as string) || (params.args.source as string),
    userId: params.userId,
  });

  const translated = translateMcpToolToBusinessEvent(
    params.toolName,
    { ...params.args, source_agent: attribution.source_agent },
    output,
    params.success
  );

  const eventType = eventTypeForTool(params.toolName, params.success);
  const entityId =
    (output.id as string) ||
    (output.lead_id as string) ||
    (output.invoice_id as string) ||
    (params.args.entity_id as string) ||
    undefined;

  await emitTenantBusinessEvent({
    eventType,
    tenantId: params.tenantId,
    userId: params.userId,
    actor: formatAttributionLabel(attribution),
    source: 'mcp',
    title: translated.event,
    message: translated.result,
    actionUrl: actionUrlForTool(params.toolName),
    entityType: eventType.split('.')[0],
    entityId,
    clientName: (params.args.client_name as string) || (params.args.clientName as string),
    status: params.success ? 'success' : 'failed',
    metadata: {
      tool: params.toolName,
      next_action: translated.nextAction,
    },
  }).catch((err) => {
    console.warn('[mcpToolNotificationHook]', params.toolName, err);
  });
}
