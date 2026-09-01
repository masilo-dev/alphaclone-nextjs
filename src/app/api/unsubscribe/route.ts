import { NextRequest, NextResponse } from 'next/server';
import { addUnsubscribe } from '@/lib/email/unsubscribe';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribeToken';
import { SITE_URL } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

function confirmationHtml(message: string, preferencesUrl?: string): string {
  const prefsLink = preferencesUrl
    ? `<p style="margin:20px 0 0;"><a href="${preferencesUrl}" style="color:#0284c7;text-decoration:underline;">Manage email preferences</a></p>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Email Preferences</title></head>
<body style="margin:0;padding:0;background:#060d1a;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="600" style="max-width:600px;width:100%;background:#0f172a;border-radius:12px;border:1px solid rgba(45,212,191,0.2);">
<tr><td style="padding:40px 32px;text-align:center;color:#fff;">
<h1 style="margin:0 0 12px;font-size:24px;">${message}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#94a3b8;">Marketing and outreach emails are suppressed for this address. Essential account, security, and invoice communications may still be sent when required.</p>
${prefsLink}
</td></tr></table></td></tr></table></body></html>`;
}

async function processUnsubscribe(req: NextRequest, token: string) {
  const verified = verifyUnsubscribeToken(token);
  if (!verified) return null;

  const preferencesUrl = `${SITE_URL}/preferences/email?tenant=${encodeURIComponent(verified.tenantId)}&email=${encodeURIComponent(verified.email)}&token=${encodeURIComponent(token)}`;

  await addUnsubscribe(verified.email, verified.tenantId, {
    source: 'unsubscribe_link',
    tokenId: token.slice(0, 32),
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
    userAgent: req.headers.get('user-agent') || undefined,
  });

  return { verified, preferencesUrl };
}

/** RFC 8058 one-click unsubscribe POST */
export async function POST(req: NextRequest) {
  const token = String(new URL(req.url).searchParams.get('token') || req.headers.get('List-Unsubscribe') || '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const result = await processUnsubscribe(req, token);
  if (!result) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  return NextResponse.json({ success: true, unsubscribed: true });
}

export async function GET(req: NextRequest) {
  const token = String(new URL(req.url).searchParams.get('token') || '').trim();
  if (!token) {
    return new NextResponse(confirmationHtml('Invalid unsubscribe link.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    const result = await processUnsubscribe(req, token);
    if (!result) {
      return new NextResponse(confirmationHtml('This unsubscribe link is invalid or has expired.'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    return new NextResponse(confirmationHtml("You've been unsubscribed.", result.preferencesUrl), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new NextResponse(confirmationHtml('We could not process your request. Please try again later.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
