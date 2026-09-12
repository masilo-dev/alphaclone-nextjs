import { type EmailGatewayCategory } from '@/lib/email/emailGateway';
import type { OutboundEmailProvider } from '@/lib/email/sendEmail';
import type { EmailAttachment } from '@/lib/email/emailAttachment';
import { checkEmailSendQuotaAvailable } from '@/lib/email/usageMeteringService';
import { EmailExecutionService } from '@/lib/email/emailExecutionService';

export interface SendEmailServerParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  message?: string;
  fromName?: string;
  tenantId: string;
  userId?: string;
  actorId?: string;
  role?: string;
  permissions?: string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
  isPlatformNotification?: boolean;
  templateName?: string;
  listUnsubscribeUrl?: string;
  preferredProvider?: OutboundEmailProvider;
  providerAccountId?: string;
  skipFooter?: boolean;
  auditMetadata?: Record<string, unknown>;
  category?: EmailGatewayCategory;
  headline?: string;
  recipientName?: string;
  greeting?: string;
  cta?: { label: string; url: string };
  isReply?: boolean;
  campaignId?: string;
  sequenceId?: string;
  sequenceStepId?: string;
  outreachAttemptId?: string;
  workflowId?: string;
  initiationSource?: string;
  relatedRecord?: { type: string; id: string };
  idempotencyKey?: string;
  skipRecipientGate?: boolean;
  internalNotificationKind?: 'digest' | 'immediate_exception';
}

export interface SendEmailServerResult {
  success: boolean;
  emailId?: string;
  canonicalMessageId?: string;
  providerAccountId?: string;
  provider?: string;
  error?: string;
  errorDetails?: unknown;
  code?: string;
  gatewayVersion?: string;
}

function inferCategory(params: SendEmailServerParams): EmailGatewayCategory {
  if (params.category) return params.category;
  const template = String(params.templateName || '').toLowerCase();
  if (template.includes('invoice') || template.includes('receipt') || template.includes('payment')) return 'invoice_payment';
  if (template.includes('contract') || template.includes('signature')) return 'contract_document';
  if (template.includes('booking') || template.includes('appointment')) return 'booking_calendar';
  if (template.includes('security') || template.includes('password') || template.includes('auth')) return 'account_security';
  if (params.isReply) return 'transactional';
  if (params.isPlatformNotification) return 'internal_notification';
  return 'transactional';
}

function sourceParts(params: SendEmailServerParams): { module: string; action: string } {
  const explicitModule = String(params.auditMetadata?.source_module || '').trim();
  const explicitAction = String(params.auditMetadata?.source_action || '').trim();
  const source = String(params.initiationSource || params.auditMetadata?.source || 'server.send_email').trim();
  const [module, ...rest] = source.split('.');
  return {
    module: explicitModule || module || 'server',
    action: explicitAction || rest.join('.') || 'send_email',
  };
}

export async function sendEmailServer(params: SendEmailServerParams): Promise<SendEmailServerResult> {
  const category = inferCategory(params);
  if (category === 'internal_notification' && !params.internalNotificationKind) {
    return { success: false, error: 'Internal notifications are digest-only unless explicitly classified as an immediate exception.', code: 'DIGEST_REQUIRED' };
  }

  const isWebsiteNotification = params.isPlatformNotification === true
    && params.templateName === 'websiteContact'
    && category === 'internal_notification';
  const quota: Awaited<ReturnType<typeof checkEmailSendQuotaAvailable>> = isWebsiteNotification
    ? { allowed: true, resource: 'email_transactional' }
    : await checkEmailSendQuotaAvailable({ tenantId: params.tenantId, userId: params.userId, category, isReply: params.isReply });
  if (!quota.allowed) return { success: false, error: quota.message || 'Email sending quota exceeded', code: 'QUOTA_EXCEEDED' };

  const source = sourceParts(params);
  const result = await EmailExecutionService.execute({
    context: {
      tenantId: params.tenantId,
      userId: params.userId,
      actorId: params.actorId || params.userId,
      role: params.role,
      permissions: params.permissions,
    },
    sourceModule: source.module,
    sourceAction: source.action,
    to: params.to,
    subject: params.subject,
    message: params.message || params.text,
    html: params.html,
    category,
    templateId: params.templateName,
    senderName: params.fromName,
    replyTo: params.replyTo,
    headline: params.headline,
    recipientName: params.recipientName,
    greeting: params.greeting,
    cta: params.cta,
    relatedRecord: params.relatedRecord,
    campaignId: params.campaignId,
    sequenceId: params.sequenceId,
    sequenceStepId: params.sequenceStepId,
    outreachAttemptId: params.outreachAttemptId,
    workflowId: params.workflowId,
    preferredProvider: params.preferredProvider,
    attachments: params.attachments,
    listUnsubscribeUrl: params.listUnsubscribeUrl,
    idempotencyKey: params.idempotencyKey,
    skipRecipientGate: params.skipRecipientGate,
    isPlatformNotification: params.isPlatformNotification,
    isReply: params.isReply,
    auditMetadata: {
      ...(params.auditMetadata || {}),
      ...(params.providerAccountId ? { provider_account_id: params.providerAccountId } : {}),
    },
  });

  return {
    success: result.success,
    emailId: result.emailId,
    canonicalMessageId: result.canonicalMessageId,
    providerAccountId: result.providerAccountId,
    provider: result.provider,
    error: result.error,
    errorDetails: result.tried,
    code: result.code,
    gatewayVersion: result.gatewayVersion,
  };
}
