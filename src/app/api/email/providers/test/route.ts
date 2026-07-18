import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';
import { microsoftServerService } from '@/services/server/microsoftServerService';

const testProviderSchema = z.object({
  tenantId: z.string().uuid(),
  provider: z.enum(['sendgrid', 'resend', 'brevo', 'zoho', 'microsoft']),
  to: z.string().email(),
  subject: z.string().min(1).max(250).optional(),
  message: z.string().min(1).max(5000).optional(),
});

function getConfigString(config: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = String(config[key] || '').trim();
    if (value) return value;
  }
  return '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = testProviderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tenantId, provider, to } = parsed.data;
    const subject = parsed.data.subject || 'AlphaClone test email';
    const message =
      parsed.data.message ||
      'This is a test email to confirm your provider connection is working end-to-end.';

    const tenantCtx = await requireTenantAccess(tenantId);
    const supabase = createAdminSupabaseClientOrThrow();

    if (provider === 'zoho') {
      const zoho = new ZohoMailService(tenantCtx.user.id, tenantId);
      await zoho.sendEmail({
        toAddress: to,
        subject,
        content: `<p>${message}</p>`,
      });
      return NextResponse.json({ success: true, provider, message: `Test email sent to ${to}` });
    }

    if (provider === 'microsoft') {
      await microsoftServerService.sendEmail(tenantCtx.user.id, {
        to: [to],
        subject,
        html: `<p>${message}</p>`,
      });
      return NextResponse.json({ success: true, provider, message: `Test email sent to ${to}` });
    }

    const { data: integration, error } = await supabase
      .from('integrations')
      .select('config, enabled')
      .eq('tenant_id', tenantId)
      .eq('user_id', tenantCtx.user.id)
      .eq('type', provider)
      .eq('enabled', true)
      .maybeSingle();

    if (error || !integration) {
      return NextResponse.json(
        { error: `${provider} is not connected for this workspace`, code: 'PROVIDER_NOT_CONNECTED' },
        { status: 404 }
      );
    }

    const config = (integration.config || {}) as Record<string, unknown>;
    const apiKey = getConfigString(config, 'api_key', 'apiKey');
    const fromEmail = getConfigString(config, 'from_email', 'fromEmail');
    const fromName = getConfigString(config, 'from_name', 'fromName') || 'AlphaClone Systems';
    if (!apiKey) {
      return NextResponse.json(
        { error: `${provider} API key is missing`, code: 'PROVIDER_CONFIG_INVALID' },
        { status: 400 }
      );
    }
    if (!fromEmail) {
      return NextResponse.json(
        { error: `${provider} sender email is missing`, code: 'PROVIDER_CONFIG_INVALID' },
        { status: 400 }
      );
    }

    let response: Response;
    if (provider === 'sendgrid') {
      response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail, name: fromName },
          subject,
          content: [{ type: 'text/html', value: `<p>${message}</p>` }],
        }),
      });
    } else if (provider === 'resend') {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to,
          subject,
          html: `<p>${message}</p>`,
        }),
      });
    } else {
      response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          sender: { email: fromEmail, name: fromName },
          to: [{ email: to }],
          subject,
          htmlContent: `<p>${message}</p>`,
        }),
      });
    }

    if (!response.ok) {
      const providerError = await response.text().catch(() => '');
      return NextResponse.json(
        { error: `${provider} rejected test send`, code: 'PROVIDER_SEND_FAILED', details: providerError },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, provider, message: `Test email sent to ${to}` });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to send provider test email', request);
  }
}
