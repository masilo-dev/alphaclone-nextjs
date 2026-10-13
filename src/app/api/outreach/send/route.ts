import { outreachFingerprint, outreachOperationKey, signOutreachApproval, verifyOutreachApproval } from '@/lib/email/outreachApproval';
import { emailOperationStore, runEmailOperation } from '@/lib/email/emailOperation';
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
import { isUnsubscribed } from '@/lib/email/unsubscribe';
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribeToken';
import { buildEmail } from '@/lib/email/template';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { persistCanonicalOutboundEmail } from '@/lib/email/persistCanonicalEmail';
import { renderOutboundEmail } from '@/lib/email/emailRendering';
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
    msg.includes('key not found') || msg.includes('sender_not_verified') || msg.includes('sender_verification') || msg.includes('authentication expired')
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
async function executeOutreach(request: Request, access: Awaited<ReturnType<typeof requireTenantAccess>>, checkpoint?: (output: Record<string, unknown>) => Promise<void>) {
  let providerWriteStarted = false;
  try {
    const body = await request.json();
    const parsed = outreachSendSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError = Object.entries(fieldErrors)
        .flatMap(([field, messages]) => (messages || []).map((message) => `${field}: ${message}`))[0];
      return NextResponse.json({ error: firstError || 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
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
      skipCrmGate = false,
      directSend = false,
      bulkOutreach = false,
      entityType,
      entityId,
    } = parsed.data;
    const isDirectSend = skipCrmGate || directSend;
    const normalizedSubject = normalizeEmailSubject(subject);
    if (!normalizedSubject) {
      return NextResponse.json({ error: 'Subject is required.' }, { status: 400 });
    }

    const tenantCtx = access;
    const admin = createAdminSupabaseClientOrThrow();

    if (bulkOutreach) {
      const [prior, campaign] = await Promise.all([
        admin.from('lead_outreach_log').select('id').eq('tenant_id', tenantId)
          .ilike('lead_email', leadEmail).in('status', ['sent', 'delivered', 'opened', 'clicked', 'replied']).limit(1),
        admin.from('campaign_recipients').select('id').eq('tenant_id', tenantId)
          .ilike('email', leadEmail).in('status', ['sent', 'delivered', 'opened', 'clicked', 'replied']).limit(1),
      ]);
      if (prior.error || campaign.error) throw prior.error || campaign.error;
      if (prior.data?.length || campaign.data?.length || await isEmailSuppressed(tenantId, leadEmail)) {
        return NextResponse.json({ success: false, error: 'Recipient was already contacted or suppressed.' }, { status: 409 });
      }
    }

    // 0. Recipient Validation (skipped for direct inbox replies)
    if (!isDirectSend) {
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
    }

    // 0.1 HTML Sanitization & Markdown Conversion
    const isHtml = /<[a-z][\s\S]*>/i.test(emailBody);
    const renderedBody = renderOutboundEmail({
      html: isHtml ? emailBody : undefined,
      text: isHtml ? undefined : emailBody,
    });
    const sanitizedBody = renderedBody.html || sanitizeHtml(isHtml ? emailBody : emailBody.replace(/\r?\n/g, '<br />'), {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'br', 'p', 'div', 'span']),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        '*': ['style', 'class'],
      }
    });
    const unsubscribeUrl = buildUnsubscribeUrl(leadEmail, tenantId);

    const { data: tenantRow } = await admin.from('tenants').select('name, settings').eq('id', tenantId).maybeSingle();
    const tenantName = tenantRow?.name || 'Your workspace';

    // Resolve Calendly link from tenant settings for {{client_calendly_link}} injection
    const tenantSettings = (tenantRow?.settings || {}) as Record<string, any>;
    const tenantCalendlyLink: string =
      String(tenantSettings?.calendly?.eventUrl || '').trim() ||
      (tenantSettings?.booking?.slug
        ? `${String(process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(/\/+$/, '')}/book/${tenantSettings.booking.slug}`
        : '');

    const htmlWithTemplate = buildEmail({
      subject: normalizedSubject,
      bodyHtml: sanitizedBody,
      tenantName,
      tenantId,
      recipientEmail: leadEmail,
      clientName: leadName || undefined,
      clientCalendlyLink: tenantCalendlyLink || undefined,
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
    if (!isDirectSend && consentGranted !== true) {
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
        lead_name:    leadName || (leadEmail ? leadEmail.split('@')[0] : 'Contact'),
        lead_email:   leadEmail,
        subject: normalizedSubject,
        body_html:    htmlWithComplianceFooter,
        tracking_id:  trackingId,
        pitch_angle:  pitchAngle,
        industry,
        score,
        status:       'queued',
        lead_id:      entityType === 'lead' && entityId ? entityId : undefined,
        metadata: {
          source_type: 'alphaclone_ui',
          source_agent: 'User',
          initiated_by_user_id: tenantCtx.user.id,
          entity_type: entityType || null,
          entity_id: entityId || null,
        },
      })
      .select('id')
      .single();

    if (logErr) {
      throw logErr; // Never contact a provider without a durable local record.
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

    // Primary: fetch integrations scoped to the calling user
    let { data: integrations, error: integrationsError } = await admin
      .from('integrations')
      .select('type, config, enabled, user_id, updated_at')
      .eq('tenant_id', tenantId)
      .eq('user_id', tenantCtx.user.id)
      .eq('enabled', true)
      .in('type', ['brevo', 'resend', 'sendgrid', 'zoho']);
    if (integrationsError) {
      return NextResponse.json({ success: false, status: 'failed', error: integrationsError.message }, { status: 500 });
    }

    // Fallback: if no user-scoped integrations found, use any tenant-level ones (owner connected on behalf of all)
    if (!integrations || integrations.length === 0) {
      const { data: tenantIntegrations } = await admin
        .from('integrations')
        .select('type, config, enabled, user_id, updated_at')
        .eq('tenant_id', tenantId)
        .eq('enabled', true)
        .in('type', ['brevo', 'resend', 'sendgrid', 'zoho']);
      if (tenantIntegrations && tenantIntegrations.length > 0) {
        integrations = tenantIntegrations;
      }
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

    const integrationRows = Array.isArray(integrations) ? integrations : [];

    const providerConfigs = integrationRows
      .map((integration: any) => {
        const provider = normalizeProvider(integration.type);
        if (!provider) return null;
        const cfg = (integration.config || {}) as Record<string, unknown>;
        return {
          provider,
          apiKey: String(cfg.apiKey || cfg.api_key || '').trim(),
          fromEmail: String(fromAddress || '').trim() || resolveSenderEmail(cfg, []),
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
      if ((preferred === 'microsoft' || selectedProviders.includes('microsoft')) && fromAddress && fromAddress.toLowerCase() !== microsoftConnection.microsoft_email?.toLowerCase()) {
        return NextResponse.json({ success: false, error: 'The requested sender does not match the connected Microsoft account.' }, { status: 409 });
      }
      providerConfigs.unshift({
        provider: 'microsoft',
        apiKey: '',
        fromEmail:
          String(fromAddress || '').trim() ||
          microsoftConnection.microsoft_email ||
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

    // Provider configuration is resolved by its authoritative transport. Zoho OAuth
    // rows contain account/token fields, not a cached fromEmail or an API key.
    // Validate the actual connected sender below before any provider write.
    if (!providerQueue.length) {
      return NextResponse.json({ success: false, status: 'failed', error: 'No provider selected' }, { status: 500 });
    }

    const providerFailures: Array<{ provider: OutreachProvider; error: string }> = [];
    let sentProvider: OutreachProvider | null = null;
    let providerMessageId: string | null = null;
    let sentFromEmail = '';
    let sentFromName = '';

    // Approval covers one selected sending identity. No automatic provider switching.
    const approvedProvider = preferred ? providerQueue.find((p) => p.provider === preferred) : providerQueue[0];
    if (!approvedProvider) return NextResponse.json({ success: false, error: 'The approved provider is unavailable. Review the sender and approve again.' }, { status: 409 });
    // Login/profile addresses do not establish ownership of a provider mailbox.
    const zohoConfig = approvedProvider.provider === 'zoho' ? approvedProvider : undefined;
    if (zohoConfig) {
      const addresses = await new ZohoMailService(tenantCtx.user.id, tenantId).getSenderAddresses();
      const requested = String(fromAddress || '').trim();
      if (requested && !addresses.some((address) => address.toLowerCase() === requested.toLowerCase())) {
        return NextResponse.json({ success: false, status: 'failed', code: 'EMAIL_SENDER_NOT_VERIFIED', error: 'Select a sender available on the connected Zoho account. No email was sent.' }, { status: 422 });
      }
      zohoConfig.fromEmail = requested || addresses.find((address) => address.toLowerCase() === zohoConfig.fromEmail.toLowerCase()) || addresses[0] || '';
      if (!zohoConfig.fromEmail) return NextResponse.json({ success: false, status: 'failed', code: 'EMAIL_SENDER_NOT_VERIFIED', error: 'Zoho did not return a sender for the connected mailbox. Check its sending permissions. No email was sent.' }, { status: 422 });
    }

    for (const selectedProvider of [approvedProvider]) {
      try {
        providerWriteStarted = true;
        if (selectedProvider.provider === 'microsoft') {
          await microsoftServerService.sendEmail(tenantCtx.user.id, {
            to: [leadEmail],
            subject: normalizedSubject,
            html: htmlWithComplianceFooter,
          });
          // Graph 202 proves acceptance but not delivery; no fabricated provider ID.
          providerMessageId = null;
        } else if (selectedProvider.provider === 'zoho') {
          const zohoService = new ZohoMailService(tenantCtx.user.id, tenantId);
          const sendResult = await zohoService.sendEmail({
            toAddress: leadEmail,
            fromAddress: selectedProvider.fromEmail || fromAddress,
            subject: normalizedSubject,
            content: htmlWithComplianceFooter,
          });
          providerMessageId = sendResult?.data?.messageId || sendResult?.messageId || null;
          // A successful Zoho API response proves acceptance even when no native ID is returned.
          // Keep the absent reference explicit, as for Graph 202; never resend to obtain an ID.
          if (!providerMessageId && Number(sendResult?.status?.code) !== 200) throw Object.assign(new Error('Zoho acceptance has no confirmation or message reference'), { code: 'OUTCOME_UNKNOWN' });
        } else if (
          selectedProvider.provider === 'brevo' ||
          selectedProvider.provider === 'resend' ||
          selectedProvider.provider === 'sendgrid'
        ) {
          const result = await sendEmailServer({
            tenantId,
            to: leadEmail,
            subject: normalizedSubject,
            html: htmlWithComplianceFooter,
            preserveContent: true,
            skipRecipientGate: isDirectSend,
            idempotencyKey: request.headers.get('x-outreach-operation-id') || undefined,
            fromName: selectedProvider.fromName,
            userId: tenantCtx.user.id,
            listUnsubscribeUrl: unsubscribeUrl,
            category: 'outreach',
            initiationSource: 'api.outreach.send',
            preferredProvider: selectedProvider.provider,
          });
          if (!result.success) {
            throw Object.assign(new Error(result.error || `Failed to send via ${selectedProvider.provider}`), { code: result.code, deliveryStatus: result.deliveryStatus });
          }
          providerMessageId = result.emailId || null;
        }

        sentProvider = selectedProvider.provider;
        sentFromEmail = selectedProvider.fromEmail || fromAddress || '';
        sentFromName = selectedProvider.fromName || 'AlphaClone Systems';
        break;
      } catch (err) {
        const failure = err as Error & { code?: string; deliveryStatus?: string; status?: number; providerRequestId?: string; providerRejected?: boolean };
        const rejected = failure.deliveryStatus === 'failed' || failure.providerRejected === true || (typeof failure.status === 'number' && failure.status >= 400 && failure.status < 500);
        console.warn('[outreach/send] Provider attempt result', { operationId: request.headers.get('x-outreach-operation-id'), provider: selectedProvider.provider, upstreamStatus: failure.status, upstreamRequestId: failure.providerRequestId, outcome: rejected ? 'rejected' : 'unknown' });
        const kind = classifyProviderFailure(failure.message || '');
        if (failure.code === 'OUTCOME_UNKNOWN' || failure.deliveryStatus === 'unknown' || (!rejected && kind === 'network_or_unknown')) {
          if (logId) await admin.from('lead_outreach_log').update({ status: 'queued', error_message: 'Delivery outcome unknown; reconciliation required before another attempt.' }).eq('tenant_id', tenantId).eq('id', logId);
          return NextResponse.json({ success: false, status: 'unknown', deliveryStatus: 'unknown', code: 'OUTCOME_UNKNOWN', logId, trackingId, provider: selectedProvider.provider, operationId: request.headers.get('x-outreach-operation-id'), error: 'The provider may have accepted this email. Check its send record before trying again; no fallback email was sent.' }, { status: 409 });
        }
        providerFailures.push({
          provider: selectedProvider.provider,
          error: err instanceof Error ? err.message : 'Provider send failed',
        });
      }
    }

    if (sentProvider) {
      // Save acceptance before CRM/message capture work can fail or the process can stop.
      await checkpoint?.({ success: true, deliveryStatus: 'provider_accepted', status: 'sent', provider: sentProvider, messageId: providerMessageId, logId, trackingId, operationId: request.headers.get('x-outreach-operation-id'), httpStatus: 200 });
      const postSendWarnings: string[] = [];
      if (logId) {
        let { error: logUpdateError } = await admin
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
        if (logUpdateError && (logUpdateError.code === 'PGRST204' || /provider_event_status|schema cache/i.test(logUpdateError.message))) {
          const fallback = await admin
            .from('lead_outreach_log')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              provider: sentProvider,
              zoho_message_id: providerMessageId,
              provider_message_id: providerMessageId,
              error_message: providerFailures.length > 0
                ? `Failover recovered. Previous providers failed: ${providerFailures.map((f) => `${f.provider}: ${f.error}`).join(' | ')}`
                : null,
            })
            .eq('id', logId);
          logUpdateError = fallback.error;
        }
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

      if (!providerMessageId) postSendWarnings.push('native_message_reference_pending_sync');
      if (providerMessageId) {
        try {
          await persistCanonicalOutboundEmail({
            supabase: admin,
            tenantId,
            userId: tenantCtx.user.id,
            provider: sentProvider === 'microsoft' ? 'microsoft_graph' : sentProvider,
            providerMessageId,
            fromEmail: sentFromEmail,
            recipients: [leadEmail],
            subject: normalizedSubject,
            html: htmlBody,
            text: (sanitizedBody || '').slice(0, 4000),
            hasAttachments: false,
            metadata: {
              source: 'api.outreach.send',
              idempotency_key: request.headers.get('x-outreach-operation-id'),
              outreach_log_id: logId,
              tracking_id: trackingId,
              provider: sentProvider,
            },
          });
        } catch (canonicalErr) {
          console.error('[Outreach/Send] Canonical email persistence failed:', canonicalErr);
          postSendWarnings.push('canonical_persistence_failed');
        }
      }

      // Log activity to the activities table if entityType is contact or entityId is provided
      const resolvedContactId = entityId || (entityType === 'contact' ? entityId : null);
      if (resolvedContactId) {
        try {
          await admin.from('activities').insert({
            tenant_id: tenantId,
            contact_id: resolvedContactId,
            created_by: tenantCtx.user.id,
            type: 'email',
            subject: normalizedSubject,
            description: (sanitizedBody || '').slice(0, 1000),
            status: 'completed',
            is_automated: false,
            source: 'outreach',
            metadata: {
              provider: sentProvider,
              tracking_id: trackingId,
              lead_email: leadEmail,
            },
          });
          await admin.from('contacts').update({ last_activity_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', resolvedContactId);
        } catch (activityErr) {
          console.warn('[Outreach/Send] Contact activity log failed (non-fatal):', activityErr);
        }
      }

      return NextResponse.json({
        success:    true,
        status:     'sent',
        deliveryStatus: 'provider_accepted',
        logId,
        trackingId,
        provider: sentProvider,
        failoverAttempts: [],
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
          failoverAttempts: classifiedFailures.map(({ provider, category }) => ({ provider, category })),
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
          failoverAttempts: classifiedFailures.map(({ provider, category }) => ({ provider, category })),
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
        failoverAttempts: classifiedFailures.map(({ provider, category }) => ({ provider, category })),
      },
      { status: 502 }
    );

  } catch (error: unknown) {
    if (!providerWriteStarted) return NextResponse.json({ success: false, status: 'failed', deliveryStatus: 'failed', code: 'OUTREACH_PRE_SEND_FAILED', error: 'The sender or workspace checks failed before sending. Check the connected email account and try again. No email was sent.' }, { status: 503 });
    console.error('[outreach/send] Operation interrupted', request.headers.get('x-outreach-operation-id'), { code: (error as { code?: string })?.code });
    return NextResponse.json({ success: false, status: 'unknown', deliveryStatus: 'unknown', code: 'OUTCOME_UNKNOWN', error: 'This attempt could not be confirmed. Reconcile its original operation before retrying.' }, { status: 409 });
  }
}


/** The explicit UI Send action prepares approval and then submits the exact snapshot. */
export async function POST(request: Request) {
  try {
    const raw = await request.json();
    if (raw.attachments?.length || raw.cc?.length || raw.bcc?.length) {
      return NextResponse.json({ error: 'Use the mailbox composer for attachments, CC or BCC. No email was sent.' }, { status: 422 });
    }
    const parsed = outreachSendSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid outreach request', details: parsed.error.flatten() }, { status: 400 });
    const payload = parsed.data;
    const access = await requireTenantAccess(payload.tenantId, request);
    const headers = new Headers(request.headers);
    if (payload.queue || payload.autoSend !== true) {
      return executeOutreach(new Request(request, { body: JSON.stringify(payload) }), access);
    }
    // Bind approval to provider records and actual connected Microsoft identity.
    const connections = await access.admin.from('integrations').select('type, user_id, config, enabled, updated_at')
      .eq('tenant_id', payload.tenantId).eq('enabled', true).in('type', ['microsoft', 'brevo', 'resend', 'sendgrid', 'zoho', 'email_profile']);
    if (connections.error) throw connections.error;
    const accounts = await access.admin.from('email_provider_accounts').select('id, provider, owner_user_id, email_address, display_name, connection_status, updated_at').eq('tenant_id', payload.tenantId).eq('connection_status', 'connected').is('deleted_at', null);
    if (accounts.error) throw accounts.error;
    const microsoft = await microsoftServerService.getConnection(access.user.id);
    const senderRevision = outreachFingerprint({
      integrations: (connections.data || []).sort((a: { type: string; user_id: string }, b: { type: string; user_id: string }) => `${a.type}:${a.user_id}`.localeCompare(`${b.type}:${b.user_id}`)),
      accounts: (accounts.data || []).sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)),
      microsoft: microsoft ? { userId: microsoft.user_id, email: microsoft.microsoft_email } : null,
    });
    const secret = process.env.AUTH_SECRET || process.env.ENCRYPTION_SECRET || '';
    const operationId = outreachOperationKey(access.user.id, payload);
    if (request.headers.get('x-outreach-phase') === 'approve') {
      return NextResponse.json({ approvalToken: signOutreachApproval(secret, access.user.id, payload, senderRevision), operationId }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (!verifyOutreachApproval(request.headers.get('x-outreach-approval') || '', secret, access.user.id, payload, senderRevision)) {
      return NextResponse.json({ error: 'Review the recipients, message and sender, then approve this send again.', code: 'APPROVAL_REQUIRED' }, { status: 409 });
    }
    const recipientHash = outreachFingerprint({ tenantId: payload.tenantId, recipient: payload.leadEmail.trim().toLowerCase() });
    // Guard one logical message, not every future conversation with this recipient.
    // Subject edits are distinct messages; body/provider edits under the same subject stay protected.
    const messageScopeHash = outreachFingerprint({ recipientHash, subject: normalizeEmailSubject(payload.subject).trim().toLowerCase() });
    const unresolved = await access.admin.from('mcp_action_receipts').select('action_id, idempotency_key, sanitized_input, sanitized_output')
      .eq('tenant_id', payload.tenantId).eq('tool', 'ui_outreach_send')
      .eq('sanitized_input->>recipient_hash', recipientHash).in('final_status', ['running', 'unknown_execution_state'])
      .neq('idempotency_key', operationId).limit(20);
    if (unresolved.error) throw unresolved.error;
    for (const attempt of unresolved.data || []) {
      const scope = attempt.sanitized_input?.message_scope_hash;
      if (scope && scope !== messageScopeHash) continue;
      if (!scope && attempt.sanitized_output?.logId) {
        const prior = await access.admin.from('lead_outreach_log').select('subject')
          .eq('tenant_id', payload.tenantId).eq('id', attempt.sanitized_output.logId).maybeSingle();
        if (prior.error) throw prior.error;
        if (prior.data?.subject && normalizeEmailSubject(prior.data.subject).trim().toLowerCase() !== normalizeEmailSubject(payload.subject).trim().toLowerCase()) continue;
      }
      const priorStore = emailOperationStore(payload.tenantId, 'ui_outreach_send', attempt.idempotency_key);
      const evidence = await priorStore.reconcile();
      if (evidence) {
        await priorStore.save(attempt.action_id, evidence.deliveryStatus === 'failed' ? 'failed' : evidence.deliveryStatus === 'delivered' ? 'delivered' : 'provider_accepted', { ...attempt.sanitized_output, ...evidence, httpStatus: evidence.success ? 200 : 422 });
        continue;
      }
      return NextResponse.json({ success: false, deliveryStatus: 'unknown', code: 'OUTCOME_UNKNOWN', operationId: attempt.idempotency_key, actionId: attempt.action_id,
        error: 'The earlier attempt for this message has no confirmed outcome yet. Its send record was checked automatically; no duplicate was sent.' }, { status: 409 });
    }
    const legacyHistory = await access.admin.from('lead_outreach_log').select('id, error_message')
      .eq('tenant_id', payload.tenantId).ilike('lead_email', payload.leadEmail).eq('subject', normalizeEmailSubject(payload.subject))
      .in('status', ['queued', 'failed']).order('created_at', { ascending: false }).limit(20);
    if (legacyHistory.error) throw legacyHistory.error;
    const uncertainLegacyRows = (legacyHistory.data || []).filter((row: { id: string; error_message?: string }) =>
      /timeout|timed out|network|fetch failed|socket|ECONN|unknown|reconcil/i.test(row.error_message || ''));
    if (uncertainLegacyRows.length) {
      const confirmed = await access.admin.from('mcp_action_receipts').select('sanitized_output')
        .eq('tenant_id', payload.tenantId).eq('tool', 'ui_outreach_send')
        .eq('sanitized_input->>recipient_hash', recipientHash).in('final_status', ['provider_accepted', 'delivered', 'completed']).limit(20);
      if (confirmed.error) throw confirmed.error;
      const confirmedLogs = new Set((confirmed.data || []).map((row: { sanitized_output?: { logId?: string } }) => row.sanitized_output?.logId).filter(Boolean));
      if (uncertainLegacyRows.some((row: { id: string }) => !confirmedLogs.has(row.id))) {
        // The original operation is allowed to replay/reconcile its own receipt.
        const ownReceipt = await access.admin.from('mcp_action_receipts').select('action_id')
          .eq('tenant_id', payload.tenantId).eq('tool', 'ui_outreach_send').eq('idempotency_key', operationId).maybeSingle();
        if (ownReceipt.error) throw ownReceipt.error;
        if (!ownReceipt.data) return NextResponse.json({ success: false, deliveryStatus: 'unknown', code: 'OUTCOME_UNKNOWN', error: 'A previous attempt has uncertain delivery. Verify its provider record before sending another email to this recipient.' }, { status: 409 });
      }
    }
    headers.set('x-outreach-operation-id', operationId);
    const result = await runEmailOperation({
      store: emailOperationStore(payload.tenantId, 'ui_outreach_send', operationId, { userId: access.user.id, recipientHash, approvalFingerprint: outreachFingerprint(payload), senderRevision, messageScopeHash }),
      execute: async (_actionId, checkpoint) => {
        const response = await executeOutreach(new Request(request, { headers, body: JSON.stringify(payload) }), access, checkpoint);
        return { ...await response.json(), httpStatus: response.status, operationId };
      },
    });
    const { httpStatus, ...body } = result;
    return NextResponse.json(body, { status: Number(httpStatus) || (body.success ? 200 : 409), headers: { 'x-request-id': operationId, 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return routeErrorResponse(error, 'The send could not be confirmed. Check the original operation before trying again.', request);
  }
}
