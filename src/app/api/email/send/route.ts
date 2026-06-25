import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { sendEmail } from '@/lib/email/sendEmail';

const sendEmailSchema = z.object({
  tenantId: z.string().uuid(),
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
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { tenantId, to, subject, body_html, contactId, clientId } = parsed.data;
    const { user } = await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    const result = await sendEmail(tenantId, {
      to,
      subject,
      html: body_html,
      userId: user.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email', code: result.code || 'SEND_FAILED', tried: result.tried },
        { status: 502 }
      );
    }

    await admin.from('lead_outreach_log').insert({
      tenant_id: tenantId,
      contact_id: contactId || null,
      client_id: clientId || null,
      type: 'email',
      direction: 'outbound',
      subject,
      body: body_html,
      sent_at: new Date().toISOString(),
      provider: result.provider || 'unknown',
      status: 'sent',
      metadata: {
        email_id: result.emailId || null,
      },
    });

    if (contactId) {
      await admin.from('client_email_history').insert({
        tenant_id: tenantId,
        contact_id: contactId,
        direction: 'outbound',
        subject,
        body_html,
        sent_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, provider: result.provider, emailId: result.emailId });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to send email', req);
  }
}
