import { createHash } from 'node:crypto';

export interface OutboundApprovalPayload {
  to: string | string[];
  sender?: string;
  subject: string;
  body?: string;
  html?: string;
  channel?: string;
  attachments?: Array<{ filename: string; contentType?: string }>;
}

/**
 * Computes a deterministic SHA-256 hash of the exact outbound message payload.
 * Any modification to the recipient, subject, body, or attachments invalidates prior approvals.
 */
export function computeOutboundContentHash(payload: OutboundApprovalPayload): string {
  const recipients = (Array.isArray(payload.to) ? payload.to : [payload.to])
    .map((r) => String(r || '').trim().toLowerCase())
    .sort()
    .join(',');

  const subject = String(payload.subject || '').trim();
  const content = String(payload.html || payload.body || '').trim();
  const sender = String(payload.sender || '').trim().toLowerCase();
  const channel = String(payload.channel || 'email').trim().toLowerCase();

  const attachments = (payload.attachments || [])
    .map((a) => `${a.filename}:${a.contentType || ''}`)
    .sort()
    .join('|');

  const normalized = `channel:${channel}|sender:${sender}|recipients:${recipients}|subject:${subject}|content:${content}|attachments:${attachments}`;

  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Validates that an existing approval's content hash matches the live execution payload.
 */
export function verifyApprovalContentMatch(
  storedHash: string | null | undefined,
  currentPayload: OutboundApprovalPayload
): { valid: boolean; reason?: string } {
  if (!storedHash) {
    return { valid: false, reason: 'Approval record is missing content hash' };
  }

  const currentHash = computeOutboundContentHash(currentPayload);
  if (storedHash !== currentHash) {
    return {
      valid: false,
      reason: 'Outbound content or recipient was modified after approval was granted. Re-approval required.',
    };
  }

  return { valid: true };
}
