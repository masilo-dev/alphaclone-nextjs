import { Resend } from 'resend';
import sgMail from '@sendgrid/mail';

export type EmailProvider = 'brevo' | 'sendgrid' | 'resend';

export type EmailSendInput = {
    apiKey: string;
    fromEmail: string;
    fromName?: string;
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
    cc?: string[];
    bcc?: string[];
    listUnsubscribeUrl?: string;
    attachments?: Array<{
        filename: string;
        content: string; // base64 content
        contentType?: string;
    }>;
};

export type EmailSendResult = {
    ok: boolean;
    provider: EmailProvider;
    emailId?: string;
    error?: string;
};

function normalizeRecipients(to: string | string[]): string[] {
    return Array.isArray(to) ? to : [to];
}

async function sendViaResend(input: EmailSendInput): Promise<EmailSendResult> {
    try {
        const resend = new Resend(input.apiKey);
        const resendPayload: Record<string, unknown> = {
            from: input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail,
            to: normalizeRecipients(input.to),
            subject: input.subject,
        };
        if (input.html) resendPayload.html = input.html;
        if (input.text) resendPayload.text = input.text;
        if (!input.html && !input.text) resendPayload.text = '';
        if (input.replyTo) resendPayload.replyTo = input.replyTo;
        if (input.cc?.length) resendPayload.cc = input.cc;
        if (input.bcc?.length) resendPayload.bcc = input.bcc;

        const { data, error } = await resend.emails.send(
            {
                ...(resendPayload as unknown as Parameters<typeof resend.emails.send>[0]),
                attachments: input.attachments?.map((attachment) => ({
                    filename: attachment.filename,
                    content: attachment.content,
                    contentType: attachment.contentType,
                })),
            }
        );

        if (error) {
            return { ok: false, provider: 'resend', error: JSON.stringify(error) };
        }
        return { ok: true, provider: 'resend', emailId: data?.id };
    } catch (error) {
        return {
            ok: false,
            provider: 'resend',
            error: error instanceof Error ? error.message : 'Resend send failed',
        };
    }
}

async function sendViaSendGrid(input: EmailSendInput): Promise<EmailSendResult> {
    try {
        sgMail.setApiKey(input.apiKey);

        const [response] = await sgMail.send({
            to: normalizeRecipients(input.to),
            from: { email: input.fromEmail, name: input.fromName },
            subject: input.subject,
            text: input.text || '',
            html: input.html || '',
            replyTo: input.replyTo,
            cc: input.cc,
            bcc: input.bcc,
            headers: input.listUnsubscribeUrl
                ? {
                    'List-Unsubscribe': `<${input.listUnsubscribeUrl}>`,
                    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                }
                : undefined,
            attachments: input.attachments?.map((attachment) => ({
                filename: attachment.filename,
                content: attachment.content,
                type: attachment.contentType || 'application/octet-stream',
                disposition: 'attachment',
            })),
        });

        return {
            ok: true,
            provider: 'sendgrid',
            emailId: response.headers['x-message-id'] as string | undefined,
        };
    } catch (error: unknown) {
        const msg =
            typeof error === 'object' &&
            error !== null &&
            'response' in error &&
            typeof (error as { response?: { body?: unknown } }).response?.body !== 'undefined'
                ? JSON.stringify((error as { response?: { body?: unknown } }).response?.body)
                : error instanceof Error
                    ? error.message
                    : 'SendGrid send failed';

        return { ok: false, provider: 'sendgrid', error: msg };
    }
}

async function sendViaBrevo(input: EmailSendInput): Promise<EmailSendResult> {
    try {
        const brevoModule = (await import('@getbrevo/brevo')) as Record<string, unknown>;
        const maybeBrevoClient = brevoModule.BrevoClient as
            | (new (config: { apiKey: string }) => {
                transactionalEmails: {
                    sendTransacEmail: (payload: unknown) => Promise<{ messageId?: string }>;
                };
            })
            | undefined;

        if (maybeBrevoClient) {
            const client = new maybeBrevoClient({ apiKey: input.apiKey });
            const result = await client.transactionalEmails.sendTransacEmail({
                sender: { email: input.fromEmail, name: input.fromName },
                to: normalizeRecipients(input.to).map((email) => ({ email })),
                subject: input.subject,
                htmlContent: input.html,
                textContent: input.text,
                replyTo: input.replyTo ? { email: input.replyTo } : undefined,
                cc: input.cc?.map((email) => ({ email })),
                bcc: input.bcc?.map((email) => ({ email })),
                attachment: input.attachments?.map((attachment) => ({
                    name: attachment.filename,
                    content: attachment.content,
                })),
            });
            return { ok: true, provider: 'brevo', emailId: result.messageId };
        }

        const maybeApiClient = brevoModule.ApiClient as
            | { instance: { authentications: Record<string, { apiKey: string }> } }
            | undefined;
        const maybeTransactionalEmailsApi = brevoModule.TransactionalEmailsApi as
            | (new () => {
                sendTransacEmail: (payload: unknown) => Promise<{ body?: { messageId?: string } }>;
            })
            | undefined;

        if (!maybeApiClient || !maybeTransactionalEmailsApi) {
            return {
                ok: false,
                provider: 'brevo',
                error: 'Unsupported Brevo SDK shape',
            };
        }

        maybeApiClient.instance.authentications['api-key'].apiKey = input.apiKey;
        const legacyClient = new maybeTransactionalEmailsApi();
        const response = await legacyClient.sendTransacEmail({
            sender: { email: input.fromEmail, name: input.fromName },
            to: normalizeRecipients(input.to).map((email) => ({ email })),
            subject: input.subject,
            htmlContent: input.html,
            textContent: input.text,
            replyTo: input.replyTo ? { email: input.replyTo } : undefined,
            cc: input.cc?.map((email) => ({ email })),
            bcc: input.bcc?.map((email) => ({ email })),
            attachment: input.attachments?.map((attachment) => ({
                name: attachment.filename,
                content: attachment.content,
            })),
        });

        return { ok: true, provider: 'brevo', emailId: response.body?.messageId };
    } catch (error) {
        return {
            ok: false,
            provider: 'brevo',
            error: error instanceof Error ? error.message : 'Brevo send failed',
        };
    }
}

export async function sendWithProviderSdk(
    provider: EmailProvider,
    input: EmailSendInput
): Promise<EmailSendResult> {
    if (provider === 'resend') return sendViaResend(input);
    if (provider === 'sendgrid') return sendViaSendGrid(input);
    return sendViaBrevo(input);
}

