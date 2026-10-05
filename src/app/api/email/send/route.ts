import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { executeSendEmailCommand } from '@/lib/execution/commands/sendEmailCommand';
import { mapProviderCodeToHttpStatus } from '@/lib/execution/domainCapabilityGuard';
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
  provider: z.enum(['auto', 'zoho', 'gmail', 'outlook', 'brevo', 'sendgrid', 'resend']).optional(),
  document_file_ids: z.array(z.string().uuid()).optional(),
  skipRecipientGate: z.boolean().optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
}).refine((data) => Boolean(data.body_html?.trim() || data.html?.trim()), {
  message: 'body_html or html is required',
  path: ['body_html'],
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = sendEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
    }

    const { tenantId, to, subject, contactId, clientId, threadId, provider, document_file_ids, skipRecipientGate, idempotencyKey: bodyKey } = parsed.data;
    const headerKey = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key');
    const idempotencyKey = (bodyKey || headerKey || '').trim() || undefined;
    const bodyHtml = (parsed.data.body_html || parsed.data.html || '').trim();
    const { user } = await requireTenantAccess(tenantId, req);
    const attachments = document_file_ids?.length ? await resolveEmailAttachmentsFromFileIds(tenantId, document_file_ids) : undefined;

    const execution = await executeSendEmailCommand({
      tenantId,
      userId: user.id,
      actorId: user.id,
      to,
      subject,
      html: bodyHtml,
      attachments,
      skipRecipientGate: skipRecipientGate ?? Boolean(document_file_ids?.length),
      initiationSource: 'api.email.send',
      executionSource: 'ui',
      idempotencyKey,
      preferredProvider: provider && provider !== 'auto' ? provider : undefined,
      relatedRecord: contactId ? { type: 'contact', id: contactId } : clientId ? { type: 'client', id: clientId } : undefined,
      auditMetadata: {
        source_module: 'api',
        source_action: 'email.send',
        ...(contactId ? { contactId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(threadId ? { threadId } : {}),
        ...(document_file_ids?.length ? { documentFileCount: document_file_ids.length } : {}),
      },
    });

    if (!execution.ok) {
      const code = execution.failure_code || execution.error?.code || 'SEND_FAILED';
      const status = mapProviderCodeToHttpStatus(code);
      return NextResponse.json(
        {
          error: execution.error?.message || 'Failed to send email',
          code,
          execution_truth: {
            status: execution.status,
            verification_state: execution.verification_state,
            may_claim_completed: false,
            execution_id: execution.execution_id,
            idempotency_key: execution.idempotency_key,
          },
        },
        { status }
      );
    }

    const result = execution.result!;
    return NextResponse.json({
      success: true,
      provider: result.provider,
      providerAccountId: result.providerAccountId,
      emailId: result.emailId,
      canonicalMessageId: result.canonicalMessageId,
      execution_id: execution.execution_id,
      idempotency_key: execution.idempotency_key,
      execution_truth: {
        status: execution.status,
        verification_state: execution.verification_state,
        may_claim_completed: execution.verification_state === 'VERIFIED',
      },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to send email', req);
  }
}
