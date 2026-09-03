/**
 * MCP execution routing — direct vs durable.
 *
 * FAST DIRECT (<15s): single writes, reads, small email batches (≤10).
 * HEAVY DIRECT (15–25s): bounded sync when memory-safe.
 * DURABLE (>10 recipients, large bulk, long AI): existing mcp_event_queue + Bonnie worker.
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

export type McpExecutionClass = 'fast_direct' | 'heavy_direct' | 'durable';

export function classifyMcpExecution(tool: string, context?: { recipientCount?: number }): McpExecutionClass {
  if (ALWAYS_DURABLE_TOOLS.has(tool)) return 'durable';
  if (BULK_OUTREACH_TOOLS.has(tool)) return 'durable';
  if (BULK_EMAIL_TOOLS.has(tool)) {
    const count = context?.recipientCount ?? 0;
    return count > 10 ? 'durable' : 'heavy_direct';
  }
  if (tool === 'send_email' || tool === 'publish_social_post' || tool === 'publish_post') {
    return 'heavy_direct';
  }
  return 'fast_direct';
}

export function shouldUseMcpDirectExecution(tool: string, context?: { recipientCount?: number }): boolean {
  if (process.env.MCP_FORCE_DURABLE === 'true' || process.env.MCP_FORCE_DURABLE === '1') {
    return false;
  }
  const cls = classifyMcpExecution(tool, context);
  if (cls === 'durable') return false;
  if (tool === 'send_email') {
    return process.env.MCP_SEND_EMAIL_DURABLE !== 'true' && process.env.MCP_SEND_EMAIL_DURABLE !== '1';
  }
  if (BULK_EMAIL_TOOLS.has(tool)) {
    if ((context?.recipientCount ?? 0) > 10) return false;
    return process.env.MCP_BULK_EMAIL_DURABLE !== 'true' && process.env.MCP_BULK_EMAIL_DURABLE !== '1';
  }
  if (BULK_OUTREACH_TOOLS.has(tool)) {
    return process.env.MCP_BULK_OUTREACH_DURABLE !== 'true' && process.env.MCP_BULK_OUTREACH_DURABLE !== '1';
  }
  if (tool === 'publish_social_post' || tool === 'publish_post' || tool === 'create_social_post') {
    return process.env.MCP_SOCIAL_DURABLE !== 'true' && process.env.MCP_SOCIAL_DURABLE !== '1';
  }
  return true;
}
