import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ensureFooter, normalizeEmailSubject } from '@/lib/email/emailComposition';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { logEmailSend } from '@/lib/emailLogger';
import { sendWithProviderSdk, type EmailProvider } from '@/lib/email/providerSdk';
import { validateRecipient } from '@/lib/email/validateRecipient';
import sanitizeHtml from 'sanitize-html';
import { v4 as uuidv4 } from 'uuid';

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

  const order = getProviderOrder((tenant?.settings || {}) as Record<string, any>, params.preferredProvider);
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

    if (params.fallbackToEnv !== false) {
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
      const { allowed, reason } = await validateRecipient(supabase, tenantId, recipient);
      if (!allowed) return { success: false, tried, error: reason, code: 'BLOCKED_RECIPIENT' };
      if (await isEmailSuppressed(tenantId, recipient)) {
        return { success: false, tried, error: `Recipient is suppressed: ${recipient}`, code: 'EMAIL_SUPPRESSED' };
      }
    }

    const normalizedSubject = normalizeEmailSubject(payload.subject);
    const normalizedHtml = payload.html
      ? ensureFooter(sanitizeHtml(String(payload.html), {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'style']),
        allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['style', 'class'] },
      }))
      : undefined;
    const normalizedText = payload.text ? ensureFooter(payload.text) : undefined;

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
        listUnsubscribeUrl: payload.listUnsubscribeUrl,
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
