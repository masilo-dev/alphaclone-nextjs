import type { BusinessClient } from '@/services/businessClientService';
import {
  extractEmailAddress,
  formatMailFrom,
  parseEmailFromHeader,
} from '@/lib/email/parseEmailHeader';

export type EmailRecipient = {
  name: string;
  email: string;
  id?: string;
  industry?: string;
  description?: string;
};

export { extractEmailAddress, formatMailFrom, parseEmailFromHeader };

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
