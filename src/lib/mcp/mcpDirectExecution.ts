/**
 * MCP execution routing — direct vs durable.
 *
 * FAST DIRECT (<15s): single writes, reads, small email batches (≤10).
 * HEAVY DIRECT (15–25s): bounded sync when memory-safe.
 * DURABLE (>10 recipients, large bulk, long AI): existing mcp_event_queue + Bonnie worker.
 *
 * Connector UX rule: a user-issued one-shot send/publish should execute in the
 * request unless that specific transport has explicitly opted into durability.
 * A global durable runtime must not silently turn a simple "post this" command
 * into a long-running workflow.
 */

const BULK_EMAIL_TOOLS = new Set([
  'send_bulk_email',
  'send_bulk_email_campaign',
  'create_bulk_email_campaign',
  'queue_email_campaign_send',
]);

const BULK_OUTREACH_TOOLS = new Set(['send_batch_outreach', 'bulk_send_outreach']);

const ALWAYS_DURABLE_TOOLS = new Set([
  'bulk_update_records',
  'bulk_upload_media',
]);

const ONE_SHOT_SOCIAL_TOOLS = new Set([
  'publish_social_post',
  'publish_post',
  'create_social_post',
]);

export type McpExecutionClass = 'fast_direct' | 'heavy_direct' | 'durable';

function envTrue(name: string): boolean {
  const value = process.env[name];
  return value === 'true' || value === '1';
}

export function classifyMcpExecution(tool: string, context?: { recipientCount?: number }): McpExecutionClass {
  if (ALWAYS_DURABLE_TOOLS.has(tool)) return 'durable';
  if (BULK_OUTREACH_TOOLS.has(tool)) return 'durable';
  if (BULK_EMAIL_TOOLS.has(tool)) {
    const count = context?.recipientCount ?? 0;
    return count > 10 ? 'durable' : 'heavy_direct';
  }
  if (tool === 'send_email' || ONE_SHOT_SOCIAL_TOOLS.has(tool)) {
    return 'heavy_direct';
  }
  return 'fast_direct';
}

export function shouldUseMcpDirectExecution(tool: string, context?: { recipientCount?: number }): boolean {
  // Specific connector overrides win over the global durable switch. This keeps
  // human-issued one-shot actions responsive while still allowing operators to
  // opt those transports into durability deliberately.
  if (ONE_SHOT_SOCIAL_TOOLS.has(tool)) {
    return !envTrue('MCP_SOCIAL_DURABLE');
  }
  if (tool === 'send_email') {
    return !envTrue('MCP_SEND_EMAIL_DURABLE');
  }
  if (BULK_EMAIL_TOOLS.has(tool)) {
    if ((context?.recipientCount ?? 0) > 10) return false;
    return !envTrue('MCP_BULK_EMAIL_DURABLE');
  }
  if (BULK_OUTREACH_TOOLS.has(tool)) {
    return !envTrue('MCP_BULK_OUTREACH_DURABLE');
  }

  if (envTrue('MCP_FORCE_DURABLE')) return false;

  const cls = classifyMcpExecution(tool, context);
  return cls !== 'durable';
}
