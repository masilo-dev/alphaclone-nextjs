export const COMMUNICATION_CLASSIFICATIONS = [
  'transactional',
  'service',
  'support',
  'ticket_reply',
  'security',
  'authentication',
  'billing',
  'invoice',
  'payment_receipt',
  'contract',
  'document_delivery',
  'appointment',
  'project_update',
  'account_notification',
  'marketing',
  'sales_outreach',
  'newsletter',
  'product_announcement',
  'legal_notice',
  'privacy_notice',
  'consent_request',
  'internal',
  'custom',
] as const;

export type CommunicationClassification = typeof COMMUNICATION_CLASSIFICATIONS[number];
export type LegalBasis = 'consent' | 'contract' | 'legal_obligation' | 'vital_interests'
  | 'public_task' | 'legitimate_interests' | 'not_required';
export type ConsentStatus = 'pending' | 'granted' | 'denied' | 'withdrawn' | 'expired'
  | 'not_required' | 'legitimate_interest_review_required' | 'suppressed' | 'unknown';

const MARKETING_TYPES = new Set<CommunicationClassification>([
  'marketing', 'sales_outreach', 'newsletter', 'product_announcement',
]);
const REQUIRED_SERVICE_TYPES = new Set<CommunicationClassification>([
  'transactional', 'service', 'support', 'ticket_reply', 'security', 'authentication',
  'billing', 'invoice', 'payment_receipt', 'contract', 'document_delivery', 'appointment',
  'project_update', 'account_notification', 'legal_notice', 'privacy_notice',
]);

export interface CommunicationPurpose {
  category: string;
  reasonText: string;
  relatedRecordType?: string;
  relatedRecordId?: string;
  requestedByRecipient?: boolean;
  campaignId?: string;
  contractId?: string;
  ticketId?: string;
  invoiceId?: string;
}

export interface BrandIdentity {
  id?: string;
  legalCompanyName: string;
  tradingName?: string;
  logoUrl?: string;
  logoAlt?: string;
  primaryColor?: string;
  textColor?: string;
  postalAddress?: string;
  website?: string;
  supportEmail?: string;
  privacyContact?: string;
  registrationNumber?: string;
  taxNumber?: string;
}

export interface PolicyReference {
  id: string;
  type: 'privacy' | 'terms' | 'cookies' | 'email' | 'security' | 'subprocessors' | 'legal_notice';
  version: string;
  language: string;
  publicUrl: string;
  status: 'published';
}

export interface TrackingDecision {
  delivery: boolean;
  bounce: boolean;
  opens: boolean;
  links: boolean;
  documentDownloads: boolean;
  disclosure?: string;
}

export interface ComplianceInput {
  tenantId: string;
  senderIdentityId: string;
  senderEmail: string;
  recipientEmail: string;
  classification: CommunicationClassification;
  purpose: CommunicationPurpose;
  brand: BrandIdentity;
  locale: string;
  localeSource: string;
  recipientCountry?: string;
  jurisdictionSource?: string;
  jurisdictionConfidence?: 'verified' | 'declared' | 'inferred' | 'unknown';
  consentStatus: ConsentStatus;
  consentRecordId?: string;
  legalBasis?: LegalBasis;
  suppressed?: boolean;
  policies: PolicyReference[];
  requestedTracking?: Partial<TrackingDecision>;
  regionalOpenTrackingAllowed?: boolean;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  dataRequestUrl?: string;
  links?: string[];
  approvalCompleted?: boolean;
  approvalRequired?: boolean;
}

export interface ComplianceIssue {
  code: string;
  field: string;
  message: string;
  blocking: boolean;
}

export interface ResolvedCommunicationCompliance {
  ready: boolean;
  classification: CommunicationClassification;
  marketing: boolean;
  requiredServiceMessage: boolean;
  locale: string;
  localeSource: string;
  policyVersionIds: string[];
  privacyPolicy?: PolicyReference;
  termsPolicy?: PolicyReference;
  tracking: TrackingDecision;
  unsubscribeRequired: boolean;
  postalAddressRequired: boolean;
  issues: ComplianceIssue[];
}

function validHttpsUrl(value?: string): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function isMarketingClassification(value: CommunicationClassification): boolean {
  return MARKETING_TYPES.has(value);
}

