import { NextResponse } from 'next/server';
import { gmailServerService } from '@/services/server/gmailServerService';
import { ZohoMailService } from '../../../../services/zoho/ZohoMailService';
import {
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;
const BASE_URL = SITE_URL && !SITE_URL.includes('localhost') 
  ? SITE_URL 
  : 'https://alphaclone.tech';
type OutreachProvider = 'brevo' | 'resend' | 'sendgrid' | 'zoho' | 'gmail';
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
      deliveryProviders = [],
      preferredProvider,
      balanceByDailyLimit = true,
    } = body;

    if (!tenantId)   return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    if (!leadEmail)  return NextResponse.json({ error: 'leadEmail required' }, { status: 400 });
    if (!subject)    return NextResponse.json({ error: 'subject required'   }, { status: 400 });
    if (!emailBody)  return NextResponse.json({ error: 'body required'      }, { status: 400 });

    const tenantCtx = await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

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
    if (queue) {
      return NextResponse.json({ success: true, status: 'queued', logId, trackingId });
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
      .eq('user_id', tenantCtx.user.id)
      .eq('enabled', true)
      .in('type', ['brevo', 'resend', 'sendgrid', 'zoho', 'gmail']);
    if (integrationsError) {
      return NextResponse.json({ success: false, status: 'failed', error: integrationsError.message }, { status: 500 });
    }

    const providerConfigs = (integrations || [])
      .map((integration: any) => {
        const provider = normalizeProvider(integration.type);
        if (!provider) return null;
        const cfg = integration.config || {};
        return {
          provider,
          apiKey: String(cfg.apiKey || cfg.api_key || '').trim(),
          fromEmail: String(cfg.fromEmail || cfg.from_email || fromAddress || '').trim(),
          fromName: String(cfg.fromName || cfg.from_name || 'AlphaClone Systems').trim(),
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

    const chosenProvider = (() => {
      if (preferred) {
        const preferredProviderConfig = available.find((p) => p.provider === preferred);
        if (preferredProviderConfig) return preferredProviderConfig;
      }
      if (!balanceByDailyLimit) return available[0];
      return [...available].sort((a, b) => b.dailyLimit - a.dailyLimit)[0];
    })();
    if (!chosenProvider) {
      return NextResponse.json({ success: false, status: 'failed', error: 'No provider selected' }, { status: 500 });
    }

    try {
      let providerMessageId: string | null = null;
      if (chosenProvider.provider === 'zoho') {
        const zohoService = new ZohoMailService(tenantCtx.user.id);
        const sendResult = await zohoService.sendEmail({
          toAddress: leadEmail,
          fromAddress: chosenProvider.fromEmail || fromAddress,
          subject,
          content: htmlBody,
        });
        providerMessageId = sendResult?.data?.messageId || null;
      } else if (chosenProvider.provider === 'gmail') {
        const raw = encodeGmailRawMessage({
          to: leadEmail,
          subject,
          html: htmlBody,
          fromEmail: chosenProvider.fromEmail || fromAddress || tenantCtx.user.email || 'noreply@alphaclone.tech',
          fromName: chosenProvider.fromName || 'AlphaClone Systems',
        });
        const sendResult = await gmailServerService.proxyRequest(tenantCtx.user.id, 'messages/send', {
          method: 'POST',
          body: JSON.stringify({ raw }),
        });
        providerMessageId = sendResult?.id || null;
      } else if (chosenProvider.provider === 'brevo') {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': chosenProvider.apiKey,
          },
          body: JSON.stringify({
            sender: { email: chosenProvider.fromEmail || fromAddress, name: chosenProvider.fromName || 'AlphaClone Systems' },
            to: [{ email: leadEmail }],
            subject,
            htmlContent: htmlBody,
          }),
        });
        if (!response.ok) throw new Error(`Brevo send failed (${response.status})`);
      } else if (chosenProvider.provider === 'resend') {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${chosenProvider.apiKey}`,
          },
          body: JSON.stringify({
            from: `${chosenProvider.fromName || 'AlphaClone Systems'} <${chosenProvider.fromEmail || fromAddress}>`,
            to: leadEmail,
            subject,
            html: htmlBody,
          }),
        });
        if (!response.ok) throw new Error(`Resend send failed (${response.status})`);
      } else if (chosenProvider.provider === 'sendgrid') {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${chosenProvider.apiKey}`,
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: leadEmail }] }],
            from: {
              email: chosenProvider.fromEmail || fromAddress,
              name: chosenProvider.fromName || 'AlphaClone Systems',
            },
            subject,
            content: [{ type: 'text/html', value: htmlBody }],
          }),
        });
        if (!response.ok) throw new Error(`SendGrid send failed (${response.status})`);
      }

      // 6a. Update log → sent
      if (logId) {
        await admin
          .from('lead_outreach_log')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            zoho_message_id: providerMessageId,
          })
          .eq('id', logId);
      }

      return NextResponse.json({
        success:    true,
        status:     'sent',
        logId,
        trackingId,
        provider: chosenProvider.provider,
        messageId: providerMessageId,
      });

    } catch (sendErr: unknown) {
      console.error('[Outreach/Send] Provider send failed:', sendErr);

      // 6b. Update log → failed
      if (logId) {
        await admin
          .from('lead_outreach_log')
          .update({
            status: 'failed',
            error_message: sendErr instanceof Error ? sendErr.message : 'Send failed',
          })
          .eq('id', logId);
      }

      return NextResponse.json(
        {
          success: false,
          status: 'failed',
          error: 'Email could not be sent. Check your selected provider connection in Settings.',
          code: 'OUTREACH_SEND_FAILED',
          logId,
          trackingId,
        },
        { status: 502 }
      );
    }

  } catch (error: unknown) {
    return routeErrorResponse(error, 'Failed to send outreach email.', request);
  }
}
