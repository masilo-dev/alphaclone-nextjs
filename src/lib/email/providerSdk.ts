import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import sgMail from '@sendgrid/mail';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';

export type EmailProvider = 'brevo' | 'sendgrid' | 'resend' | 'zoho' | 'gmail' | 'mailflow';

export type EmailSendInput = {
    apiKey: string;          // For Gmail: App Password (stored in Supabase per-tenant, never global env)
    fromEmail: string;       // For Gmail: the Gmail address (also used as SMTP username)
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
        content: string | Buffer; // base64 string or raw Buffer
        contentType?: string;
    }>;
    userId?: string;
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
                // SendGrid requires base64 string content, not Buffer
                content: attachment.content instanceof Buffer
                    ? attachment.content.toString('base64')
                    : String(attachment.content),
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

async function sendViaZoho(input: EmailSendInput): Promise<EmailSendResult> {
    try {
        if (!input.userId) {
            return { ok: false, provider: 'zoho', error: 'Zoho send requires user context' };
        }
        const recipients = normalizeRecipients(input.to);
        if (!recipients.length) {
            return { ok: false, provider: 'zoho', error: 'Recipient is required' };
        }

        const zohoService = new ZohoMailService(input.userId);
        const result = await zohoService.sendEmail({
            fromAddress: input.fromEmail,
            toAddress: recipients[0],
            subject: input.subject,
            content: input.html || input.text || '',
        });

        return {
            ok: true,
            provider: 'zoho',
            emailId: String(result?.data?.messageId || ''),
        };
    } catch (error) {
        return {
            ok: false,
            provider: 'zoho',
            error: error instanceof Error ? error.message : 'Zoho send failed',
        };
    }
}

/**
 * Send via Gmail using SMTP + App Password (nodemailer).
 * No OAuth — authenticate with a Gmail App Password generated at:
 * https://myaccount.google.com/apppasswords
 *
 * Credentials are fetched from the tenant's Supabase integrations row:
 *   { type: 'gmail', config: { fromEmail: '...', appPassword: '...' } }
 * They are NEVER read from global environment variables.
 *
 * apiKey  = App Password (16-char Google App Password)
 * fromEmail = the Gmail address (used as both SMTP username and From address)
 */
async function sendViaGmail(input: EmailSendInput): Promise<EmailSendResult> {
    try {
        const recipients = normalizeRecipients(input.to);
        if (!recipients.length) {
            return { ok: false, provider: 'gmail', error: 'Recipient is required' };
        }

        if (!input.fromEmail) {
            return { ok: false, provider: 'gmail', error: 'Gmail requires fromEmail (your Gmail address)' };
        }

        if (!input.apiKey) {
            return { ok: false, provider: 'gmail', error: 'Gmail requires an App Password. Generate one at myaccount.google.com/apppasswords' };
        }

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // STARTTLS
            auth: {
                user: input.fromEmail,   // Gmail address
                pass: input.apiKey,      // App Password (never OAuth)
            },
        });

        const mailOptions: nodemailer.SendMailOptions = {
            from: input.fromName
                ? `"${input.fromName}" <${input.fromEmail}>`
                : input.fromEmail,
            to: recipients.join(', '),
            subject: input.subject,
            html: input.html,
            text: input.text,
        };

        if (input.replyTo) mailOptions.replyTo = input.replyTo;
        if (input.cc?.length) mailOptions.cc = input.cc.join(', ');
        if (input.bcc?.length) mailOptions.bcc = input.bcc.join(', ');

        if (input.attachments?.length) {
            mailOptions.attachments = input.attachments.map((att) => {
                // Normalise to Buffer for nodemailer
                const buf: Buffer = att.content instanceof Buffer
                    ? att.content
                    : Buffer.from(String(att.content), 'base64');
                return {
                    filename: att.filename,
                    content: buf,
                    contentType: att.contentType || 'application/octet-stream',
                };
            });
        }

        const info = await transporter.sendMail(mailOptions);

        return {
            ok: true,
            provider: 'gmail',
            emailId: info.messageId,
        };
    } catch (error) {
        return {
            ok: false,
            provider: 'gmail',
            error: error instanceof Error ? error.message : 'Gmail SMTP send failed',
        };
    }
}

async function sendViaMailflow(input: EmailSendInput): Promise<EmailSendResult> {
    try {
        const recipients = normalizeRecipients(input.to);
        const response = await fetch('https://api.mailflow.com/v1/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${input.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail,
                to: recipients,
                subject: input.subject,
                html: input.html,
                text: input.text,
                reply_to: input.replyTo
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { ok: false, provider: 'mailflow', error: errorText };
        }

        const data = await response.json();
        return { ok: true, provider: 'mailflow', emailId: data.id };
    } catch (error) {
        return {
            ok: false,
            provider: 'mailflow',
            error: error instanceof Error ? error.message : 'Mailflow send failed',
        };
    }
}

export async function sendWithProviderSdk(
    provider: EmailProvider,
    input: EmailSendInput
): Promise<EmailSendResult> {
    if (provider === 'resend') return sendViaResend(input);
    if (provider === 'sendgrid') return sendViaSendGrid(input);
    if (provider === 'zoho') return sendViaZoho(input);
    if (provider === 'gmail') return sendViaGmail(input);
    if (provider === 'mailflow') return sendViaMailflow(input);
    return sendViaBrevo(input);
}

