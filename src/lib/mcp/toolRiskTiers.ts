/**
 * MCP tool risk tiers (MCP-SURFACE / MCP-IDEM remediation).
 * Classification informs policy defaults; it does not remove tools.
 */

export type McpToolTier =
  | 'READ'
  | 'INTERNAL_WRITE'
  | 'EXTERNAL_WRITE'
  | 'HIGH_RISK_EXTERNAL_WRITE';

const HIGH_RISK_PATTERNS = [
  /^bulk_/,
  /bulk_outreach/,
  /send_bulk/,
  /payment/,
  /charge/,
  /refund/,
  /transfer_money/,
  /void_invoice/,
  /delete_/,
  /disconnect_/,
  /revoke_/,
  /rotate_secret/,
  /sign_contract/,
  /finance_money/,
];

const EXTERNAL_WRITE_PATTERNS = [
  /^send_/,
  /^publish_/,
  /^schedule_social/,
  /send_email/,
  /send_invoice/,
  /send_quote/,
  /send_contract/,
  /outreach/,
  /whatsapp_send/,
];

const INTERNAL_WRITE_PATTERNS = [
  /^create_/,
  /^update_/,
  /^assign_/,
  /^convert_/,
  /^promote_/,
  /^queue_/,
  /^approve_/,
  /^reject_/,
  /^complete_/,
  /^cancel_/,
];

const READ_PATTERNS = [
  /^list_/,
  /^get_/,
  /^search_/,
  /^find_/,
  /^view_/,
  /^fetch_/,
  /^read_/,
  /_snapshot$/,
  /_stats$/,
  /_metrics$/,
];

export function classifyMcpToolTier(toolName: string): McpToolTier {
  const name = String(toolName || '').trim().toLowerCase();
  if (!name) return 'HIGH_RISK_EXTERNAL_WRITE';

  for (const re of HIGH_RISK_PATTERNS) {
    if (re.test(name)) return 'HIGH_RISK_EXTERNAL_WRITE';
  }
  for (const re of EXTERNAL_WRITE_PATTERNS) {
    if (re.test(name)) return 'EXTERNAL_WRITE';
  }
  for (const re of READ_PATTERNS) {
    if (re.test(name)) return 'READ';
  }
  for (const re of INTERNAL_WRITE_PATTERNS) {
    if (re.test(name)) return 'INTERNAL_WRITE';
  }
  // Unknown write-shaped names default to internal write; unknown otherwise treated carefully.
  if (/^(create|update|delete|send|publish|upload|queue|approve|reject|schedule|run|convert|assign|complete|cancel|void|promote)_/.test(name)) {
    return 'INTERNAL_WRITE';
  }
  return 'READ';
}

/** External / high-risk writes must carry a stable idempotency key. */
export function mcpToolRequiresIdempotency(toolName: string): boolean {
  const tier = classifyMcpToolTier(toolName);
  return tier === 'EXTERNAL_WRITE' || tier === 'HIGH_RISK_EXTERNAL_WRITE';
}

/** High-risk writes should not auto-allow without explicit approval path. */
export function mcpToolRequiresApproval(toolName: string): boolean {
  return classifyMcpToolTier(toolName) === 'HIGH_RISK_EXTERNAL_WRITE';
}
