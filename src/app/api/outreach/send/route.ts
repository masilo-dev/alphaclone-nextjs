import { NextResponse } from 'next/server';
import { microsoftServerService } from '@/services/server/microsoftServerService';
import { ZohoMailService } from '../../../../services/zoho/ZohoMailService';
import {
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { outreachSendSchema } from '@/schemas/validation';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';
import { normalizeEmailSubject } from '@/lib/email/emailComposition';
import { buildUnsubscribeUrl, isUnsubscribed } from '@/lib/email/unsubscribe';
import { buildEmail } from '@/lib/email/template';
import { sendEmail } from '@/lib/email/sendEmail';
import sanitizeHtml from 'sanitize-html';
import { validateRecipient } from '@/lib/email/validateRecipient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;
const BASE_URL = SITE_URL && !SITE_URL.includes('localhost') 
  ? SITE_URL 
  : 'https://alphaclonesystems.com';
type OutreachProvider = 'microsoft' | 'brevo' | 'resend' | 'sendgrid' | 'zoho';
type ProviderConfig = {
  provider: OutreachProvider;
  apiKey: string;
  fromEmail: string;
  fromName: string;
  dailyLimit: number;
};
const PROVIDER_FAILOVER_ORDER: OutreachProvider[] = ['microsoft', 'brevo', 'resend', 'sendgrid', 'zoho'];
const DEFAULT_PROVIDER_LIMITS: Record<OutreachProvider, number> = {
  microsoft: 300,
  brevo: 300,
  resend: 300,
  sendgrid: 500,
  zoho: 200,
};

function normalizeProvider(value: unknown): OutreachProvider | null {
  const provider = String(value || '').trim().toLowerCase();
  if (provider === 'microsoft' || provider === 'brevo' || provider === 'resend' || provider === 'sendgrid' || provider === 'zoho') {
    return provider;
  }
  return null;
}

function isProviderConfig(value: ProviderConfig | null): value is ProviderConfig {
  return value !== null;
}

function resolveSenderEmail(config: Record<string, unknown>, fallbacks: string[]): string {
  const candidates = [
    config.fromEmail,
    config.from_email,
    config.senderEmail,
    config.sender_email,
    config.sender,
    config.email,
    config.defaultFrom,
    config.default_from,
    config.fromAddress,
    config.from_address,
    ...fallbacks,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value.includes('@')) return value;
  }
  return '';
}

function resolveSenderName(config: Record<string, unknown>, fallbacks: string[]): string {
  const candidates = [
    config.fromName,
    config.from_name,
    config.senderName,
    config.sender_name,
    config.name,
    ...fallbacks,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value.length > 0) return value;
  }
  return 'AlphaClone Systems';
}

function classifyProviderFailure(failureMessage: string): 'auth' | 'rate_limit' | 'network_or_unknown' {
  const msg = failureMessage.toLowerCase();
  if (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('unauthorized') ||
    msg.includes('invalid api key') ||
    msg.includes('api key') ||
    msg.includes('forbidden') ||
    msg.includes('key not found')
  ) {
    return 'auth';
  }
  if (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('quota')
  ) {
    return 'rate_limit';
  }
  return 'network_or_unknown';
}

/**
 * Inject open-tracking pixel into email body HTML.
 * Works with both plain-text and HTML bodies.
 */
function injectTrackingPixel(body: string, trackingId: string): string {
  const pixelUrl = `${BASE_URL}/api/track/open?id=${trackingId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`;

  if (body.includes('</body>')) {
    return body.replace('</body>', `${pixel}</body>`);
  }
  // Plain text body — wrap in minimal HTML
  const escaped = body.replace(/\n/g, '<br>');
  return `<html><body><p>${escaped}</p>${pixel}</body></html>`;
}

