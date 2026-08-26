import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmail, type OutboundEmailProvider, type SendEmailResult } from '@/lib/email/sendEmail';
import { loadTenantEmailBrandingProfile } from '@/lib/email/tenantEmailBranding';
import {
  buildEmailContentHtml,
  buildEmailContentText,
  stripRawHtmlDocument,
} from '@/lib/email/emailContentBuilder';
import { renderEmailShell } from '@/lib/compliance/emailDesignSystem';
import {
  resolveCommunicationCompliance,
  resolveLocale,
  type CommunicationClassification,
  type CommunicationPurpose,
} from '@/lib/compliance/communicationCompliance';
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe';
import { absoluteUrl } from '@/lib/siteUrl';
import { recordSuccessfulEmailSend } from '@/lib/email/usageMeteringService';

export type EmailGatewayCategory =
  | 'marketing'
  | 'outreach'
  | 'transactional'
  | 'account_security'
  | 'invoice_payment'
  | 'contract_document'
  | 'booking_calendar'
  | 'internal_notification';

export interface EmailGatewayCta {
  label: string;
  url: string;
}

export interface EmailGatewayRequest {
  tenantId: string;
  userId?: string;
  to: string | string[];
  subject: string;
  message?: string;
  html?: string;
  category: EmailGatewayCategory;
  templateId?: string;
  senderName?: string;
  senderRole?: string;
  replyTo?: string;
  headline?: string;
  recipientName?: string;
  greeting?: string;
  cta?: EmailGatewayCta;
  relatedRecord?: { type: string; id: string };
  campaignId?: string;
  workflowId?: string;
  initiationSource: string;
  isPlatformNotification?: boolean;
  isReply?: boolean;
  preferredProvider?: OutboundEmailProvider;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
  listUnsubscribeUrl?: string;
  idempotencyKey?: string;
  skipRecipientGate?: boolean;
  auditMetadata?: Record<string, unknown>;
}

export interface EmailGatewayResult extends SendEmailResult {
  gatewayVersion: string;
  templateVersion: string;
  brandingVersion?: string;
  category: EmailGatewayCategory;
  quotaCharged?: boolean;
}

const GATEWAY_VERSION = 'email-gateway-v1';

