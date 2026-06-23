import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body_html: z.string().min(1),
  threadId: z.string().optional(),
  contactId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = sendEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
    }

    const { to, subject, body_html, threadId, contactId, clientId } = parsed.data;
    const { user } = await requireTenantAccess('51772ee6-dee8-4c42-81f7-0fee297e5b27');
    const admin = createAdminSupabaseClientOrThrow();

    // Fix 2E: Replace {{{unsubscribe_url}}} template variable
    let processedBody = body_html.replace(
      '{{{unsubscribe_url}}}',
      `https://alphaclonesystems.com/unsubscribe?email=${encodeURIComponent(to)}`
    );

    // Remove double footer - ensure footer is only added once
    processedBody += `
      <br><br>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="font-size: 11px; color: #9ca3af;">
        Alphaclone Systems, LLC<br>
        <a href="https://alphaclonesystems.com" style="color: #6366f1;">alphaclonesystems.com</a><br>
        <a href="https://alphaclonesystems.com/unsubscribe?email=${encodeURIComponent(to)}" style="color: #6366f1;">Unsubscribe</a>
      </p>
    `;

    let result;

    if (threadId) {
      // Reply to existing thread via Zoho API
      const zohoRes = await fetch(
        `https://mail.zoho.eu/api/accounts/8586098000000002002/messages/${threadId}/reply`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fromAddress: 'sales@alphaclonesystems.com',
            toAddress: to,
            subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
            content: processedBody,
            mailFormat: 'html',
            askReceipt: 'no',
          }),
        }
      );

      if (!zohoRes.ok) {
        const zohoError = await zohoRes.text();
        throw new Error(`Zoho reply failed: ${zohoError}`);
      }

      result = await zohoRes.json();
    } else {
      // Send new email via Zoho transactional API
      const zohoRes = await fetch(
        'https://mail.zoho.eu/api/accounts/8586098000000002002/messages',
        {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fromAddress: 'sales@alphaclonesystems.com',
            toAddress: to,
            subject,
            content: processedBody,
            mailFormat: 'html',
            askReceipt: 'no',
          }),
        }
      );

      if (!zohoRes.ok) {
        const zohoError = await zohoRes.text();
        throw new Error(`Zoho send failed: ${zohoError}`);
      }

      result = await zohoRes.json();
    }

    // Log to outreach_logs
    await admin.from('lead_outreach_log').insert({
      tenant_id: '51772ee6-dee8-4c42-81f7-0fee297e5b27',
      contact_id: contactId || null,
      client_id: clientId || null,
      type: 'email',
      direction: 'outbound',
      subject,
      body: processedBody,
      sent_at: new Date().toISOString(),
      provider: 'zoho',
      status: 'sent',
      metadata: {
        zoho_message_id: result?.data?.messageId || null,
        thread_id: threadId || null,
      },
    });

    // Log to client_email_history if contactId provided
    if (contactId) {
      await admin.from('client_email_history').insert({
        tenant_id: '51772ee6-dee8-4c42-81f7-0fee297e5b27',
        contact_id: contactId,
        direction: 'outbound',
        subject,
        body_html: processedBody,
        sent_at: new Date().toISOString(),
        zoho_message_id: result?.data?.messageId || null,
        thread_id: threadId || null,
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to send email', req);
  }
}
