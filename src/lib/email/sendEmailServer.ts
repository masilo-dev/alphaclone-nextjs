import {
  sendViaEmailGateway,
  type EmailGatewayCategory,
  type EmailGatewayRequest,
} from '@/lib/email/emailGateway';
import type { OutboundEmailProvider } from '@/lib/email/sendEmail';
import type { EmailAttachment } from '@/lib/email/emailAttachment';
import { checkEmailSendQuotaAvailable } from '@/lib/email/usageMeteringService';

export interface SendEmailServerParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  message?: string;
  fromName?: string;
  tenantId: string;
  userId?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  isPlatformNotification?: boolean;
  templateName?: string;
  listUnsubscribeUrl?: string;
  preferredProvider?: OutboundEmailProvider;
  skipFooter?: boolean;
  auditMetadata?: Record<string, unknown>;
  category?: EmailGatewayCategory;
  headline?: string;
  recipientName?: string;
  greeting?: string;
  cta?: { label: string; url: string };
  isReply?: boolean;
  campaignId?: string;
  workflowId?: string;
  initiationSource?: string;
  relatedRecord?: { type: string; id: string };
  idempotencyKey?: string;
  skipRecipientGate?: boolean;
}

export interface SendEmailServerResult {
  success: boolean;
  emailId?: string;
  provider?: string;
  error?: string;
  errorDetails?: unknown;
  code?: string;
  gatewayVersion?: string;
}

function inferCategory(params: SendEmailServerParams): EmailGatewayCategory {
  if (params.category) return params.category;
  const template = String(params.templateName || '').toLowerCase();
  if (template.includes('invoice') || template.includes('receipt') || template.includes('payment')) {
    return 'invoice_payment';
  }
  if (template.includes('contract') || template.includes('signature')) return 'contract_document';
  if (template.includes('booking') || template.includes('appointment')) return 'booking_calendar';
  if (template.includes('security') || template.includes('password') || template.includes('auth')) {
    return 'account_security';
  }
  if (params.isReply) return 'transactional';
  if (params.isPlatformNotification) return 'internal_notification';
  return 'transactional';
}

/**
 * Execute email sending through the centralized Email Rendering and Compliance Gateway.
 */
export async function sendEmailServer(params: SendEmailServerParams): Promise<SendEmailServerResult> {
  const category = inferCategory(params);
  const quota = await checkEmailSendQuotaAvailable({
    tenantId: params.tenantId,
    userId: params.userId,
    category,
    isReply: params.isReply,
  });
  if (!quota.allowed) {
    return {
      success: false,
      error: quota.message || 'Email sending quota exceeded',
      code: 'QUOTA_EXCEEDED',
    };
  }

  const gatewayRequest: EmailGatewayRequest = {
    tenantId: params.tenantId,
    userId: params.userId,
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
    workflowId: params.workflowId,
    initiationSource: params.initiationSource || params.auditMetadata?.source?.toString() || 'server',
    isPlatformNotification: params.isPlatformNotification,
    isReply: params.isReply,
    preferredProvider: params.preferredProvider,
    attachments: params.attachments,
    listUnsubscribeUrl: params.listUnsubscribeUrl,
    idempotencyKey: params.idempotencyKey,
    skipRecipientGate: params.skipRecipientGate,
    auditMetadata: params.auditMetadata,
  };

  const result = await sendViaEmailGateway(gatewayRequest);
  return {
    success: result.success,
    emailId: result.emailId,
    provider: result.provider,
    error: result.error,
    errorDetails: result.tried,
    code: result.code,
    gatewayVersion: result.gatewayVersion,
  };
}