export function resolveCommunicationCompliance(input: ComplianceInput): ResolvedCommunicationCompliance {
  const issues: ComplianceIssue[] = [];
  const marketing = isMarketingClassification(input.classification);
  const privacyPolicy = input.policies.find((policy) => policy.type === 'privacy');
  const termsPolicy = input.policies.find((policy) => policy.type === 'terms');
  const add = (code: string, field: string, message: string, blocking = true) =>
    issues.push({ code, field, message, blocking });

  if (!input.tenantId) add('TENANT_REQUIRED', 'tenantId', 'A tenant must be resolved.');
  if (!input.senderIdentityId || !input.senderEmail) {
    add('SENDER_IDENTITY_REQUIRED', 'senderIdentityId', 'A verified sending identity must be resolved.');
  }
  if (!input.recipientEmail) add('RECIPIENT_REQUIRED', 'recipientEmail', 'A recipient is required.');
  if (!input.purpose.category || !input.purpose.reasonText.trim()) {
    add('PURPOSE_REQUIRED', 'purpose', 'A structured, recipient-safe communication reason is required.');
  }
  if (!input.brand.legalCompanyName) add('BRAND_REQUIRED', 'brand', 'Tenant brand identity is incomplete.');
  if (!privacyPolicy || !validHttpsUrl(privacyPolicy.publicUrl)) {
    add('PRIVACY_POLICY_REQUIRED', 'policies', 'A published HTTPS privacy policy is required.');
  }
  if (input.suppressed || input.consentStatus === 'suppressed') {
    add('RECIPIENT_SUPPRESSED', 'recipientEmail', 'The recipient is on the suppression list.');
  }
  if (marketing) {
    if (input.consentStatus !== 'granted' && input.legalBasis !== 'legitimate_interests') {
      add('MARKETING_BASIS_REQUIRED', 'consentStatus', 'Marketing requires recorded consent or an approved sending basis.');
    }
    if (input.legalBasis === 'legitimate_interests' && !input.approvalCompleted) {
      add('LIA_APPROVAL_REQUIRED', 'approvalCompleted', 'Legitimate-interest outreach requires human approval.');
    }
    if (!validHttpsUrl(input.unsubscribeUrl)) {
      add('UNSUBSCRIBE_REQUIRED', 'unsubscribeUrl', 'Marketing requires a secure HTTPS unsubscribe link.');
    }
    if (!input.brand.postalAddress) {
      add('POSTAL_ADDRESS_REQUIRED', 'brand.postalAddress', 'Marketing requires the sender postal address.');
    }
  }
  if (input.approvalRequired && !input.approvalCompleted) {
    add('APPROVAL_REQUIRED', 'approvalCompleted', 'This communication requires approval before sending.');
  }
  for (const link of input.links || []) {
    if (!validHttpsUrl(link)) add('INVALID_LINK', 'links', `The link cannot be sent: ${link}`);
  }

  const opens = Boolean(input.requestedTracking?.opens)
    && input.regionalOpenTrackingAllowed === true
    && (input.consentStatus === 'granted' || !marketing);
  const tracking: TrackingDecision = {
    delivery: input.requestedTracking?.delivery !== false,
    bounce: input.requestedTracking?.bounce !== false,
    opens,
    links: Boolean(input.requestedTracking?.links) && (input.consentStatus === 'granted' || !marketing),
    documentDownloads: Boolean(input.requestedTracking?.documentDownloads),
    disclosure: opens
      ? 'Open events may be generated by privacy-protection software or security scanners.'
      : undefined,
  };

  return {
    ready: !issues.some((issue) => issue.blocking),
    classification: input.classification,
    marketing,
    requiredServiceMessage: REQUIRED_SERVICE_TYPES.has(input.classification),
    locale: input.locale,
    localeSource: input.localeSource,
    policyVersionIds: input.policies.map((policy) => policy.id),
    privacyPolicy,
    termsPolicy,
    tracking,
    unsubscribeRequired: marketing,
    postalAddressRequired: marketing,
    issues,
  };
}

export function resolveLocale(input: {
  recipient?: string;
  client?: string;
  company?: string;
  tenantCommunication?: string;
  tenantDefault?: string;
  platformFallback?: string;
}): { locale: string; source: string } {
  const candidates: Array<[string, string | undefined]> = [
    ['recipient_preference', input.recipient],
    ['client_preference', input.client],
    ['company_preference', input.company],
    ['tenant_communication', input.tenantCommunication],
    ['tenant_default', input.tenantDefault],
    ['platform_fallback', input.platformFallback || 'en'],
  ];
  const resolved = candidates.find(([, value]) => Boolean(value?.trim()))!;
  return { locale: resolved[1]!.trim(), source: resolved[0] };
}
