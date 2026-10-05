import { createHash } from 'node:crypto';

function hashParts(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function invoiceSendIdempotencyKey(params: {
  tenantId: string;
  invoiceId: string;
  recipients: string[];
}): string {
  const recipients = [...new Set(params.recipients.map((e) => e.trim().toLowerCase()))].sort();
  return `invoice-send:${params.tenantId}:${params.invoiceId}:${hashParts(recipients)}`;
}

export function quoteSendIdempotencyKey(params: {
  tenantId: string;
  quoteId: string;
  recipients: string[];
}): string {
  const recipients = [...new Set(params.recipients.map((e) => e.trim().toLowerCase()))].sort();
  return `quote-send:${params.tenantId}:${params.quoteId}:${hashParts(recipients)}`;
}

export function socialPublishIdempotencyKey(params: {
  tenantId: string;
  postId: string;
  destinationKey: string;
}): string {
  return `social-publish:${params.tenantId}:${params.postId}:${params.destinationKey}`;
}

export function contractSendIdempotencyKey(params: {
  tenantId: string;
  contractId: string;
  recipient: string;
  version?: string | number;
}): string {
  return `contract-send:${params.tenantId}:${params.contractId}:${params.recipient.toLowerCase()}:v${params.version ?? 'latest'}`;
}
