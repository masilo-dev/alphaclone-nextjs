/**
 * Email Service
 * Handles all transactional and marketing emails
 *
 * Supports:
 * - Brevo
 * - SendGrid
 * - Resend
 */
import { sendWithProviderSdk, type EmailProvider } from '@/lib/email/providerSdk';

export interface EmailOptions {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    replyTo?: string;
    cc?: string[];
    bcc?: string[];
    attachments?: EmailAttachment[];
}

export interface EmailAttachment {
    filename: string;
    content: Buffer | string;
    contentType?: string;
}

export interface EmailTemplate {
    name: string;
    subject: string;
    html: string;
    variables: string[];
}

// Common email templates
export const EMAIL_TEMPLATES = {
    // Auth emails
    WELCOME: 'welcome',
    PASSWORD_RESET: 'password_reset',
    EMAIL_VERIFICATION: 'email_verification',
    TWO_FACTOR_CODE: 'two_factor_code',

    // Invitation emails
    TEAM_INVITATION: 'team_invitation',
    PROJECT_INVITATION: 'project_invitation',

    // Notification emails
    PROJECT_ASSIGNED: 'project_assigned',
    TASK_ASSIGNED: 'task_assigned',
    PROJECT_COMPLETED: 'project_completed',
    CONTRACT_SIGNED: 'contract_signed',

    // Billing emails
    INVOICE_CREATED: 'invoice_created',
    INVOICE_PAID: 'invoice_paid',
    INVOICE_OVERDUE: 'invoice_overdue',
    PAYMENT_FAILED: 'payment_failed',
    SUBSCRIPTION_RENEWED: 'subscription_renewed',
    SUBSCRIPTION_CANCELED: 'subscription_canceled',

    // Usage alerts
    QUOTA_WARNING: 'quota_warning',
    QUOTA_EXCEEDED: 'quota_exceeded',
    UPGRADE_REMINDER: 'upgrade_reminder',

    // Digest emails
    WEEKLY_DIGEST: 'weekly_digest',
    MONTHLY_REPORT: 'monthly_report',
};

class EmailService {
    private provider: EmailProvider;
    private defaultFrom: string;

    constructor() {
        // Determine provider based on environment variables
        if (process.env.BREVO_API_KEY || process.env.BREVO_PLATFORM_API_KEY) {
            this.provider = 'brevo';
        } else if (process.env.SENDGRID_API_KEY) {
            this.provider = 'sendgrid';
        } else if (process.env.RESEND_API_KEY) {
            this.provider = 'resend';
        } else {
            this.provider = 'resend';
        }

        this.defaultFrom = process.env.EMAIL_FROM || 'noreply@alphaclone.com';
    }

