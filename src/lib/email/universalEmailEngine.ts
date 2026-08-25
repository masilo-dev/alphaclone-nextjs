import { createHash, randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { renderAlphaCloneEmailLayout } from '@/lib/email/alphaCloneEmailLayouts';
import {
  COMMUNICATION_CLASS_RULES,
  resolveEffectiveUnsubscribePolicy,
  shouldIncludeListUnsubscribeHeaders,
  type EmailCommunicationClass,
} from '@/lib/email/emailCommunicationClasses';
import {
  getEmailPurpose,
  resolvePurposeByEventType,
  EMAIL_PURPOSE_REGISTRY,
  type EmailPurposeDefinition,
} from '@/lib/email/emailPurposeRegistry';
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { isCategoryEmailEnabled, isMarketingGloballyEnabled } from '@/lib/email/emailPreferences';
import { renderSubjectAndPreheader, type PersonalizationVariables } from '@/lib/email/personalizationEngine';
import { SITE_URL } from '@/lib/siteUrl';

export type UniversalEmailSendInput = {
  templateKey?: string;
  eventType?: string;
  tenantId: string;
  recipientEmail: string;
  recipientId?: string;
  recipientType?: 'user' | 'lead' | 'contact' | 'client' | 'prospect';
  entityType?: string;
  entityId?: string;
  senderIdentity?: string;
  variables?: PersonalizationVariables;
  ctaUrl?: string;
  userId?: string;
  stats?: Array<{ label: string; value: string }>;
  idempotencyKey?: string;
  skipPreferenceCheck?: boolean;
  skipSuppressionCheck?: boolean;
};

export type UniversalEmailSendResult = {
  success: boolean;
  skipped?: boolean;
  skipReason?: string;
  communicationId?: string;
  emailId?: string;
  provider?: string;
  error?: string;
};

function buildCommunicationIdempotencyKey(input: UniversalEmailSendInput, purpose: EmailPurposeDefinition): string {
  if (input.idempotencyKey) return input.idempotencyKey;
  const raw = [
    input.tenantId,
    purpose.templateKey,
    input.recipientEmail,
    input.entityType || '',
    input.entityId || '',
    new Date().toISOString().slice(0, 13),
  ].join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

async function recordCommunication(params: {
  id: string;
  input: UniversalEmailSendInput;
  purpose: EmailPurposeDefinition;
  subject: string;
  preheader: string;
  deliveryStatus: string;
  provider?: string;
  providerMessageId?: string;
  error?: string;
  idempotencyKey: string;
}) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from('email_communications').upsert(
      {
        id: params.id,
        template_key: params.purpose.templateKey,
        category: params.purpose.preferenceCategory,
        communication_class: params.purpose.communicationClass,
        tenant_id: params.input.tenantId,
        recipient_id: params.input.recipientId || null,
        recipient_type: params.input.recipientType || null,
        recipient_email: params.input.recipientEmail.trim().toLowerCase(),
        event_type: params.input.eventType || params.purpose.eventType || null,
        entity_type: params.input.entityType || null,
        entity_id: params.input.entityId || null,
        sender_identity: params.input.senderIdentity || 'AlphaClone Systems',
        subject: params.subject,
        preheader: params.preheader,
        personalisation: params.input.variables || {},
        cta_url: params.input.ctaUrl || null,
        priority: params.purpose.defaultPriority,
        unsubscribe_policy: params.purpose.unsubscribePolicy,
        delivery_status: params.deliveryStatus,
        provider: params.provider || null,
        provider_message_id: params.providerMessageId || null,
        idempotency_key: params.idempotencyKey,
        error: params.error || null,
        sent_at: params.deliveryStatus === 'sent' ? new Date().toISOString() : null,
        failed_at: params.deliveryStatus === 'failed' ? new Date().toISOString() : null,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true },
    );
  } catch (err) {
    console.warn('[universalEmailEngine] recordCommunication failed:', err);
  }
}

