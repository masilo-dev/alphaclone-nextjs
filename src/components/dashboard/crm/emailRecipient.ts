import type { BusinessClient } from '@/services/businessClientService';

export type EmailRecipient = {
  name: string;
  email: string;
  id?: string;
  industry?: string;
  description?: string;
};

/** Parse "Name <email@domain.com>" or bare email strings from mail headers. */
export function parseEmailFromHeader(raw: string): { name: string; email: string } {
  const trimmed = String(raw || '').trim();
  const angleMatch = trimmed.match(/<([^>]+@[^>]+)>/);
  if (angleMatch) {
    const name = trimmed.split('<')[0].trim().replace(/^"|"$/g, '');
    return { name: name || angleMatch[1], email: angleMatch[1].trim() };
  }
  if (trimmed.includes('@')) {
    return { name: trimmed.split('@')[0], email: trimmed };
  }
  return { name: trimmed || 'Recipient', email: '' };
}

export function toBusinessClientFromRecipient(
  recipient: EmailRecipient,
  tenantId: string
): BusinessClient {
  return {
    id: recipient.id || `email-${recipient.email}`,
    tenantId,
    name: recipient.name,
    email: recipient.email,
    salesStage: 'prospect',
    value: 0,
    description: recipient.description,
    industry: recipient.industry,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
  };
}