function mapCategoryToClassification(category: EmailGatewayCategory): CommunicationClassification {
  switch (category) {
    case 'marketing':
      return 'marketing';
    case 'outreach':
      return 'sales_outreach';
    case 'transactional':
      return 'transactional';
    case 'account_security':
      return 'security';
    case 'invoice_payment':
      return 'invoice';
    case 'contract_document':
      return 'contract';
    case 'booking_calendar':
      return 'appointment';
    case 'internal_notification':
      return 'account_notification';
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

function categoryReasonText(category: EmailGatewayCategory, tenantName: string): string {
  switch (category) {
    case 'marketing':
      return `you opted in to receive updates from ${tenantName}`;
    case 'outreach':
      return `${tenantName} is following up on a business conversation with you`;
    case 'transactional':
      return `you have an active relationship with ${tenantName}`;
    case 'account_security':
      return `this is a security-related message for your account with ${tenantName}`;
    case 'invoice_payment':
      return `you have a billing or payment record with ${tenantName}`;
    case 'contract_document':
      return `you are involved in a document or agreement with ${tenantName}`;
    case 'booking_calendar':
      return `you have a scheduled appointment or booking with ${tenantName}`;
    case 'internal_notification':
      return `you are a member of ${tenantName} on AlphaClone Systems`;
    default:
      return `you have a business relationship with ${tenantName}`;
  }
}

function buildPurpose(category: EmailGatewayCategory, tenantName: string, req: EmailGatewayRequest): CommunicationPurpose {
  return {
    category,
    reasonText: categoryReasonText(category, tenantName),
    relatedRecordType: req.relatedRecord?.type,
    relatedRecordId: req.relatedRecord?.id,
    campaignId: req.campaignId,
  };
}

async function recordGatewayAudit(params: {
  tenantId: string;
  userId?: string;
  category: EmailGatewayCategory;
  initiationSource: string;
  recipient: string;
  subject: string;
  status: 'rendered' | 'blocked' | 'sent' | 'failed';
  provider?: string;
  templateVersion: string;
  brandingVersion?: string;
  errorCode?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from('email_delivery_audit').insert({
      tenant_id: params.tenantId,
      user_id: params.userId || null,
      category: params.category,
      initiation_source: params.initiationSource,
      recipient_hash: Buffer.from(params.recipient.toLowerCase()).toString('base64').slice(0, 64),
      subject_preview: params.subject.slice(0, 120),
      status: params.status,
      provider: params.provider || null,
      template_version: params.templateVersion,
      branding_version: params.brandingVersion || null,
      error_code: params.errorCode || null,
      idempotency_key: params.idempotencyKey || null,
      metadata: params.metadata || {},
    });
  } catch {
    // audit table may not exist in all environments yet
  }
}

export async function sendViaEmailGateway(request: EmailGatewayRequest): Promise<EmailGatewayResult> {
  const recipients = Array.isArray(request.to) ? request.to : [request.to];
  const primaryRecipient = String(recipients[0] || '').trim().toLowerCase();

  if (!request.tenantId || !primaryRecipient || !request.subject?.trim()) {
    return {
      success: false,
      tried: [],
      error: 'tenantId, recipient, and subject are required',
      code: 'MISSING_FIELDS',
      gatewayVersion: GATEWAY_VERSION,
      templateVersion: request.templateId || 'default',
      category: request.category,
    };
  }

  if (!request.message?.trim() && !request.html?.trim()) {
    return {
      success: false,
      tried: [],
      error: 'message or html content is required',
      code: 'MISSING_CONTENT',
      gatewayVersion: GATEWAY_VERSION,
      templateVersion: request.templateId || 'default',
      category: request.category,
    };
  }

  const branding = await loadTenantEmailBrandingProfile(request.tenantId, {
    isPlatformNotification: request.isPlatformNotification,
  });

  const tenantName = branding.brand.tradingName || branding.brand.legalCompanyName;
  const classification = mapCategoryToClassification(request.category);
  const purpose = buildPurpose(request.category, tenantName, request);
  const locale = resolveLocale({ tenantDefault: 'en' });
  const unsubscribeUrl =
    request.listUnsubscribeUrl ||
    (primaryRecipient ? buildUnsubscribeUrl(primaryRecipient, request.tenantId) : undefined);

  const compliance = resolveCommunicationCompliance({
    tenantId: request.tenantId,
    senderIdentityId: request.userId || request.tenantId,
    senderEmail: branding.replyToEmail || branding.fromEmail || 'notifications@alphaclonesystems.com',
    recipientEmail: primaryRecipient,
    classification,
    purpose,
    brand: branding.brand,
    locale: locale.locale,
    localeSource: locale.source,
    consentStatus: request.category === 'marketing' || request.category === 'outreach' ? 'granted' : 'not_required',
    policies: [
      { id: 'privacy', type: 'privacy', version: '1', language: locale.locale, publicUrl: branding.privacyPolicyUrl, status: 'published' },
      { id: 'terms', type: 'terms', version: '1', language: locale.locale, publicUrl: branding.termsUrl, status: 'published' },
    ],
    unsubscribeUrl,
    preferencesUrl: branding.preferencesUrl,
    dataRequestUrl: absoluteUrl('/legal/data-request'),
    links: request.cta?.url ? [request.cta.url] : [],
  });

  if (!compliance.ready) {
    const blocking = compliance.issues.filter((issue) => issue.blocking);
    await recordGatewayAudit({
      tenantId: request.tenantId,
      userId: request.userId,
      category: request.category,
      initiationSource: request.initiationSource,
      recipient: primaryRecipient,
      subject: request.subject,
      status: 'blocked',
      templateVersion: request.templateId || 'default',
      brandingVersion: branding.version,
      errorCode: blocking[0]?.code,
      idempotencyKey: request.idempotencyKey,
    });
    return {
      success: false,
      tried: [],
      error: blocking.map((issue) => issue.message).join('; ') || 'Compliance validation failed',
      code: blocking[0]?.code || 'COMPLIANCE_BLOCKED',
      gatewayVersion: GATEWAY_VERSION,
      templateVersion: request.templateId || 'default',
      brandingVersion: branding.version,
      category: request.category,
    };
  }

  const greeting =
    request.greeting ||
    (request.recipientName ? `Hi ${request.recipientName.trim()},` : undefined);

  const bodySource = request.message?.trim()
    ? request.message
    : stripRawHtmlDocument(String(request.html || '')).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');

  const contentHtml = buildEmailContentHtml({
    headline: request.headline || request.subject,
    greeting,
    body: bodySource,
    cta: request.cta,
    signatureHtml: branding.signatureHtml,
    signatureText: branding.signatureText,
  });

  const contentText = buildEmailContentText({
    headline: request.headline || request.subject,
    greeting,
    body: bodySource,
    cta: request.cta,
    signatureText: branding.signatureText,
  });

  const rendered = renderEmailShell({
    subject: request.subject,
    preheader: request.headline || request.subject,
    contentHtml,
    contentText,
    brand: branding.brand,
    purpose,
    compliance,
    unsubscribeUrl,
    preferencesUrl: branding.preferencesUrl,
    dataRequestUrl: absoluteUrl('/legal/data-request'),
  });

  await recordGatewayAudit({
    tenantId: request.tenantId,
    userId: request.userId,
    category: request.category,
    initiationSource: request.initiationSource,
    recipient: primaryRecipient,
    subject: request.subject,
    status: 'rendered',
    templateVersion: request.templateId || 'default',
    brandingVersion: branding.version,
    idempotencyKey: request.idempotencyKey,
  });

  const sendResult = await sendEmail(
    request.tenantId,
    {
      to: request.to,
      subject: request.subject,
      html: rendered.html,
      text: rendered.text,
      fromName: request.senderName || branding.senderDisplayName,
      userId: request.userId,
      replyTo: request.replyTo || branding.replyToEmail,
      attachments: request.attachments,
      isPlatformNotification: request.isPlatformNotification,
      skipFooter: true,
      skipBonnieQualityCheck: false,
      skipRecipientGate: request.skipRecipientGate,
      listUnsubscribeUrl: compliance.unsubscribeRequired ? unsubscribeUrl : undefined,
      auditMetadata: {
        ...(request.auditMetadata || {}),
        email_gateway_version: GATEWAY_VERSION,
        email_category: request.category,
        template_id: request.templateId || 'default',
        branding_version: branding.version,
        initiation_source: request.initiationSource,
        workflow_id: request.workflowId || null,
        campaign_id: request.campaignId || null,
      },
    },
    request.preferredProvider,
  );

  if (sendResult.success) {
    const quotaCharged = await recordSuccessfulEmailSend({
      tenantId: request.tenantId,
      userId: request.userId,
      category: request.category,
      isReply: Boolean(request.isReply),
      initiationSource: request.initiationSource,
      idempotencyKey: request.idempotencyKey,
      provider: sendResult.provider,
      operationId: request.idempotencyKey || sendResult.emailId,
    });

    await recordGatewayAudit({
      tenantId: request.tenantId,
      userId: request.userId,
      category: request.category,
      initiationSource: request.initiationSource,
      recipient: primaryRecipient,
      subject: request.subject,
      status: 'sent',
      provider: sendResult.provider,
      templateVersion: request.templateId || 'default',
      brandingVersion: branding.version,
      idempotencyKey: request.idempotencyKey,
      metadata: { quota_charged: quotaCharged },
    });
  } else {
    await recordGatewayAudit({
      tenantId: request.tenantId,
      userId: request.userId,
      category: request.category,
      initiationSource: request.initiationSource,
      recipient: primaryRecipient,
      subject: request.subject,
      status: 'failed',
      templateVersion: request.templateId || 'default',
      brandingVersion: branding.version,
      errorCode: sendResult.code,
      idempotencyKey: request.idempotencyKey,
    });
  }

  return {
    ...sendResult,
    gatewayVersion: GATEWAY_VERSION,
    templateVersion: request.templateId || 'default',
    brandingVersion: branding.version,
    category: request.category,
    quotaCharged: sendResult.success,
  };
}

export async function previewEmailGateway(
  request: Omit<EmailGatewayRequest, 'to'> & { to?: string },
): Promise<{ html: string; text: string; complianceIssues: string[] }> {
  const branding = await loadTenantEmailBrandingProfile(request.tenantId, {
    isPlatformNotification: request.isPlatformNotification,
  });
  const tenantName = branding.brand.tradingName || branding.brand.legalCompanyName;
  const classification = mapCategoryToClassification(request.category);
  const purpose = buildPurpose(request.category, tenantName, request as EmailGatewayRequest);
  const locale = resolveLocale({ tenantDefault: 'en' });
  const compliance = resolveCommunicationCompliance({
    tenantId: request.tenantId,
    senderIdentityId: request.userId || request.tenantId,
    senderEmail: branding.replyToEmail || 'notifications@alphaclonesystems.com',
    recipientEmail: request.to || 'preview@example.com',
    classification,
    purpose,
    brand: branding.brand,
    locale: locale.locale,
    localeSource: locale.source,
    consentStatus: 'not_required',
    policies: [
      { id: 'privacy', type: 'privacy', version: '1', language: locale.locale, publicUrl: branding.privacyPolicyUrl, status: 'published' },
      { id: 'terms', type: 'terms', version: '1', language: locale.locale, publicUrl: branding.termsUrl, status: 'published' },
    ],
    unsubscribeUrl: absoluteUrl('/api/unsubscribe'),
    preferencesUrl: branding.preferencesUrl,
  });

  const bodySource = request.message?.trim() || 'Preview body content';
  const contentHtml = buildEmailContentHtml({
    headline: request.headline || request.subject,
    greeting: request.greeting,
    body: bodySource,
    cta: request.cta,
    signatureHtml: branding.signatureHtml,
  });
  const contentText = buildEmailContentText({
    headline: request.headline || request.subject,
    greeting: request.greeting,
    body: bodySource,
    cta: request.cta,
    signatureText: branding.signatureText,
  });
  const rendered = renderEmailShell({
    subject: request.subject,
    preheader: request.headline || request.subject,
    contentHtml,
    contentText,
    brand: branding.brand,
    purpose,
    compliance,
    unsubscribeUrl: absoluteUrl('/api/unsubscribe'),
    preferencesUrl: branding.preferencesUrl,
  });

  return {
    html: rendered.html,
    text: rendered.text,
    complianceIssues: compliance.issues.map((issue) => issue.message),
  };
}
