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
