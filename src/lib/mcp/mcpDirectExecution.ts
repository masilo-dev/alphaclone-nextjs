/**
 * ChatGPT MCP must return real outcomes in-session — not background jobs.
 * Direct execution is the default; durable queue is opt-in via env.
 */

const BULK_EMAIL_TOOLS = new Set([
  'send_bulk_email',
  'send_bulk_email_campaign',
  'create_bulk_email_campaign',
  'queue_email_campaign_send',
]);

const BULK_OUTREACH_TOOLS = new Set(['send_batch_outreach', 'bulk_send_outreach']);

export function shouldUseMcpDirectExecution(tool: string): boolean {
  if (process.env.MCP_FORCE_DURABLE === 'true' || process.env.MCP_FORCE_DURABLE === '1') {
    return false;
  }
  if (tool === 'send_email') {
    return process.env.MCP_SEND_EMAIL_DURABLE !== 'true' && process.env.MCP_SEND_EMAIL_DURABLE !== '1';
  }
  if (BULK_EMAIL_TOOLS.has(tool)) {
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
