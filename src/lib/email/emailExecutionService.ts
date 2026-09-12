import {
  sendViaEmailGateway,
  type EmailGatewayCategory,
  type EmailGatewayResult,
} from '@/lib/email/emailGateway';
import type { OutboundEmailProvider } from '@/lib/email/sendEmail';
import type { EmailAttachment } from '@/lib/email/emailAttachment';
import {
  assertEmailExecutionContext,
  buildTenantEmailIdempotencyKey,
  type EmailExecutionContext,
} from '@/lib/email/emailExecutionContext';

export type EmailExecutionRequest = {
  context: EmailExecutionContext;
  sourceModule: string;
  sourceAction: string;
  to: string | string[];
  subject: string;
  message?: string;
  html?: string;
  category: EmailGatewayCategory;
  templateId?: string;
  senderName?: string;
  replyTo?: string;
  headline?: string;
  recipientName?: string;
  greeting?: string;
  cta?: { label: string; url: string };
  relatedRecord?: { type: string; id: string };
  campaignId?: string;
  sequenceId?: string;
  sequenceStepId?: string;
  outreachAttemptId?: string;
  workflowId?: string;
  preferredProvider?: OutboundEmailProvider;
  attachments?: EmailAttachment[];
  listUnsubscribeUrl?: string;
  idempotencyKey?: string;
  skipRecipientGate?: boolean;
  isPlatformNotification?: boolean;
  isReply?: boolean;
  auditMetadata?: Record<string, unknown>;
};

function normalizeRecipients(to: string | string[]): string[] {
  return (Array.isArray(to) ? to : [to])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Canonical tenant-aware email execution facade.
 *
 * Every production module should call this service instead of invoking a
 * provider SDK directly. The gateway remains the rendering/compliance layer;
 * this service supplies the execution identity and tenant-scoped idempotency
 * contract shared by UI, MCP, Bonnie, CRM, campaigns, sequences and workers.
 */
export const EmailExecutionService = {
  async execute(request: EmailExecutionRequest): Promise<EmailGatewayResult> {
    const context = assertEmailExecutionContext(request.context);
    const recipients = normalizeRecipients(request.to);
    if (!recipients.length) {
      return {
        success: false,
        tried: [],
        error: 'At least one valid recipient is required',
        code: 'EMAIL_RECIPIENT_REQUIRED',
        gatewayVersion: 'email-gateway-v1',
        templateVersion: request.templateId || 'default',
        category: request.category,
      };
    }

    const idempotencyKey = request.idempotencyKey || buildTenantEmailIdempotencyKey(context, {
      sourceModule: request.sourceModule,
      sourceAction: request.sourceAction,
      recipient: recipients,
      campaignId: request.campaignId,
      sequenceId: request.sequenceId,
      sequenceStepId: request.sequenceStepId,
      outreachAttemptId: request.outreachAttemptId,
      relatedEntityId: request.relatedRecord?.id,
      subject: request.subject,
      content: request.message || request.html || '',
    });

    return sendViaEmailGateway({
      tenantId: context.tenantId,
      userId: context.userId || undefined,
      to: recipients,
      subject: request.subject,
      message: request.message,
      html: request.html,
      category: request.category,
      templateId: request.templateId,
      senderName: request.senderName,
      replyTo: request.replyTo,
      headline: request.headline,
      recipientName: request.recipientName,
      greeting: request.greeting,
      cta: request.cta,
      relatedRecord: request.relatedRecord,
      campaignId: request.campaignId,
      workflowId: request.workflowId,
      initiationSource: `${request.sourceModule}.${request.sourceAction}`,
      isPlatformNotification: request.isPlatformNotification,
      isReply: request.isReply,
      preferredProvider: request.preferredProvider,
      attachments: request.attachments,
      listUnsubscribeUrl: request.listUnsubscribeUrl,
      idempotencyKey,
      skipRecipientGate: request.skipRecipientGate,
      auditMetadata: {
        ...(request.auditMetadata || {}),
        source_module: request.sourceModule,
        source_action: request.sourceAction,
        actor_id: context.actorId || context.userId || null,
        role: context.role || null,
        sequence_id: request.sequenceId || null,
        sequence_step_id: request.sequenceStepId || null,
        outreach_attempt_id: request.outreachAttemptId || null,
      },
    });
  },
};
