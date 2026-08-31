import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ensureFooter, normalizeEmailSubject, buildAttachmentNoticeHtml, insertBeforeEmailFooter } from '@/lib/email/emailComposition';
import { buildUnsubscribeUrl, isUnsubscribed } from '@/lib/email/unsubscribe';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { logEmailSend } from '@/lib/emailLogger';
import { sendWithProviderSdk, type EmailProvider } from '@/lib/email/providerSdk';
import { resolveAllConnectedEmailProviders } from '@/lib/email/providerIntegrationResolver';
import { validateRecipient } from '@/lib/email/validateRecipient';
import sanitizeHtml from 'sanitize-html';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeBonnieOutboundText } from '@/lib/bonnie/bonnieBannedLanguage';
import { persistCanonicalOutboundEmail } from '@/lib/email/persistCanonicalEmail';
import { toUnifiedEmailProvider } from '@/lib/email/unifiedEmailDomain';
import {
  type EmailAttachment,
  normalizeEmailAttachments,
} from '@/lib/email/emailAttachment';

export type { EmailAttachment } from '@/lib/email/emailAttachment';

export type OutboundEmailProvider =
  | 'zoho'
  | 'brevo'
  | 'sendgrid'
  | 'resend'
  | 'outlook'
  | 'gmail';

export interface EmailPayload {
  to: string | string[];
  from_name?: string;
  fromName?: string;
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  userId?: string;
  templateName?: string;
  listUnsubscribeUrl?: string;
  isPlatformNotification?: boolean;
  skipFooter?: boolean;
  /** Skip CRM recipient membership check (inbox replies, document send) */
  skipRecipientGate?: boolean;
  /** Skip Bonnie v2.0 outbound language sanitization (platform/system mail) */
  skipBonnieQualityCheck?: boolean;
  /** Non-sensitive business context retained with the canonical email audit record. */
  auditMetadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  success: boolean;
  emailId?: string;
  canonicalMessageId?: string;
  provider?: string;
  tried: Array<{ provider: string; error?: string }>;
  error?: string;
  errorDetails?: unknown;
  code?: string;
}

function normalizePreferredProvider(value: unknown): OutboundEmailProvider | undefined {
  const provider = String(value || '').trim().toLowerCase();
  if (provider === 'microsoft' || provider === 'microsoft365') return 'outlook';
  if (
    provider === 'zoho' ||
    provider === 'brevo' ||
    provider === 'sendgrid' ||
    provider === 'resend' ||
    provider === 'outlook' ||
    provider === 'gmail'
  ) {
    return provider;
  }
  return undefined;
}

