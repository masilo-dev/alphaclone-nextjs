type NodemailerModule = typeof import('nodemailer');
type ResendCtor = typeof import('resend').Resend;
type SendGridModule = typeof import('@sendgrid/mail');

let nodemailerCache: NodemailerModule | null | undefined;
let resendCtorCache: ResendCtor | null | undefined;
let sendGridCache: SendGridModule | null | undefined;

function loadNodemailer(): NodemailerModule | null {
  if (typeof window !== 'undefined') return null;
  if (nodemailerCache !== undefined) return nodemailerCache;
  try {
    nodemailerCache = require('nodemailer') as NodemailerModule;
  } catch (err) {
    console.warn('[providerSdk] nodemailer unavailable:', err instanceof Error ? err.message : err);
    nodemailerCache = null;
  }
  return nodemailerCache;
}

function loadResendCtor(): ResendCtor | null {
  if (typeof window !== 'undefined') return null;
  if (resendCtorCache !== undefined) return resendCtorCache;
  try {
    resendCtorCache = require('resend').Resend as ResendCtor;
  } catch (err) {
    console.warn('[providerSdk] resend unavailable:', err instanceof Error ? err.message : err);
    resendCtorCache = null;
  }
  return resendCtorCache;
}

function loadSendGrid(): SendGridModule | null {
  if (typeof window !== 'undefined') return null;
  if (sendGridCache !== undefined) return sendGridCache;
  try {
    sendGridCache = require('@sendgrid/mail') as SendGridModule;
  } catch (err) {
    console.warn('[providerSdk] sendgrid unavailable:', err instanceof Error ? err.message : err);
    sendGridCache = null;
  }
  return sendGridCache;
}

import { ZohoMailService } from '@/services/zoho/ZohoMailService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { syncExternalMessageAdmin, resolveContactByEmailAdmin } from '@/services/unified/unifiedMessageAdmin';

export type EmailProvider = 'brevo' | 'sendgrid' | 'resend' | 'zoho' | 'gmail' | 'mailflow' | 'outlook' | 'smtp';

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
    // SMTP-specific
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
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
        const Resend = loadResendCtor();
        if (!Resend) {
            return { ok: false, provider: 'resend', error: 'Resend is not available in this environment' };
        }
        const resend = new Resend(input.apiKey);
        const resendPayload: Record<string, unknown> = {
            from: input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail,
            to: normalizeRecipients(input.to),
            subject: input.subject,
        };
        if (input.listUnsubscribeUrl) {
            resendPayload.headers = {
                'List-Unsubscribe': `<${input.listUnsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            };
        }
        if (input.html) resendPayload.html = input.html;
        if (input.text) resendPayload.text = input.text;
        if (!input.html && !input.text) resendPayload.text = '';
        if (input.replyTo) resendPayload.replyTo = input.replyTo;
        if (input.cc?.length) resendPayload.cc = input.cc;
        if (input.bcc?.length) resendPayload.bcc = input.bcc;

        const { data, error } = await resend.emails.send(
            {
                ...(resendPayload as any),
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
        const sgMail = loadSendGrid();
        if (!sgMail) {
            return { ok: false, provider: 'sendgrid', error: 'SendGrid is not available in this environment' };
        }
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
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': input.apiKey,
            },
            body: JSON.stringify({
            sender: { email: input.fromEmail, name: input.fromName },
            to: normalizeRecipients(input.to).map((email) => ({ email })),
            subject: input.subject,
            htmlContent: input.html,
            textContent: input.text,
            replyTo: input.replyTo ? { email: input.replyTo } : undefined,
            cc: input.cc?.map((email) => ({ email })),
            bcc: input.bcc?.map((email) => ({ email })),
            headers: input.listUnsubscribeUrl
                ? {
                    'List-Unsubscribe': `<${input.listUnsubscribeUrl}>`,
                    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                }
                : undefined,
            attachment: input.attachments?.map((attachment) => ({
                name: attachment.filename,
                content: attachment.content instanceof Buffer ? attachment.content.toString('base64') : String(attachment.content),
            })),
            }),
        });

        const bodyText = await response.text();
        if (!response.ok) {
            return { ok: false, provider: 'brevo', error: bodyText || `Brevo rejected request (${response.status})` };
        }
        const body = bodyText ? JSON.parse(bodyText) : {};
        return { ok: true, provider: 'brevo', emailId: body.messageId };
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
            toAddress: recipients.join(','),
            subject: input.subject,
            content: input.html || input.text || '',
            ccAddress: input.cc?.join(','),
            bccAddress: input.bcc?.join(','),
            attachments: input.attachments?.map((attachment) => ({
                filename: attachment.filename,
                content: attachment.content instanceof Buffer ? attachment.content.toString('base64') : String(attachment.content),
                contentType: attachment.contentType || 'application/octet-stream',
            })),
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

        const nodemailer = loadNodemailer();
        if (!nodemailer) {
            return { ok: false, provider: 'gmail', error: 'Nodemailer is not available in this environment' };
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

        const mailOptions: any = {
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
        if (input.listUnsubscribeUrl) {
            mailOptions.headers = {
                'List-Unsubscribe': `<${input.listUnsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            };
        }

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

async function sendViaOutlook(input: EmailSendInput): Promise<EmailSendResult> {
    try {
        if (!input.userId) {
            return { ok: false, provider: 'outlook', error: 'Outlook send requires userId (OAuth context)' };
        }
        // Use Microsoft Graph API via nodemailer-like approach or direct fetch
        // Credentials resolved from Supabase tenant integrations at runtime
        const supabaseAdmin = createSupabaseAdminClient();
        const { data: integration } = await supabaseAdmin
            .from('integrations')
            .select('config')
            .eq('user_id', input.userId)
            .eq('type', 'outlook')
            .maybeSingle();

        const accessToken = integration?.config?.access_token;
        if (!accessToken) {
            return { ok: false, provider: 'outlook', error: 'No Outlook OAuth token found for user' };
        }

        const recipients = normalizeRecipients(input.to);
        const graphPayload = {
            message: {
                subject: input.subject,
                body: { contentType: input.html ? 'HTML' : 'Text', content: input.html || input.text || '' },
                toRecipients: recipients.map(addr => ({ emailAddress: { address: addr } })),
                ...(input.cc?.length ? { ccRecipients: input.cc.map(addr => ({ emailAddress: { address: addr } })) } : {}),
                ...(input.bcc?.length ? { bccRecipients: input.bcc.map(addr => ({ emailAddress: { address: addr } })) } : {}),
                ...(input.replyTo ? { replyTo: [{ emailAddress: { address: input.replyTo } }] } : {}),
            },
            saveToSentItems: true,
        };

        const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(graphPayload),
        });

        if (!response.ok) {
            const errText = await response.text();
            return { ok: false, provider: 'outlook', error: errText };
        }

        return { ok: true, provider: 'outlook' };
    } catch (error) {
        return {
            ok: false,
            provider: 'outlook',
            error: error instanceof Error ? error.message : 'Outlook send failed',
        };
    }
}

