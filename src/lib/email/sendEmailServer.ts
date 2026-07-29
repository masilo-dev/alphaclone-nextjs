import { sendEmail, type OutboundEmailProvider } from '@/lib/email/sendEmail';

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
    attachments?: any[];
    isPlatformNotification?: boolean;
    templateName?: string;
    listUnsubscribeUrl?: string;
    preferredProvider?: OutboundEmailProvider;
<<<<<<< HEAD
    skipFooter?: boolean;
=======
>>>>>>> origin/main
}

export interface SendEmailServerResult {
    success: boolean;
    emailId?: string;
    provider?: string;
    error?: string;
    errorDetails?: any;
    code?: string;
}

/**
 * Execute email sending synchronously/programmatically on the server.
 * Handles validation, sanitization, config resolution, suppression checks, SDK delivery, and logging.
 */
export async function sendEmailServer(params: SendEmailServerParams): Promise<SendEmailServerResult> {
    const result = await sendEmail(params.tenantId, {
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text || params.message,
        fromName: params.fromName,
        userId: params.userId,
        replyTo: params.replyTo,
        attachments: params.attachments,
        isPlatformNotification: params.isPlatformNotification,
        templateName: params.templateName,
        listUnsubscribeUrl: params.listUnsubscribeUrl,
<<<<<<< HEAD
        skipFooter: params.skipFooter,
=======
>>>>>>> origin/main
    }, params.preferredProvider);

    return {
        success: result.success,
        emailId: result.emailId,
        provider: result.provider,
        error: result.error,
        errorDetails: result.tried,
        code: result.code,
    };
}
