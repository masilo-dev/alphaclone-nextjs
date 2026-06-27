import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { sendEmail } from '@/lib/email/sendEmail';
import { resolveEmailAttachmentsFromFileIds } from '@/lib/files/resolveEmailAttachments';

const sendEmailSchema = z.object({
  tenantId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1),
  body_html: z.string().min(1).optional(),
  html: z.string().min(1).optional(),
  threadId: z.string().optional(),
  contactId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  provider: z.enum(['auto', 'zoho', 'gmail', 'brevo', 'sendgrid', 'resend']).optional(),
  document_file_ids: z.array(z.string().uuid()).optional(),
  skipRecipientGate: z.boolean().optional(),
}).refine((data) => Boolean(data.body_html?.trim() || data.html?.trim()), {
  message: 'body_html or html is required',
  path: ['body_html'],
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

    const { tenantId, to, subject, contactId, provider, document_file_ids, skipRecipientGate } = parsed.data;
    const body_html = (parsed.data.body_html || parsed.data.html || '').trim();
    const { user } = await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    const preferredProvider = provider && provider !== 'auto' ? provider as any : undefined;
    const attachments = document_file_ids?.length
      ? await resolveEmailAttachmentsFromFileIds(tenantId, document_file_ids)
      : undefined;
    const result = await sendEmail(tenantId, {
      to,
      subject,
      html: body_html,
      userId: user.id,
      attachments,
      skipRecipientGate: skipRecipientGate ?? Boolean(document_file_ids?.length),
    }, preferredProvider);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email', code: result.code || 'SEND_FAILED', tried: result.tried },
        { status: 502 }
      );
    }

    // Log outreach - fire-and-forget, don't let logging failure break the send
    if (contactId) {
      admin.from('lead_outreach_log').insert({
        tenant_id: tenantId,
        lead_id: contactId,
        subject,
        body_html,
        sent_at: new Date().toISOString(),
        provider: result.provider || 'unknown',
        status: 'sent',
      }).then(null, () => { /* non-fatal */ });
    }

    return NextResponse.json({ success: true, provider: result.provider, emailId: result.emailId });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to send email', req);
  }
}
