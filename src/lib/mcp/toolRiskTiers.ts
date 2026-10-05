/**
 * MCP tool risk tiers (MCP-SURFACE / MCP-IDEM remediation).
 * Classification informs policy defaults; it does not remove tools.
 */

import { createHash } from 'node:crypto';

export type McpToolTier =
  | 'READ'
  | 'INTERNAL_WRITE'
  | 'EXTERNAL_WRITE'
  | 'HIGH_RISK_EXTERNAL_WRITE';

const HIGH_RISK_PATTERNS = [
  /^bulk_/,
  /bulk_outreach/,
  /send_bulk/,
  /send_batch/,
  /_bulk_/,
  /charge/,
  /refund/,
  /transfer_money/,
  /transfer_funds/,
  /initiate_payment/,
  /initiate_payout/,
  /create_payout/,
  /record_payment/,
  /reconcile_payment/,
  /void_invoice/,
  /delete_/,
  /disconnect_/,
  /revoke_/,
  /rotate_secret/,
  /sign_contract/,
  /finance_money/,
  /nexus_payroll/,
];

const EXTERNAL_WRITE_PATTERNS = [
  /^send_/,
  /^publish_/,
  /^schedule_social/,
  /^schedule_/,
  /send_email/,
  /send_invoice/,
  /send_quote/,
  /send_contract/,
  /create_social_post/,
  /create_linkedin_post/,
  /create_post_with_ai_image/,
  /publish_now/,
  /outreach/,
  /whatsapp_send/,
  /gmail_send/,
  /microsoft_send/,
  /reply_to_email/,
  /queue_email_campaign/,
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

/** Volatile args excluded from stable idempotency material. */
const IDEMPOTENCY_IGNORE_KEYS = new Set([
  'idempotency_key',
  'idempotencyKey',
  'correlation_id',
  'correlationId',
  'request_id',
  'requestId',
  'timestamp',
  'now',
  'client_request_id',
  'trace_id',
  'traceId',
]);

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
  if (
    /^(create|update|delete|send|publish|upload|queue|approve|reject|schedule|run|convert|assign|complete|cancel|void|promote)_/.test(
      name
    )
  ) {
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

function canonicalizeForIdempotency(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalizeForIdempotency);
  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input).sort()) {
    if (IDEMPOTENCY_IGNORE_KEYS.has(key)) continue;
    out[key] = canonicalizeForIdempotency(input[key]);
  }
  return out;
}

/**
 * Stable idempotency key from tenant + tool + canonical args.
 * Same logical request always hashes to the same key (retries safe).
 * Never includes random UUIDs or timestamps.
 */
export function deriveStableMcpIdempotencyKey(params: {
  tenantId: string;
  toolName: string;
  args: Record<string, unknown>;
}): string {
  const material = JSON.stringify({
    tenant_id: params.tenantId,
    tool: String(params.toolName || '').trim().toLowerCase(),
    args: canonicalizeForIdempotency(params.args || {}),
  });
  const digest = createHash('sha256').update(material).digest('hex').slice(0, 32);
  return `mcp:${params.tenantId}:${String(params.toolName || '').trim().toLowerCase()}:${digest}`;
}

/**
 * Ensure args.idempotency_key is present for external writes.
 * Prefers caller-supplied key; otherwise derives a stable business key.
 * Mutates args in place and returns the key used.
 */
export function ensureMcpIdempotencyKey(params: {
  tenantId: string;
  toolName: string;
  args: Record<string, unknown>;
  /** Domain capabilities may require keys even when their MCP tier is internal. */
  requireKey?: boolean;
}): string | null {
  if (!params.requireKey && !mcpToolRequiresIdempotency(params.toolName)) return null;
  const existing =
    typeof params.args.idempotency_key === 'string'
      ? params.args.idempotency_key.trim()
      : typeof params.args.idempotencyKey === 'string'
        ? params.args.idempotencyKey.trim()
        : '';
  if (existing) {
    params.args.idempotency_key = existing;
    return existing;
  }
  const derived = deriveStableMcpIdempotencyKey(params);
  params.args.idempotency_key = derived;
  return derived;
}