async function shouldSkipDelivery(
  input: UniversalEmailSendInput,
  purpose: EmailPurposeDefinition,
): Promise<{ skip: boolean; reason?: string }> {
  const rules = COMMUNICATION_CLASS_RULES[purpose.communicationClass];
  const email = input.recipientEmail.trim().toLowerCase();

  if (rules.respectsSuppression && !input.skipSuppressionCheck) {
    const suppressed = await isEmailSuppressed(input.tenantId, email);
    if (suppressed) return { skip: true, reason: 'suppressed' };
  }

  if (rules.respectsUserPreferences && !input.skipPreferenceCheck && input.userId) {
    const globalOk = await isMarketingGloballyEnabled(input.userId, input.tenantId);
    if (!globalOk && purpose.unsubscribePolicy === 'global_marketing') {
      return { skip: true, reason: 'global_marketing_disabled' };
    }
    const categoryOk = await isCategoryEmailEnabled(
      input.userId,
      input.tenantId,
      purpose.preferenceCategory,
    );
    if (!categoryOk) return { skip: true, reason: 'category_disabled' };
  }

  return { skip: false };
}

/**
 * Universal email send — purpose registry → personalization → layout → delivery → audit record.
 */
export async function sendUniversalEmail(input: UniversalEmailSendInput): Promise<UniversalEmailSendResult> {
  const purpose = input.templateKey
    ? getEmailPurpose(input.templateKey)
    : input.eventType
      ? resolvePurposeByEventType(input.eventType)
      : null;

  if (!purpose) {
    return { success: false, error: 'Unknown email purpose — provide templateKey or eventType' };
  }

  const recipientEmail = input.recipientEmail.trim().toLowerCase();
  if (!recipientEmail || !input.tenantId) {
    return { success: false, error: 'tenantId and recipientEmail are required' };
  }

  const skipCheck = await shouldSkipDelivery(input, purpose);
  if (skipCheck.skip) {
    return { success: false, skipped: true, skipReason: skipCheck.reason };
  }

  const { subject, preheader } = renderSubjectAndPreheader(
    purpose.subjectTemplate,
    purpose.preheaderTemplate,
    input.variables || {},
    { recipientEmail },
  );

  const policy = resolveEffectiveUnsubscribePolicy(purpose.communicationClass, purpose.unsubscribePolicy);
  const unsubscribeUrl = policy !== 'none' ? buildUnsubscribeUrl(recipientEmail, input.tenantId) : undefined;
  const preferencesUrl = `${SITE_URL}/preferences/email?tenant=${encodeURIComponent(input.tenantId)}&email=${encodeURIComponent(recipientEmail)}`;
  const ctaUrl = input.ctaUrl || input.variables?.cta_url as string | undefined;

  const layout = renderAlphaCloneEmailLayout({
    layoutFamily: purpose.layoutFamily,
    subject,
    preheader,
    headline: purpose.headlineTemplate,
    bodyHtml: purpose.bodyTemplate,
    ctaLabel: purpose.ctaLabel,
    ctaUrl: typeof ctaUrl === 'string' ? ctaUrl : undefined,
    variables: input.variables,
    unsubscribeUrl,
    preferencesUrl,
    stats: input.stats,
  });

  const communicationId = randomUUID();
  const idempotencyKey = buildCommunicationIdempotencyKey(input, purpose);
  const includeListUnsubscribe = shouldIncludeListUnsubscribeHeaders(purpose.communicationClass, policy);

  const sendResult = await sendEmailServer({
    tenantId: input.tenantId,
    userId: input.userId,
    to: recipientEmail,
    subject,
    html: layout.html,
    text: layout.text,
    isPlatformNotification: purpose.communicationClass !== 'outreach_marketing',
    templateName: purpose.templateKey,
    listUnsubscribeUrl: includeListUnsubscribe ? unsubscribeUrl : undefined,
    auditMetadata: {
      communication_id: communicationId,
      template_key: purpose.templateKey,
      event_type: input.eventType || purpose.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId,
    },
  });

  await recordCommunication({
    id: communicationId,
    input,
    purpose,
    subject,
    preheader,
    deliveryStatus: sendResult.success ? 'sent' : 'failed',
    provider: sendResult.provider,
    providerMessageId: sendResult.emailId,
    error: sendResult.error,
    idempotencyKey,
  });

  return {
    success: sendResult.success,
    communicationId,
    emailId: sendResult.emailId,
    provider: sendResult.provider,
    error: sendResult.error,
  };
}

export function mapEventTypeToTemplateKey(eventType: string): string | null {
  return resolvePurposeByEventType(eventType)?.templateKey || null;
}

export function listPurposesByClass(communicationClass: EmailCommunicationClass): EmailPurposeDefinition[] {
  return Object.values(EMAIL_PURPOSE_REGISTRY).filter((p) => p.communicationClass === communicationClass);
}
