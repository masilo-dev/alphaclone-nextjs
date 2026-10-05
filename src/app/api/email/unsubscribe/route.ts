import { NextRequest, NextResponse } from 'next/server';
import { addUnsubscribe } from '@/lib/email/unsubscribe';
import { verifyEmailUnsubscribeSignature, verifyUnsubscribeToken } from '@/lib/email/unsubscribeToken';

export const dynamic = 'force-dynamic';

function confirmationHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed</title>
</head>
<body style="margin:0;padding:0;background-color:var(--ws-surface-secondary);font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:var(--color-white);border:1px solid var(--ws-border);border-radius:12px;">
          <tr>
            <td style="padding:40px 32px;text-align:center;">
              <h1 style="margin:0 0 12px;font-size:24px;color:var(--ws-canvas);">${message}</h1>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = String(url.searchParams.get('token') || '').trim();

  if (token) {
    const verified = verifyUnsubscribeToken(token);
    if (!verified) {
      return new NextResponse(confirmationHtml('This unsubscribe link is invalid or has expired.'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    await addUnsubscribe(verified.email, verified.tenantId);
    return new NextResponse(confirmationHtml("You've been unsubscribed."), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const tenantId = String(url.searchParams.get('tenantId') || '').trim();
  const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
  const sig = String(url.searchParams.get('sig') || '').trim().toLowerCase();

  if (!verifyEmailUnsubscribeSignature({ tenantId, email, sig })) {
    return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 400 });
  }

  await addUnsubscribe(email, tenantId);
  return new NextResponse(confirmationHtml("You've been unsubscribed."), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
