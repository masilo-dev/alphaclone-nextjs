import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ensureFooter, normalizeEmailSubject, buildAttachmentNoticeHtml, insertBeforeEmailFooter } from '@/lib/email/emailComposition';
import { buildUnsubscribeUrl, isUnsubscribed } from '@/lib/email/unsubscribe';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { logEmailSend } from '@/lib/emailLogger';
import { sendWithProviderSdk, type EmailProvider } from '@/lib/email/providerSdk';
import { validateRecipient } from '@/lib/email/validateRecipient';
import sanitizeHtml from 'sanitize-html';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeBonnieOutboundText } from '@/lib/bonnie/bonnieBannedLanguage';

export type OutboundEmailProvider = 'zoho' | 'brevo' | 'sendgrid' | 'resend';

export interface EmailAttachment {
  filename: string;
  content: string;
  content_type?: string;
  contentType?: string;
}

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
  provider?: string;
  tried: Array<{ provider: string; error?: string }>;
  error?: string;
  errorDetails?: unknown;
  code?: string;
}

type ProviderConfig = {
  provider: OutboundEmailProvider;
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
  ownerUserId?: string | null;
};

const DEFAULT_PROVIDER_ORDER: OutboundEmailProvider[] = ['zoho', 'brevo', 'sendgrid', 'resend'];

function normalizeProvider(value: unknown): OutboundEmailProvider | null {
  const provider = String(value || '').trim().toLowerCase();
  if (provider === 'zoho' || provider === 'brevo' || provider === 'sendgrid' || provider === 'resend') return provider;
  return null;
}

function readConfigString(config: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = String(config[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function getProviderOrder(settings: Record<string, any>, preferredProvider?: OutboundEmailProvider): OutboundEmailProvider[] {
  const emailSettings = settings.email || settings.email_provider || settings.emailProviders || {};
  const configuredOrder = Array.isArray(emailSettings.provider_order || emailSettings.providerOrder)
    ? (emailSettings.provider_order || emailSettings.providerOrder).map(normalizeProvider).filter(Boolean)
    : [];
  const defaultProvider = normalizeProvider(emailSettings.default_provider || emailSettings.defaultProvider);
  const order = [
    preferredProvider,
    defaultProvider,
    ...configuredOrder,
    ...DEFAULT_PROVIDER_ORDER,
  ].filter(Boolean) as OutboundEmailProvider[];
  return [...new Set(order)];
}

function envProviderConfig(provider: OutboundEmailProvider): ProviderConfig | null {
  if (provider === 'brevo') {
    const apiKey = process.env.BREVO_API_KEY || process.env.BREVO_PLATFORM_API_KEY || process.env.SENDINBLUE_API_KEY || '';
    if (!apiKey) return null;
    return {
      provider,
      apiKey,
      fromEmail: process.env.BREVO_FROM_EMAIL || process.env.EMAIL_FROM || undefined,
      fromName: process.env.BREVO_FROM_NAME || undefined,
    };
  }
  if (provider === 'sendgrid') {
    if (!process.env.SENDGRID_API_KEY) return null;
    return {
      provider,
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || undefined,
      fromName: process.env.SENDGRID_FROM_NAME || undefined,
    };
  }
  if (provider === 'resend') {
    if (!process.env.RESEND_API_KEY) return null;
    return {
      provider,
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || undefined,
      fromName: process.env.RESEND_FROM_NAME || undefined,
    };
  }
  return null;
}

async function resolveProviderConfigs(params: {
  tenantId: string;
  preferredUserId?: string | null;
  preferredProvider?: OutboundEmailProvider;
  fallbackToEnv?: boolean;
  forcePlatform?: boolean;
}): Promise<ProviderConfig[]> {
  const supabase = createSupabaseAdminClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('created_by, settings')
    .eq('id', params.tenantId)
    .maybeSingle();

  const { data: business } = await supabase
    .from('business_settings')
    .select('settings')
    .eq('tenant_id', params.tenantId)
    .maybeSingle();

  const mergedSettings = {
    ...(tenant?.settings || {}),
    ...(business?.settings || {}),
  };

  const emailSettings = mergedSettings.email || mergedSettings.email_provider || mergedSettings.emailProviders || {};
  const defaultProvider = normalizeProvider(emailSettings.default_provider || emailSettings.defaultProvider);

  const order = getProviderOrder(mergedSettings, params.preferredProvider || defaultProvider || undefined);
  let lookupUserId = params.preferredUserId || tenant?.created_by || null;

  if (!lookupUserId) {
    const { data: membership } = await supabase
      .from('tenant_users')
      .select('user_id')
      .eq('tenant_id', params.tenantId)
      .in('role', ['admin', 'tenant_admin'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    lookupUserId = membership?.user_id || null;
  }

  const integrationRows: Array<{ type: string; config: Record<string, unknown>; user_id?: string | null }> = [];
  if (lookupUserId) {
    const { data } = await supabase
      .from('integrations')
      .select('type, config, user_id')
      .eq('user_id', lookupUserId)
      .eq('enabled', true)
      .in('type', order);
    integrationRows.push(...((data || []) as typeof integrationRows));
  }

  const { data: tenantIntegrations } = await supabase
    .from('integrations')
    .select('type, config, user_id')
    .eq('tenant_id', params.tenantId)
    .eq('enabled', true)
    .in('type', order)
    .order('updated_at', { ascending: false });
  integrationRows.push(...((tenantIntegrations || []) as typeof integrationRows));

  const resolved: ProviderConfig[] = [];
  
  const hasConfiguredProvider = !!defaultProvider;
  const hasIntegrations = integrationRows.length > 0;
  const allowEnvFallback = params.forcePlatform || (params.fallbackToEnv !== false && !hasConfiguredProvider && !hasIntegrations);

  for (const provider of order) {
    const row = integrationRows.find((item) => item.type === provider);
    if (row) {
      const config = row.config || {};
      const apiKey = readConfigString(config, ['apiKey', 'api_key', 'key']);
      const requiresKey = provider === 'brevo' || provider === 'sendgrid' || provider === 'resend';
      if (!requiresKey || apiKey) {
        resolved.push({
          provider,
          apiKey,
          fromEmail: readConfigString(config, ['fromEmail', 'from_email', 'email']) || undefined,
          fromName: readConfigString(config, ['fromName', 'from_name']) || undefined,
          ownerUserId: row.user_id || lookupUserId,
        });
      }
    }

    if (allowEnvFallback) {
      const envConfig = envProviderConfig(provider);
      if (envConfig) resolved.push(envConfig);
    }
  }

  return resolved.filter((config, index, all) =>
    all.findIndex((item) => item.provider === config.provider && item.apiKey === config.apiKey && item.ownerUserId === config.ownerUserId) === index
  );
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

    const configs = await resolveProviderConfigs({
      tenantId,
      preferredUserId: payload.userId || null,
      preferredProvider,
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
        attachments: payload.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.content_type || attachment.contentType || 'application/octet-stream',
        })),
        userId: config.ownerUserId || payload.userId,
      });

      if (providerResult.ok) {
        await logEmailSend({
          tenantId,
          userId: config.ownerUserId || payload.userId || null,
          provider: config.provider,
          toEmail: recipients.join(', '),
          subject: normalizedSubject,
          templateName: payload.templateName,
          status: 'sent',
          emailId: providerResult.emailId || emailId,
          metadata: payload.auditMetadata,
        });
        return {
          success: true,
          emailId: providerResult.emailId || emailId,
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
