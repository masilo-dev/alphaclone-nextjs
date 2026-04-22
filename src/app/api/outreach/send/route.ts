import { NextResponse } from 'next/server';
import { gmailServerService } from '@/services/server/gmailServerService';
import { ZohoMailService } from '../../../../services/zoho/ZohoMailService';
import {
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { outreachSendSchema } from '@/schemas/validation';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;
const BASE_URL = SITE_URL && !SITE_URL.includes('localhost') 
  ? SITE_URL 
  : 'https://alphaclone.tech';
type OutreachProvider = 'brevo' | 'resend' | 'sendgrid' | 'zoho' | 'gmail';
const PROVIDER_FAILOVER_ORDER: OutreachProvider[] = ['brevo', 'resend', 'sendgrid', 'zoho', 'gmail'];
const DEFAULT_PROVIDER_LIMITS: Record<OutreachProvider, number> = {
  brevo: 300,
  resend: 300,
  sendgrid: 500,
  zoho: 200,
  gmail: 150,
};

function normalizeProvider(value: unknown): OutreachProvider | null {
  const provider = String(value || '').trim().toLowerCase();
  if (provider === 'brevo' || provider === 'resend' || provider === 'sendgrid' || provider === 'zoho' || provider === 'gmail') {
    return provider;
  }
  return null;
}

function encodeGmailRawMessage(params: {
  to: string;
  subject: string;
  html: string;
  fromEmail: string;
  fromName: string;
}) {
  const utf8Subject = `=?utf-8?B?${Buffer.from(params.subject).toString('base64')}?=`;
  const message = [
    `From: ${params.fromName} <${params.fromEmail}>`,
    `To: ${params.to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    params.html,
  ].join('\n');

  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
    } = parsed.data;

    const tenantCtx = await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();
    if (await isEmailSuppressed(tenantId, leadEmail)) {
      return NextResponse.json({ success: false, status: 'suppressed', error: 'Recipient is suppressed' }, { status: 409 });
    }
    const autoSendThreshold = Number(process.env.OUTREACH_AUTO_SEND_CONFIDENCE_THRESHOLD || '80');

    // Default policy: manual approval required unless explicitly auto-send.
    // Auto-send is allowed only if consent is present and confidence passes threshold.
    const shouldAutoSend = autoSend === true;
    const policyQueueOnly =
      !shouldAutoSend ||
      consentGranted !== true ||
      Number(confidenceScore || 0) < autoSendThreshold;

    // 1. Generate tracking ID
    const trackingId = crypto.randomUUID();

    // 2. Inject tracking pixel
    const htmlBody = injectTrackingPixel(emailBody, trackingId);

    // 3. Pre-insert log row as 'queued'
    const { data: logRow, error: logErr } = await admin
      .from('lead_outreach_log')
      .insert({
        tenant_id:    tenantId,
        lead_name:    leadName,
        lead_email:   leadEmail,
        subject,
        body_html:    htmlBody,
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
      .select('type, config, enabled')
      .eq('tenant_id', tenantId)
      .eq('user_id', tenantCtx.user.id)
      .eq('enabled', true)
      .in('type', ['brevo', 'resend', 'sendgrid', 'zoho', 'gmail']);
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

    const providerConfigs = (integrations || [])
      .map((integration: any) => {
        const provider = normalizeProvider(integration.type);
        if (!provider) return null;
        const cfg = integration.config || {};
        return {
          provider,
          apiKey: String(cfg.apiKey || cfg.api_key || '').trim(),
          fromEmail: String(cfg.fromEmail || cfg.from_email || fromAddress || profileFromEmail || '').trim(),
          fromName: String(cfg.fromName || cfg.from_name || profileFromName || 'AlphaClone Systems').trim(),
          dailyLimit: Number(cfg.dailyLimit || cfg.daily_limit || DEFAULT_PROVIDER_LIMITS[provider]) || DEFAULT_PROVIDER_LIMITS[provider],
        };
      })
      .filter(Boolean) as Array<{ provider: OutreachProvider; apiKey: string; fromEmail: string; fromName: string; dailyLimit: number }>;

    const activeProviders = providerConfigs.filter((p) =>
      selectedProviders.length > 0 ? selectedProviders.includes(p.provider) : true
    );
    if (activeProviders.length === 0) {
      return NextResponse.json(
        { success: false, status: 'failed', error: 'No active email provider available. Connect Brevo, Resend, SendGrid, Zoho, or Gmail.' },
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
        if (selectedProvider.provider === 'zoho') {
          const zohoService = new ZohoMailService(tenantCtx.user.id);
          const sendResult = await zohoService.sendEmail({
            toAddress: leadEmail,
            fromAddress: selectedProvider.fromEmail || fromAddress,
            subject,
            content: htmlBody,
          });
          providerMessageId = sendResult?.data?.messageId || null;
        } else if (selectedProvider.provider === 'gmail') {
          const raw = encodeGmailRawMessage({
            to: leadEmail,
            subject,
            html: htmlBody,
            fromEmail: selectedProvider.fromEmail || fromAddress || tenantCtx.user.email || 'noreply@alphaclone.tech',
            fromName: selectedProvider.fromName || 'AlphaClone Systems',
          });
          const sendResult = await gmailServerService.proxyRequest(tenantCtx.user.id, 'messages/send', {
            method: 'POST',
            body: JSON.stringify({ raw }),
          });
          providerMessageId = sendResult?.id || null;
        } else if (selectedProvider.provider === 'brevo') {
          const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': selectedProvider.apiKey,
            },
            body: JSON.stringify({
              sender: { email: selectedProvider.fromEmail || fromAddress, name: selectedProvider.fromName || 'AlphaClone Systems' },
              to: [{ email: leadEmail }],
              subject,
              htmlContent: htmlBody,
            }),
          });
          if (!response.ok) throw new Error(`Brevo send failed (${response.status})`);
        } else if (selectedProvider.provider === 'resend') {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${selectedProvider.apiKey}`,
            },
            body: JSON.stringify({
              from: `${selectedProvider.fromName || 'AlphaClone Systems'} <${selectedProvider.fromEmail || fromAddress}>`,
              to: leadEmail,
              subject,
              html: htmlBody,
            }),
          });
          if (!response.ok) throw new Error(`Resend send failed (${response.status})`);
        } else if (selectedProvider.provider === 'sendgrid') {
          const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${selectedProvider.apiKey}`,
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: leadEmail }] }],
              from: {
                email: selectedProvider.fromEmail || fromAddress,
                name: selectedProvider.fromName || 'AlphaClone Systems',
              },
              subject,
              content: [{ type: 'text/html', value: htmlBody }],
            }),
          });
          if (!response.ok) throw new Error(`SendGrid send failed (${response.status})`);
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
      if (logId) {
        await admin
          .from('lead_outreach_log')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider: sentProvider,
            zoho_message_id: providerMessageId,
            error_message: providerFailures.length > 0
              ? `Failover recovered. Previous providers failed: ${providerFailures.map((f) => `${f.provider}: ${f.error}`).join(' | ')}`
              : null,
          })
          .eq('id', logId);
      }

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
        subject,
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
        },
      });

      return NextResponse.json({
        success:    true,
        status:     'sent',
        logId,
        trackingId,
        provider: sentProvider,
        failoverAttempts: providerFailures,
        messageId: providerMessageId,
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

    return NextResponse.json(
      {
        success: false,
        status: 'failed',
        error: 'Email could not be sent. All configured providers failed in fallback order.',
        code: 'OUTREACH_SEND_FAILED',
        logId,
        trackingId,
        failoverAttempts: providerFailures,
      },
      { status: 502 }
    );

  } catch (error: unknown) {
    return routeErrorResponse(error, 'Failed to send outreach email.', request);
  }
}
