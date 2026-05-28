import { NextRequest, NextResponse } from 'next/server';
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
    }
}
