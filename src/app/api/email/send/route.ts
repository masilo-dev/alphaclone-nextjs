import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
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
  isPlatformNotification: z.boolean().optional(),
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

    const { tenantId, to, subject, contactId, provider, document_file_ids, skipRecipientGate, isPlatformNotification } = parsed.data;
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
      isPlatformNotification: isPlatformNotification ?? false,
    }, preferredProvider);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email', code: result.code || 'SEND_FAILED', tried: result.tried },
        { status: 502 }
      );
=======
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { resolveEmailAttachmentsFromFileIds } from '@/lib/files/resolveEmailAttachments';
import { z } from 'zod';

const SendEmailSchema = z.object({
    to: z.union([z.string().email(), z.array(z.string().email())]),
    subject: z.string().min(1).max(250),
    html: z.string().max(100000).optional(),
    text: z.string().max(50000).optional(),
    message: z.string().max(50000).optional(),
    fromName: z.string().max(100).optional(),
    tenantId: z.string().uuid(),
    userId: z.string().uuid().optional(),
    replyTo: z.string().email().optional(),
    attachments: z.array(z.any()).optional(),
    isPlatformNotification: z.boolean().optional(),
    templateName: z.string().optional(),
    listUnsubscribeUrl: z.string().optional(),
    preferredProvider: z.enum(['zoho', 'brevo', 'resend', 'sendgrid']).optional(),
    document_file_ids: z.array(z.string().uuid()).optional(),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = SendEmailSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
        }

        const internalKey = req.headers.get('x-internal-api-key');
        const internalOk =
            Boolean(internalKey) &&
            internalKey === process.env.INTERNAL_API_KEY;

        let authUserId: string | null = null;
        if (!internalOk) {
            const authClient = await createSupabaseServerClient();
            const {
                data: { user },
            } = await authClient.auth.getUser();
            if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            authUserId = user.id;
        }

        const resolvedAttachments = parsed.data.document_file_ids?.length
            ? await resolveEmailAttachmentsFromFileIds(parsed.data.tenantId, parsed.data.document_file_ids)
            : [];
        const sendResult = await sendEmailServer({
            ...parsed.data,
            userId: parsed.data.userId || authUserId || undefined,
            attachments: [
                ...(parsed.data.attachments || []),
                ...resolvedAttachments,
            ],
        });

        if (!sendResult.success) {
            return NextResponse.json(sendResult, { status: 502 });
        }

        return NextResponse.json({
            success: true,
            id: sendResult.emailId,
            provider: sendResult.provider,
            status: 'sent',
        });

    } catch (error) {
        console.error('Error in /api/email/send:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
>>>>>>> origin/main
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
