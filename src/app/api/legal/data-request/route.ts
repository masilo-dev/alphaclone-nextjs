import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { sendWithProviderSdk } from '@/lib/email/providerSdk';
import { emailFooterText } from '@/components/legal/EmailFooter';
import { isTurnstileEnforced, readClientIp, readTurnstileToken, verifyTurnstileToken } from '@/lib/verifyTurnstile';

export const dynamic = 'force-dynamic';

function getBrevoKey() {
  return process.env.BREVO_PLATFORM_API_KEY || process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '';
}

function getFromEmail() {
  return process.env.BREVO_PLATFORM_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'legal@alphaclonesystems.com';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));
    const email = String(payload.email || '').trim();
    const requestType = String(payload.requestType || '').trim();
    const details = String(payload.details || '').trim();

    if (!email || !requestType) {
      return NextResponse.json({ error: 'Email and request type are required.' }, { status: 400 });
    }

    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    if (isTurnstileEnforced()) {
      const turnstileToken = readTurnstileToken(payload);
      if (!turnstileToken) {
        return NextResponse.json({ error: 'Security verification required.' }, { status: 400 });
      }
      const ok = await verifyTurnstileToken(turnstileToken, readClientIp(req));
      if (!ok) {
        return NextResponse.json({ error: 'Security verification failed. Please try again.' }, { status: 403 });
      }
    }

    const supabase = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    const { error: insertError } = await supabase.from('data_requests').insert({
      email,
      request_type: requestType,
      details: details || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const brevoKey = getBrevoKey();
    const fromEmail = getFromEmail();
    const subject = `We received your data request: ${requestType}`;
    const text = [
      `Hello,`,
      ``,
      `We received your request type "${requestType}" for ${email}.`,
      `We will process it within 30 days.`,
      ``,
      emailFooterText,
    ].join('\n');
    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #e2e8f0; background: #020617; padding: 24px;">
        <div style="max-width: 640px; margin: 0 auto; background: #0f172a; border: 1px solid #1f2937; border-radius: 16px; padding: 24px;">
          <h1 style="margin: 0 0 12px; color: #ffffff;">Your data request was received</h1>
          <p style="line-height: 1.7;">We received your request type <strong>${escapeHtml(requestType)}</strong> for <strong>${escapeHtml(email)}</strong>.</p>
          <p style="line-height: 1.7;">We process all requests within 30 days.</p>
          ${details ? `<p style="line-height: 1.7; color: #cbd5e1;"><strong>Additional details:</strong> ${escapeHtml(details)}</p>` : ''}
          <div style="border-top: 1px solid #334155; margin: 16px 0;"></div>
          <div style="font-size: 12px; line-height: 1.6; color: #94a3b8; text-align: center; white-space: pre-line;">${emailFooterText.replace(/</g, '&lt;')}</div>
        </div>
      </div>
    `;

    if (brevoKey) {
      await sendWithProviderSdk('brevo', {
        apiKey: brevoKey,
        fromEmail,
        fromName: 'AlphaClone Systems',
        to: email,
        subject,
        html,
        text,
      });

      await sendWithProviderSdk('brevo', {
        apiKey: brevoKey,
        fromEmail,
        fromName: 'AlphaClone Systems',
        to: 'legal@alphaclonesystems.com',
        subject: `New data request: ${requestType}`,
        html: `<pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">Email: ${email}\nRequest type: ${requestType}\nDetails: ${details || '(none)'}</pre>`,
        text: `Email: ${email}\nRequest type: ${requestType}\nDetails: ${details || '(none)'}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 });
  }
}
