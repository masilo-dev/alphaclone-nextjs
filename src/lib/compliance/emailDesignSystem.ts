import type {
  BrandIdentity,
  CommunicationClassification,
  CommunicationPurpose,
  PolicyReference,
  ResolvedCommunicationCompliance,
} from './communicationCompliance';
import {
  renderEmail,
  type EmailFooterType,
  type EmailTemplateType,
} from '@/lib/email/renderEmail';
import { resolveEmailLogoUrl } from '@/lib/email/emailConfig';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));

export interface EmailShellInput {
  subject: string;
  preheader?: string;
  contentHtml: string;
  contentText: string;
  brand: BrandIdentity;
  purpose: CommunicationPurpose;
  compliance: ResolvedCommunicationCompliance;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  dataRequestUrl?: string;
  templateType?: string;
}

function policyLink(policy: PolicyReference | undefined, label: string): string {
  return policy
    ? `<a href="${escapeHtml(policy.publicUrl)}" style="color:#475569;text-decoration:underline;">${label}</a>`
    : '';
}

function classificationToTemplateType(classification: CommunicationClassification): EmailTemplateType {
  switch (classification) {
    case 'marketing':
      return 'marketing_campaign';
    case 'sales_outreach':
      return 'outreach';
    case 'security':
      return 'account_verification';
    case 'invoice':
      return 'invoice';
    case 'contract':
      return 'contract';
    case 'appointment':
      return 'booking_reminder';
    case 'account_notification':
      return 'system_notification';
    default:
      return 'transactional';
  }
}

function classificationToFooter(compliance: ResolvedCommunicationCompliance): EmailFooterType {
  if (compliance.unsubscribeRequired) {
    return compliance.classification === 'sales_outreach' ? 'outreach' : 'marketing';
  }
  if (compliance.classification === 'marketing') return 'marketing';
  if (compliance.classification === 'sales_outreach') return 'outreach';
  return 'transactional';
}

/** @deprecated Use renderEmail directly. Kept for gateway compatibility. */
export function renderComplianceFooter(input: EmailShellInput): { html: string; text: string } {
  return renderEmailShell(input);
}

export function renderEmailShell(input: EmailShellInput): { html: string; text: string } {
  const footerType = classificationToFooter(input.compliance);
  const templateType = classificationToTemplateType(input.compliance.classification);

  return renderEmail({
    type: templateType,
    subject: input.subject,
    preheader: input.preheader || input.subject,
    content: input.contentHtml,
    contentIsHtml: true,
    footerType,
    unsubscribeUrl: input.compliance.unsubscribeRequired ? input.unsubscribeUrl : undefined,
    preferencesUrl: input.preferencesUrl,
    reasonText: `You are receiving this message because ${input.purpose.reasonText}.`,
    tenantName: input.brand.tradingName || input.brand.legalCompanyName,
    logoUrl: resolveEmailLogoUrl(),
  });
}

export { policyLink };