    /**
     * Send email
     */
    async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
        try {
            switch (this.provider) {
                case 'brevo':
                    return await this.sendWithBrevo(options);
                case 'resend':
                    return await this.sendWithResend(options);
                case 'sendgrid':
                    return await this.sendWithSendGrid(options);
                default:
                    throw new Error('No email provider configured');
            }
        } catch (error) {
            console.error('Error sending email:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to send email',
            };
        }
    }

    private async sendWithBrevo(options: EmailOptions) {
        const apiKey = process.env.BREVO_API_KEY || process.env.BREVO_PLATFORM_API_KEY;
        if (!apiKey) {
            throw new Error('BREVO_API_KEY not configured');
        }

        const result = await sendWithProviderSdk('brevo', {
            apiKey,
            fromEmail: options.from || process.env.BREVO_FROM_EMAIL || this.defaultFrom,
            fromName: 'AlphaClone Systems',
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            replyTo: options.replyTo,
            cc: options.cc,
            bcc: options.bcc,
        });

        if (!result.ok) {
            throw new Error(`Brevo SDK error: ${result.error || 'unknown error'}`);
        }

        return { success: true };
    }

    /**
     * Send email using Resend (recommended)
     */
    private async sendWithResend(options: EmailOptions) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            throw new Error('RESEND_API_KEY not configured');
        }

        const result = await sendWithProviderSdk('resend', {
            apiKey,
            fromEmail: options.from || this.defaultFrom,
            fromName: 'AlphaClone Systems',
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            replyTo: options.replyTo,
            cc: options.cc,
            bcc: options.bcc,
        });

        if (!result.ok) {
            throw new Error(`Resend SDK error: ${result.error || 'unknown error'}`);
        }

        return { success: true };
    }

    /**
     * Send email using SendGrid
     */
    private async sendWithSendGrid(options: EmailOptions) {
        const apiKey = process.env.SENDGRID_API_KEY;
        if (!apiKey) {
            throw new Error('SENDGRID_API_KEY not configured');
        }

        const result = await sendWithProviderSdk('sendgrid', {
            apiKey,
            fromEmail: options.from || this.defaultFrom,
            fromName: 'AlphaClone Systems',
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            replyTo: options.replyTo,
            cc: options.cc,
            bcc: options.bcc,
        });

        if (!result.ok) {
            throw new Error(`SendGrid SDK error: ${result.error || 'unknown error'}`);
        }

        return { success: true };
    }

    /**
     * Send email from template
     */
    async sendTemplate(
        template: string,
        to: string | string[],
        variables: Record<string, any>
    ): Promise<{ success: boolean; error?: string }> {
        const emailTemplate = this.getTemplate(template);

        if (!emailTemplate) {
            return {
                success: false,
                error: `Template ${template} not found`,
            };
        }

        // Replace variables in template
        let html = emailTemplate.html;
        let subject = emailTemplate.subject;

        Object.entries(variables).forEach(([key, value]) => {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(placeholder, String(value));
            subject = subject.replace(placeholder, String(value));
        });

        return this.send({
            to,
            subject,
            html,
        });
    }

    /**
     * Get email template
     */
    private getTemplate(name: string): EmailTemplate | null {
        // In production, load from database or file system
        // For now, return inline templates
        const templates: Record<string, EmailTemplate> = {
            [EMAIL_TEMPLATES.WELCOME]: {
                name: 'welcome',
                subject: 'Welcome to AlphaClone!',
                html: `
                    <h1>Welcome {{name}}!</h1>
                    <p>Thanks for joining AlphaClone. We're excited to have you onboard!</p>
                    <p>Get started by creating your first project:</p>
                    <a href="{{dashboard_url}}" style="background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        Go to Dashboard
                    </a>
                `,
                variables: ['name', 'dashboard_url'],
            },
            [EMAIL_TEMPLATES.PASSWORD_RESET]: {
                name: 'password_reset',
                subject: 'Reset Your Password',
                html: `
                    <h1>Reset Your Password</h1>
                    <p>We received a request to reset your password for {{email}}.</p>
                    <p>Click the button below to reset your password:</p>
                    <a href="{{reset_url}}" style="background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        Reset Password
                    </a>
                    <p style="margin-top: 20px; color: #666;">This link expires in 1 hour.</p>
                    <p style="color: #666;">If you didn't request this, you can safely ignore this email.</p>
                `,
                variables: ['email', 'reset_url'],
            },
            [EMAIL_TEMPLATES.INVOICE_PAID]: {
                name: 'invoice_paid',
                subject: 'Payment Received - Invoice {{invoice_number}}',
                html: `
                    <h1>Payment Received</h1>
                    <p>Thank you for your payment!</p>
                    <p>We've received your payment of <strong>{{amount}}</strong> for invoice {{invoice_number}}.</p>
                    <p>You can view your invoice and receipt here:</p>
                    <a href="{{invoice_url}}" style="background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        View Invoice
                    </a>
                `,
                variables: ['invoice_number', 'amount', 'invoice_url'],
            },
            [EMAIL_TEMPLATES.QUOTA_WARNING]: {
                name: 'quota_warning',
                subject: 'Usage Alert: Approaching {{quota_type}} Limit',
                html: `
                    <h1>⚠️ Usage Alert</h1>
                    <p>You're using <strong>{{usage_percent}}%</strong> of your {{quota_type}} quota.</p>
                    <p>Current usage: {{current_usage}} / {{limit}}</p>
                    <p>To avoid interruption, consider upgrading your plan:</p>
                    <a href="{{upgrade_url}}" style="background: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        View Upgrade Options
                    </a>
                `,
                variables: ['quota_type', 'usage_percent', 'current_usage', 'limit', 'upgrade_url'],
            },
        };

        return templates[name] || null;
    }

    /**
     * Send bulk emails (for marketing/announcements)
     */
    async sendBulk(
        recipients: string[],
        subject: string,
        html: string
    ): Promise<{ success: boolean; sent: number; failed: number }> {
        let sent = 0;
        let failed = 0;

        // Send in batches of 50
        const batchSize = 50;
        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);

            try {
                await this.send({
                    to: batch,
                    subject,
                    html,
                });
                sent += batch.length;
            } catch (error) {
                console.error('Batch send failed:', error);
                failed += batch.length;
            }

            // Rate limiting - wait 100ms between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return { success: sent > 0, sent, failed };
    }
}

// Singleton instance
export const emailService = new EmailService();

/**
 * Common email helpers
 */
export const emailHelpers = {
    /**
     * Send welcome email
     */
    async sendWelcome(email: string, name: string, dashboardUrl: string) {
        return emailService.sendTemplate(EMAIL_TEMPLATES.WELCOME, email, {
            name,
            dashboard_url: dashboardUrl,
        });
    },

    /**
     * Send password reset email
     */
    async sendPasswordReset(email: string, resetUrl: string) {
        return emailService.sendTemplate(EMAIL_TEMPLATES.PASSWORD_RESET, email, {
            email,
            reset_url: resetUrl,
        });
    },

    /**
     * Send invoice paid notification
     */
    async sendInvoicePaid(
        email: string,
        invoiceNumber: string,
        amount: string,
        invoiceUrl: string
    ) {
        return emailService.sendTemplate(EMAIL_TEMPLATES.INVOICE_PAID, email, {
            invoice_number: invoiceNumber,
            amount,
            invoice_url: invoiceUrl,
        });
    },

    /**
     * Send quota warning
     */
    async sendQuotaWarning(
        email: string,
        quotaType: string,
        usagePercent: number,
        currentUsage: number,
        limit: number,
        upgradeUrl: string
    ) {
        return emailService.sendTemplate(EMAIL_TEMPLATES.QUOTA_WARNING, email, {
            quota_type: quotaType,
            usage_percent: usagePercent.toString(),
            current_usage: currentUsage.toString(),
            limit: limit.toString(),
            upgrade_url: upgradeUrl,
        });
    },
};