async function sendViaSmtp(input: EmailSendInput): Promise<EmailSendResult> {
    try {
        const host = input.smtpHost;
        const port = input.smtpPort || 587;
        const user = input.smtpUser;
        const pass = input.smtpPass || input.apiKey;

        if (!host) {
            return { ok: false, provider: 'smtp', error: 'SMTP host not configured' };
        }

        const nodemailer = loadNodemailer();
        if (!nodemailer) {
            return { ok: false, provider: 'smtp', error: 'Nodemailer is not available in this environment' };
        }

        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: user ? { user, pass } : undefined,
        });

        const recipients = normalizeRecipients(input.to);
        const mailOptions: any = {
            from: input.fromName ? `"${input.fromName}" <${input.fromEmail}>` : input.fromEmail,
            to: recipients.join(', '),
            subject: input.subject,
            html: input.html,
            text: input.text,
        };

        if (input.replyTo) mailOptions.replyTo = input.replyTo;
        if (input.cc?.length) mailOptions.cc = input.cc.join(', ');
        if (input.bcc?.length) mailOptions.bcc = input.bcc.join(', ');
        if (input.attachments?.length) {
            mailOptions.attachments = input.attachments.map(att => ({
                filename: att.filename,
                content: att.content instanceof Buffer ? att.content : Buffer.from(String(att.content), 'base64'),
                contentType: att.contentType || 'application/octet-stream',
            }));
        }

        const info = await transporter.sendMail(mailOptions);
        return { ok: true, provider: 'smtp', emailId: info.messageId };
    } catch (error) {
        return {
            ok: false,
            provider: 'smtp',
            error: error instanceof Error ? error.message : 'SMTP send failed',
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
    let result: EmailSendResult;
    if (provider === 'resend') result = await sendViaResend(input);
    else if (provider === 'sendgrid') result = await sendViaSendGrid(input);
    else if (provider === 'zoho') result = await sendViaZoho(input);
    else if (provider === 'gmail') result = await sendViaGmail(input);
    else if (provider === 'mailflow') result = await sendViaMailflow(input);
    else if (provider === 'outlook') result = await sendViaOutlook(input);
    else if (provider === 'smtp') result = await sendViaSmtp(input);
    else result = await sendViaBrevo(input);

    // Sync successfully sent external emails to unified_messages
    if (result.ok && input.userId) {
        try {
            const supabaseAdmin = createSupabaseAdminClient();
            // Resolve tenantId
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('tenant_id')
                .eq('id', input.userId)
                .maybeSingle();

            let tenantId = profile?.tenant_id;
            if (!tenantId) {
                const { data: membership } = await supabaseAdmin
                    .from('tenant_users')
                    .select('tenant_id')
                    .eq('user_id', input.userId)
                    .maybeSingle();
                tenantId = membership?.tenant_id;
            }

            if (tenantId) {
                const recipients = Array.isArray(input.to) ? input.to : [input.to];
                for (const recipient of recipients) {
                    const cleanRecipient = String(recipient || '').trim().toLowerCase();
                    if (!cleanRecipient) continue;

                    const { contact_id, company_id } = await resolveContactByEmailAdmin(
                        supabaseAdmin,
                        tenantId,
                        cleanRecipient
                    );

                    await syncExternalMessageAdmin(supabaseAdmin, {
                        tenant_id: tenantId,
                        contact_id,
                        company_id,
                        source: provider as any,
                        external_id: result.emailId || `${provider}-outbound-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        direction: 'outbound',
                        channel: 'email',
                        subject: input.subject,
                        body: input.text || input.html?.replace(/<[^>]*>/g, '') || '',
                        html_body: input.html,
                        from_address: input.fromEmail,
                        to_address: cleanRecipient,
                        sent_at: new Date().toISOString(),
                    });
                }
            }
        } catch (syncErr) {
            console.error('[providerSdk] Failed to sync outbound email to unified_messages:', syncErr);
        }
    }

    return result;
}