export async function sendEmail(
  tenantId: string,
  payload: EmailPayload,
  preferredProvider?: OutboundEmailProvider
): Promise<SendEmailResult> {
  const emailId = uuidv4();
  const supabase = createSupabaseAdminClient();
  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
  const tried: SendEmailResult['tried'] = [];

  try {
    if (!tenantId || !payload.to || !payload.subject || (!payload.html && !payload.text)) {
      return { success: false, tried, error: 'tenantId, to, subject, and html or text are required', code: 'MISSING_FIELDS' };
    }

    for (const recipient of recipients) {
      if (!payload.isPlatformNotification && !payload.skipRecipientGate) {
        const { allowed, reason } = await validateRecipient(supabase, tenantId, recipient);
        if (!allowed) return { success: false, tried, error: reason, code: 'BLOCKED_RECIPIENT' };
      }
      if (await isUnsubscribed(recipient, tenantId)) {
        console.log(`[email] Skipping send — recipient unsubscribed: ${recipient} (tenant ${tenantId})`);
        return { success: false, tried, error: `Recipient unsubscribed: ${recipient}`, code: 'EMAIL_UNSUBSCRIBED' };
      }
      if (await isEmailSuppressed(tenantId, recipient)) {
        return { success: false, tried, error: `Recipient is suppressed: ${recipient}`, code: 'EMAIL_SUPPRESSED' };
      }
    }

    // Build a per-recipient signed unsubscribe link (single-recipient sends, e.g. campaigns/outreach).
    // Falls back gracefully inside ensureFooter when unavailable.
    const singleRecipient = recipients.length === 1 ? String(recipients[0] || '').trim() : '';
    const unsubscribeUrl = payload.listUnsubscribeUrl
      || (singleRecipient ? buildUnsubscribeUrl(singleRecipient, tenantId) : '');

    const normalizedSubject = normalizeEmailSubject(payload.subject);
    const shouldAppendFooter = !payload.skipFooter;
    const applyBonnieSanitizer = !payload.isPlatformNotification && !payload.skipBonnieQualityCheck;
    const sanitizedHtmlSource = applyBonnieSanitizer && payload.html
      ? sanitizeBonnieOutboundText(String(payload.html)).clean
      : payload.html;
    const sanitizedTextSource = applyBonnieSanitizer && payload.text
      ? sanitizeBonnieOutboundText(String(payload.text)).clean
      : payload.text;

    const attachmentNames = (payload.attachments || [])
      .map((a) => String(a.filename || '').trim())
      .filter(Boolean);

    const rawHtml = String(sanitizedHtmlSource || '');
    const isHtml = /<[a-z][\s\S]*>/i.test(rawHtml);
    const htmlToSanitize = isHtml ? rawHtml : rawHtml.replace(/\r?\n/g, '<br />');

    let normalizedHtml = sanitizedHtmlSource
      ? (shouldAppendFooter
        ? ensureFooter(sanitizeHtml(htmlToSanitize, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'br', 'p', 'div', 'span']),
          allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['style', 'class'] },
        }), { unsubscribeUrl })
        : sanitizeHtml(htmlToSanitize, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'br', 'p', 'div', 'span']),
          allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['style', 'class'] },
        }))
      : undefined;

    if (normalizedHtml && attachmentNames.length > 0) {
      normalizedHtml = insertBeforeEmailFooter(
        normalizedHtml,
        buildAttachmentNoticeHtml(attachmentNames)
      );
    }

    let normalizedText = sanitizedTextSource
      ? (shouldAppendFooter ? ensureFooter(sanitizedTextSource, { unsubscribeUrl }) : sanitizedTextSource)
      : undefined;

    if (normalizedText && attachmentNames.length > 0) {
      const attachmentLines = ['Attachments:', ...attachmentNames.map((name) => `- ${name}`)].join('\n');
      normalizedText = insertBeforeEmailFooter(normalizedText, attachmentLines);
    }

    const configs = await resolveAllConnectedEmailProviders({
      tenantId,
      preferredUserId: payload.userId || null,
      preferredProvider: normalizePreferredProvider(preferredProvider),
      fallbackToEnv: true,
      forcePlatform: Boolean(payload.isPlatformNotification),
    });

    if (!configs.length) {
      return { success: false, tried, error: 'No connected email provider is configured for this tenant', code: 'CONFIG_MISSING' };
    }

    for (const config of configs) {
      const fromEmail = config.fromEmail || process.env.EMAIL_FROM || process.env.SENDGRID_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'notifications@alphaclonesystems.com';
      const providerResult = await sendWithProviderSdk(config.provider as EmailProvider, {
        apiKey: config.apiKey,
        fromEmail,
        fromName: payload.from_name || payload.fromName || config.fromName || 'AlphaClone Systems',
        to: payload.to,
        subject: normalizedSubject,
        html: normalizedHtml,
        text: normalizedText,
        replyTo: payload.reply_to || payload.replyTo,
        listUnsubscribeUrl: unsubscribeUrl || payload.listUnsubscribeUrl,
        attachments: normalizeEmailAttachments(payload.attachments),
        userId: config.ownerUserId || payload.userId,
        tenantId,
      });

      if (providerResult.ok) {
        const providerMessageId = providerResult.emailId || emailId;
        let canonicalMessageId: string;
        try {
          canonicalMessageId = await persistCanonicalOutboundEmail({
            supabase,
            tenantId,
            userId: config.ownerUserId || payload.userId || null,
            provider: toUnifiedEmailProvider(config.provider),
            providerMessageId,
            fromEmail,
            recipients,
            replyTo: payload.reply_to || payload.replyTo,
            subject: normalizedSubject,
            html: normalizedHtml,
            text: normalizedText,
            hasAttachments: attachmentNames.length > 0,
            metadata: payload.auditMetadata,
          });
        } catch (persistenceError) {
          const persistenceMessage = persistenceError instanceof Error
            ? persistenceError.message
            : 'Canonical email persistence failed';
          await logEmailSend({
            tenantId,
            userId: config.ownerUserId || payload.userId || null,
            provider: toUnifiedEmailProvider(config.provider),
            toEmail: recipients.join(', '),
            subject: normalizedSubject,
            templateName: payload.templateName,
            status: 'failed',
            error: `Provider accepted the message, but ${persistenceMessage}`,
            emailId: providerMessageId,
            metadata: { ...payload.auditMetadata, providerAccepted: true },
          });
          return {
            success: false,
            emailId: providerMessageId,
            provider: toUnifiedEmailProvider(config.provider),
            tried: [...tried, { provider: config.provider, error: persistenceMessage }],
            error: 'Provider accepted the email, but AlphaClone could not save the canonical communication record.',
            errorDetails: persistenceError,
            code: 'LOCAL_EMAIL_PERSISTENCE_FAILED',
          };
        }
        await logEmailSend({
          tenantId,
          userId: config.ownerUserId || payload.userId || null,
          provider: config.provider,
          toEmail: recipients.join(', '),
          subject: normalizedSubject,
          templateName: payload.templateName,
          status: 'sent',
          emailId: providerMessageId,
          metadata: { ...payload.auditMetadata, canonicalMessageId },
        });
        return {
          success: true,
          emailId: providerMessageId,
          canonicalMessageId,
          provider: config.provider,
          tried: [...tried, { provider: config.provider }],
        };
      }

      tried.push({ provider: config.provider, error: providerResult.error || 'Provider rejected request' });
      await logEmailSend({
        tenantId,
        userId: config.ownerUserId || payload.userId || null,
        provider: config.provider,
        toEmail: recipients.join(', '),
        subject: normalizedSubject,
        templateName: payload.templateName,
        status: 'failed',
        error: providerResult.error,
        metadata: payload.auditMetadata,
      });
    }

    return {
      success: false,
      tried,
      error: `All configured email providers failed: ${tried.map((item) => `${item.provider}: ${item.error}`).join('; ')}`,
      code: 'ALL_PROVIDERS_FAILED',
    };
  } catch (error) {
    return {
      success: false,
      tried,
      error: error instanceof Error ? error.message : 'Internal email send error',
      errorDetails: error,
      code: 'INTERNAL_ERROR',
    };
  }
}
