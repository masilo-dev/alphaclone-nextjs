export type EmailReferenceType = 'auto' | 'provider_message_id' | 'action_id' | 'idempotency_key' | 'tracking_id';
export function isUuidEmailReference(reference: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference);
}
export function emailReceiptReferenceFields(type: EmailReferenceType, reference: string): string[] {
  if ((type === 'action_id' || type === 'tracking_id') && !isUuidEmailReference(reference)) throw Object.assign(new Error('input.message_id must be a UUID for the selected reference_type'), {code: 'VALIDATION_ERROR'});
  if (type === 'tracking_id') return [];
  if (type === 'provider_message_id') return ['provider_reference'];
  if (type !== 'auto') return [type];
  return ['provider_reference', 'idempotency_key', ...(isUuidEmailReference(reference) ? ['action_id'] : [])];
}

/** Resolve only an actual email recipient, never a contract/project resource ID. */
export function emailReceiptRecipient(receipt?: Record<string, any>, tracking?: Record<string, any> | null): string | null {
  const output = receipt?.sanitized_output || {};
  const target = receipt?.sanitized_input?.target || {};
  const candidates = [output.sent_to, output.recipient, output.data?.recipient,
    ['email', 'email_message'].includes(target.resource_type) ? target.resource_id : undefined,
    tracking?.lead_email];
  return candidates.find(value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) || null;
}