/**
 * POST /api/outreach/send
 *
 * Body:
 * {
 *   tenantId:     string,
 *   leadEmail:    string,
 *   leadName:     string,
 *   subject:      string,
 *   body:         string,
 *   pitchAngle:   string,
 *   industry:     string,
 *   score:        number,
 *   fromAddress?: string,
 *   queue?:       boolean   // if true: log as 'queued' but don't send
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = outreachSendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const {
      tenantId,
      leadEmail,
      leadName,
      subject,
      body: emailBody,
      pitchAngle  = 'growth-opportunity',
      industry    = '',
      score       = 0,
      fromAddress,
      queue       = false,
      autoSend = false,
      consentGranted = false,
      confidenceScore = 0,
      deliveryProviders = [],
      preferredProvider,
      balanceByDailyLimit = false,
      language,
      languageMode,
    } = parsed.data;
    const normalizedSubject = normalizeEmailSubject(subject);
    if (!normalizedSubject) {
      return NextResponse.json({ error: 'Subject is required.' }, { status: 400 });
    }

    const tenantCtx = await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    // 0. Recipient Validation
    const { allowed, reason } = await validateRecipient(admin, tenantId, leadEmail);
    if (!allowed) {
      await admin.from('email_audit_log').insert({
        tenant_id: tenantId,
        user_id: tenantCtx.user.id,
        to_email: leadEmail,
        subject: normalizedSubject,
        allowed: false,
        blocked_reason: reason,
      });
      return NextResponse.json({ error: reason }, { status: 403 });
    }

    // 0.1 HTML Sanitization
    const sanitizedBody = sanitizeHtml(emailBody, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'style', 'br', 'p', 'div', 'span']),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        '*': ['style', 'class'],
      }
    });
    const unsubscribeUrl = buildUnsubscribeUrl(leadEmail, tenantId);

    const { data: tenantRow } = await admin.from('tenants').select('name').eq('id', tenantId).maybeSingle();
    const tenantName = tenantRow?.name || 'Your workspace';

    const htmlWithTemplate = buildEmail({
      subject: normalizedSubject,
      bodyHtml: sanitizedBody,
      tenantName,
      tenantId,
      recipientEmail: leadEmail,
    });

    if (await isUnsubscribed(leadEmail, tenantId)) {
      console.log(`[outreach/send] Skipping — recipient unsubscribed: ${leadEmail} (tenant ${tenantId})`);
      return NextResponse.json({ success: false, status: 'unsubscribed', error: 'Recipient has unsubscribed' }, { status: 409 });
    }
    if (await isEmailSuppressed(tenantId, leadEmail)) {
      return NextResponse.json({ success: false, status: 'suppressed', error: 'Recipient is suppressed' }, { status: 409 });
    }
    const autoSendThreshold = Number(process.env.OUTREACH_AUTO_SEND_CONFIDENCE_THRESHOLD || '80');

    // Default policy: manual approval required unless explicitly auto-send.
    // Auto-send is allowed only if consent is present and confidence passes threshold.
    const shouldAutoSend = autoSend === true;
    if (consentGranted !== true) {
      return NextResponse.json({ error: 'Marketing consent is required to send outreach emails.' }, { status: 400 });
    }
    const policyQueueOnly =
      !shouldAutoSend ||
      Number(confidenceScore || 0) < autoSendThreshold;

    // 1. Generate tracking ID
    const trackingId = crypto.randomUUID();

    // 2. Inject tracking pixel (footer already applied above via ensureFooter)
    const htmlBody = injectTrackingPixel(htmlWithTemplate, trackingId);
    const htmlWithComplianceFooter = htmlBody;

    // 3. Pre-insert log row as 'queued'
    const { data: logRow, error: logErr } = await admin
      .from('lead_outreach_log')
      .insert({
        tenant_id:    tenantId,
        user_id:      tenantCtx.user.id,
        lead_name:    leadName,
        lead_email:   leadEmail,
        subject: normalizedSubject,
        body_html:    htmlWithComplianceFooter,
        tracking_id:  trackingId,
        pitch_angle:  pitchAngle,
        industry,
        score,
        status:       'queued',
      })
      .select('id')
      .single();

    if (logErr) {
      console.warn('[Outreach/Send] Log insert failed (non-fatal):', logErr);
    }

    const logId = logRow?.id;

    // 4. If queue-only mode → return now
    if (queue || policyQueueOnly) {
      const queueReason = !shouldAutoSend
        ? 'manual_approval_required'
        : consentGranted !== true
          ? 'consent_required'
          : 'confidence_below_threshold';
      return NextResponse.json({
        success: true,
        status: 'queued',
        queueReason,
        policy: {
          autoSendEnabled: shouldAutoSend,
          consentGranted: consentGranted === true,
          confidenceScore: Number(confidenceScore || 0),
          threshold: autoSendThreshold,
        },
        logId,
        trackingId,
      });
    }

    const selectedProviders = Array.isArray(deliveryProviders)
      ? deliveryProviders
          .map((p: unknown) => normalizeProvider(p))
          .filter((p: OutreachProvider | null): p is OutreachProvider => p !== null)
      : [];
    const preferred = normalizeProvider(preferredProvider);

    const { data: integrations, error: integrationsError } = await admin
      .from('integrations')
      .select('type, config, enabled, user_id, updated_at')
      .eq('tenant_id', tenantId)
      .eq('user_id', tenantCtx.user.id)
      .eq('enabled', true)
      .in('type', ['brevo', 'resend', 'sendgrid', 'zoho']);
    if (integrationsError) {
      return NextResponse.json({ success: false, status: 'failed', error: integrationsError.message }, { status: 500 });
    }

    const { data: profileIntegration } = await admin
      .from('integrations')
      .select('config')
      .eq('tenant_id', tenantId)
      .eq('user_id', tenantCtx.user.id)
      .eq('enabled', true)
      .eq('type', 'email_profile')
      .maybeSingle();
    const profileConfig = (profileIntegration?.config || {}) as Record<string, unknown>;
    const profileFromName = String(profileConfig.fromName || profileConfig.from_name || '').trim();
    const profileFromEmail = String(profileConfig.fromEmail || profileConfig.from_email || '').trim();

    const integrationRows = Array.isArray(integrations) ? integrations : [];

    const providerConfigs = integrationRows
      .map((integration: any) => {
        const provider = normalizeProvider(integration.type);
        if (!provider) return null;
        const cfg = (integration.config || {}) as Record<string, unknown>;
        return {
          provider,
          apiKey: String(cfg.apiKey || cfg.api_key || '').trim(),
          fromEmail: resolveSenderEmail(cfg, [fromAddress || '', profileFromEmail, tenantCtx.user.email || '']),
          fromName: resolveSenderName(cfg, [profileFromName, tenantCtx.user.user_metadata?.full_name as string || '']),
          dailyLimit: Number(cfg.dailyLimit || cfg.daily_limit || DEFAULT_PROVIDER_LIMITS[provider]) || DEFAULT_PROVIDER_LIMITS[provider],
        };
      })
      .filter(isProviderConfig)
      .reduce((acc, row) => {
        const existing = acc.find((item) => item.provider === row.provider);
        if (!existing) acc.push(row);
        return acc;
      }, [] as ProviderConfig[]);

    const microsoftConnection = await microsoftServerService.getConnection(tenantCtx.user.id).catch(() => null);
    if (microsoftConnection) {
      providerConfigs.unshift({
        provider: 'microsoft',
        apiKey: '',
        fromEmail:
          String(fromAddress || '').trim() ||
          microsoftConnection.microsoft_email ||
          tenantCtx.user.email ||
          '',
        fromName:
          microsoftConnection.display_name ||
          profileFromName ||
          String(tenantCtx.user.user_metadata?.full_name || '').trim() ||
          'AlphaClone Systems',
        dailyLimit: DEFAULT_PROVIDER_LIMITS.microsoft,
      });
    }

    const activeProviders = providerConfigs.filter((p) =>
      selectedProviders.length > 0 ? selectedProviders.includes(p.provider) : true
    );
    if (activeProviders.length === 0) {
      return NextResponse.json(
        {
          success: false,
          status: 'failed',
          code: 'PROVIDER_NOT_CONFIGURED_FOR_USER',
          error: 'No active email provider is connected for your account. Connect Microsoft 365, Brevo, Resend, SendGrid, or Zoho in Settings.',
        },
        { status: 400 }
      );
    }

    const available = activeProviders;
    if (!available.length) {
      return NextResponse.json(
        { success: false, status: 'failed', error: 'Daily limits reached across selected providers' },
        { status: 429 }
      );
    }

    const providerCounts = new Map<OutreachProvider, number>();
    for (const provider of PROVIDER_FAILOVER_ORDER) {
      providerCounts.set(provider, 0);
    }

    const shouldUseLimitBalancing = balanceByDailyLimit !== false;
    if (shouldUseLimitBalancing) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data: usageRows, error: usageError } = await admin
        .from('lead_outreach_log')
        .select('provider')
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfDay.toISOString())
        .in('status', ['sent', 'delivered', 'opened', 'clicked']);
      if (!usageError) {
        for (const row of usageRows || []) {
          const p = normalizeProvider((row as { provider?: unknown }).provider);
          if (!p) continue;
          providerCounts.set(p, (providerCounts.get(p) || 0) + 1);
        }
      }
    }

    const failoverSequence = (() => {
      const allowed = new Set(available.map((p) => p.provider));
      let ordered = PROVIDER_FAILOVER_ORDER.filter((provider) => allowed.has(provider));
      if (balanceByDailyLimit === true && preferred && ordered.includes(preferred)) {
        ordered = [preferred, ...ordered.filter((provider) => provider !== preferred)];
      }
      return ordered;
    })();

    const providerQueue = failoverSequence
      .map((providerId) => available.find((provider) => provider.provider === providerId))
      .filter((provider): provider is { provider: OutreachProvider; apiKey: string; fromEmail: string; fromName: string; dailyLimit: number } => Boolean(provider))
      .filter((provider) => {
        if (!shouldUseLimitBalancing) return true;
        return (providerCounts.get(provider.provider) || 0) < provider.dailyLimit;
      });

    const invalidProviderConfigs = providerQueue
      .filter((provider) => {
        if (provider.provider === 'microsoft' || provider.provider === 'zoho') {
          return !provider.fromEmail;
        }
        return !provider.apiKey || !provider.fromEmail;
      })
      .map((provider) => ({
        provider: provider.provider,
        missing: {
          apiKey:
            provider.provider === 'microsoft' || provider.provider === 'zoho'
              ? false
              : !provider.apiKey,
          fromEmail: !provider.fromEmail,
        },
      }));

    if (invalidProviderConfigs.length > 0 && invalidProviderConfigs.length === providerQueue.length) {
      return NextResponse.json(
        {
          success: false,
          status: 'failed',
          error: 'Email provider configuration is incomplete. Update API key and sender email in Integrations.',
          code: 'OUTREACH_PROVIDER_CONFIG_INVALID',
          invalidProviders: invalidProviderConfigs,
        },
        { status: 400 }
      );
    }

    if (!providerQueue.length) {
      return NextResponse.json({ success: false, status: 'failed', error: 'No provider selected' }, { status: 500 });
    }

    const providerFailures: Array<{ provider: OutreachProvider; error: string }> = [];
    let sentProvider: OutreachProvider | null = null;
    let providerMessageId: string | null = null;
    let sentFromEmail = '';
    let sentFromName = '';

    for (const selectedProvider of providerQueue) {
      try {
        if (selectedProvider.provider === 'microsoft') {
          await microsoftServerService.sendEmail(tenantCtx.user.id, {
            to: [leadEmail],
            subject: normalizedSubject,
            html: htmlWithComplianceFooter,
          });
          providerMessageId = null;
        } else if (selectedProvider.provider === 'zoho') {
          const zohoService = new ZohoMailService(tenantCtx.user.id);
          const sendResult = await zohoService.sendEmail({
            toAddress: leadEmail,
            fromAddress: selectedProvider.fromEmail || fromAddress,
            subject: normalizedSubject,
            content: htmlWithComplianceFooter,
          });
          providerMessageId = sendResult?.data?.messageId || null;
        } else if (
          selectedProvider.provider === 'brevo' ||
          selectedProvider.provider === 'resend' ||
          selectedProvider.provider === 'sendgrid'
        ) {
          const result = await sendEmail(
            tenantId,
            {
              to: leadEmail,
              subject: normalizedSubject,
              html: htmlWithComplianceFooter,
              from_name: selectedProvider.fromName,
              userId: tenantCtx.user.id,
              listUnsubscribeUrl: unsubscribeUrl,
              skipFooter: true,
            },
            selectedProvider.provider
          );
          if (!result.success) {
            throw new Error(result.error || `Failed to send via ${selectedProvider.provider}`);
          }
          providerMessageId = result.emailId || null;
        }

        sentProvider = selectedProvider.provider;
        sentFromEmail = selectedProvider.fromEmail || fromAddress || '';
        sentFromName = selectedProvider.fromName || 'AlphaClone Systems';
        break;
      } catch (err) {
        providerFailures.push({
          provider: selectedProvider.provider,
          error: err instanceof Error ? err.message : 'Provider send failed',
        });
      }
    }

    if (sentProvider) {
      const postSendWarnings: string[] = [];
      if (logId) {
        const { error: logUpdateError } = await admin
          .from('lead_outreach_log')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider: sentProvider,
            zoho_message_id: providerMessageId,
            provider_message_id: providerMessageId,
            provider_event_status: 'sent',
            provider_last_event_at: new Date().toISOString(),
            error_message: providerFailures.length > 0
              ? `Failover recovered. Previous providers failed: ${providerFailures.map((f) => `${f.provider}: ${f.error}`).join(' | ')}`
              : null,
          })
          .eq('id', logId);
        if (logUpdateError) {
          console.error('[Outreach/Send] Failed to update outreach log after provider send:', logUpdateError);
          postSendWarnings.push('outreach_log_update_failed');
        }
      }

      try {
        await captureUnifiedMessageFromWebhook({
          supabase: admin as any,
          tenantId,
          source: sentProvider as any,
          channel: 'email',
          direction: 'outbound',
          externalId: providerMessageId || trackingId || null,
          threadId: String(logId || trackingId || '') || null,
          from: sentFromEmail,
          to: leadEmail,
          subject: normalizedSubject,
          text: null,
          html: htmlBody,
          sentAt: new Date().toISOString(),
          metadata: {
            outreach: true,
            pitchAngle,
            score,
            trackingId,
            logId,
            provider: sentProvider,
            fromName: sentFromName,
            language,
            languageMode,
          },
        });
      } catch (captureError) {
        console.error('[Outreach/Send] Failed to capture outbound message after provider send:', captureError);
        postSendWarnings.push('message_capture_failed');
      }

      return NextResponse.json({
        success:    true,
        status:     'sent',
        logId,
        trackingId,
        provider: sentProvider,
        failoverAttempts: providerFailures,
        messageId: providerMessageId,
        warnings: postSendWarnings,
      });
    }

    if (logId) {
      await admin
        .from('lead_outreach_log')
        .update({
          status: 'failed',
          error_message: providerFailures.map((f) => `${f.provider}: ${f.error}`).join(' | ') || 'Send failed',
        })
        .eq('id', logId);
    }

    const classifiedFailures = providerFailures.map((entry) => ({
      ...entry,
      category: classifyProviderFailure(entry.error),
    }));
    const authFailures = classifiedFailures.filter((f) => f.category === 'auth');
    const rateLimitFailures = classifiedFailures.filter((f) => f.category === 'rate_limit');

    if (authFailures.length === classifiedFailures.length && classifiedFailures.length > 0) {
      return NextResponse.json(
        {
          success: false,
          status: 'failed',
          code: 'OUTREACH_PROVIDER_AUTH_FAILED',
          error: 'Provider authentication failed. Reconnect the provider API key for your user account and verify sender email.',
          guidance:
            'Open Settings > Integrations, reconnect Resend/SendGrid/Brevo/Zoho/Gmail with your own user credentials, then retry.',
          logId,
          trackingId,
          failoverAttempts: classifiedFailures,
        },
        { status: 400 }
      );
    }

    if (rateLimitFailures.length === classifiedFailures.length && classifiedFailures.length > 0) {
      return NextResponse.json(
        {
          success: false,
          status: 'failed',
          code: 'OUTREACH_PROVIDER_RATE_LIMITED',
          error: 'All selected providers are currently rate-limited. Retry shortly or enable additional provider failover.',
          logId,
          trackingId,
          failoverAttempts: classifiedFailures,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        status: 'failed',
        error: 'Email could not be sent. All configured providers failed in fallback order.',
        code: 'OUTREACH_SEND_FAILED',
        guidance:
          'Check provider API keys, sender verification, and provider account status in Integrations before retrying.',
        logId,
        trackingId,
        failoverAttempts: classifiedFailures,
      },
      { status: 502 }
    );

  } catch (error: unknown) {
    return routeErrorResponse(error, 'Failed to send outreach email.', request);
  }
}
