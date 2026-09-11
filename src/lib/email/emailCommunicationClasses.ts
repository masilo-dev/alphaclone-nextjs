/**
 * Email communication classes — each has distinct delivery, unsubscribe, and frequency rules.
 */
export type EmailCommunicationClass =
  | 'transactional'
  | 'business_notification'
  | 'digest'
  | 'outreach_marketing';

export type UnsubscribePolicy =
  | 'none'
  | 'category'
  | 'global_marketing'
  | 'outreach_only';

export type EmailDeliveryPriority = 'critical' | 'high' | 'normal' | 'low';

export type EmailLayoutFamily =
  | 'welcome'
  | 'morning_brief'
  | 'action_required'
  | 'success'
  | 'failure'
  | 'security'
  | 'light'
  | 'dark';

export type EmailPurposeFamily =
  | 'account_auth'
  | 'onboarding'
  | 'business_intelligence'
  | 'crm_leads'
  | 'outreach_campaigns'
  | 'email_communication'
  | 'sales_proposals'
  | 'invoices_money'
  | 'calendar_meetings'
  | 'social_marketing'
  | 'mcp_automation'
  | 'platform_integrations';

export interface CommunicationClassRules {
  class: EmailCommunicationClass;
  /** Whether recipient preferences can block delivery */
  respectsUserPreferences: boolean;
  /** Whether suppression list blocks delivery */
  respectsSuppression: boolean;
  /** Whether marketing consent is required */
  requiresMarketingConsent: boolean;
  /** Default unsubscribe policy when not overridden per-purpose */
  defaultUnsubscribePolicy: UnsubscribePolicy;
  /** Include List-Unsubscribe headers */
  supportsOneClickUnsubscribe: boolean;
  /** Can be aggregated into digests */
  allowDigestAggregation: boolean;
  /** Frequency cap applies */
  applyFrequencyCap: boolean;
}

export const COMMUNICATION_CLASS_RULES: Record<EmailCommunicationClass, CommunicationClassRules> = {
  transactional: {
    class: 'transactional',
    respectsUserPreferences: false,
    respectsSuppression: false,
    requiresMarketingConsent: false,
    defaultUnsubscribePolicy: 'none',
    supportsOneClickUnsubscribe: false,
    allowDigestAggregation: false,
    applyFrequencyCap: false,
  },
  business_notification: {
    class: 'business_notification',
    respectsUserPreferences: true,
    respectsSuppression: false,
    requiresMarketingConsent: false,
    defaultUnsubscribePolicy: 'category',
    supportsOneClickUnsubscribe: false,
    allowDigestAggregation: true,
    applyFrequencyCap: true,
  },
  digest: {
    class: 'digest',
    respectsUserPreferences: true,
    respectsSuppression: false,
    requiresMarketingConsent: false,
    defaultUnsubscribePolicy: 'category',
    supportsOneClickUnsubscribe: false,
    allowDigestAggregation: false,
    applyFrequencyCap: true,
  },
  outreach_marketing: {
    class: 'outreach_marketing',
    respectsUserPreferences: true,
    respectsSuppression: true,
    requiresMarketingConsent: true,
    defaultUnsubscribePolicy: 'outreach_only',
    supportsOneClickUnsubscribe: true,
    allowDigestAggregation: false,
    applyFrequencyCap: true,
  },
};

export function resolveEffectiveUnsubscribePolicy(
  communicationClass: EmailCommunicationClass,
  purposePolicy?: UnsubscribePolicy,
): UnsubscribePolicy {
  if (purposePolicy) return purposePolicy;
  return COMMUNICATION_CLASS_RULES[communicationClass].defaultUnsubscribePolicy;
}

export function shouldIncludeListUnsubscribeHeaders(
  communicationClass: EmailCommunicationClass,
  policy: UnsubscribePolicy,
): boolean {
  if (policy === 'none') return false;
  return COMMUNICATION_CLASS_RULES[communicationClass].supportsOneClickUnsubscribe;
}
