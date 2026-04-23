import type { SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { sendWithProviderSdk } from '@/lib/email/providerSdk';

export const USER_INITIATED_PLATFORM_TEMPLATES = new Set(['Welcome Email']);

export const SYSTEM_PLATFORM_TEMPLATES = new Set([
    'Welcome Email',
    'Daily Summary',
    'Stay In Touch',
    'Morning Briefing',
    'AI and Leads Status',
]);

export type PlatformTemplateEmailResult = {
    success: boolean;
    skipped?: boolean;
    error?: string;
    provider?: 'brevo' | 'sendgrid' | 'resend';
};

type TemplateRow = {
    subject: string;
    body_html: string;
    body_text: string | null;
};

function applyVariables(
    template: string,
    variables: Record<string, string | number>
): string {
    let out = template;
    Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        out = out.replace(regex, String(value));
    });
    return out;
}

async function resolveMailCredentials(
    supabase: SupabaseClient,
    userId?: string | null
): Promise<{
    apiKey: string | null;
    fromEmail: string;
    provider: 'brevo' | 'sendgrid' | 'resend';
}> {
    const globalBrevoApiKey =
        process.env.BREVO_PLATFORM_API_KEY ||
        process.env.BREVO_API_KEY ||
        null;
    const globalBrevoFromEmail =
        process.env.BREVO_PLATFORM_FROM_EMAIL ||
        process.env.BREVO_FROM_EMAIL ||
        'notifications@alphaclonesystems.com';
    if (globalBrevoApiKey) {
        return {
            apiKey: globalBrevoApiKey,
            fromEmail: globalBrevoFromEmail,
            provider: 'brevo',
        };
    }

    let apiKey: string | null = process.env.SENDGRID_API_KEY || null;
    let fromEmail =
        process.env.SENDGRID_FROM_EMAIL || 'notifications@alphaclonesystems.com';
    let provider: 'sendgrid' | 'resend' = 'sendgrid';

    if (userId) {
        const { data: integration } = await supabase
            .from('integrations')
            .select('config, enabled')
            .eq('user_id', userId)
            .eq('type', 'sendgrid')
            .eq('enabled', true)
            .maybeSingle();

        if (integration?.config?.apiKey) {
            apiKey = String(integration.config.apiKey);
            if (integration.config.fromEmail) {
                fromEmail = String(integration.config.fromEmail);
            }
        } else {
            apiKey = process.env.RESEND_API_KEY || null;
            provider = 'resend';
        }
    }

    if (provider === 'sendgrid' && !apiKey) {
        apiKey = process.env.RESEND_API_KEY || null;
        provider = 'resend';
    }

    return { apiKey, fromEmail, provider };
}

async function deliver(
    provider: 'brevo' | 'sendgrid' | 'resend',
    apiKey: string,
    fromEmail: string,
    to: string,
    subject: string,
    html: string,
    text: string
): Promise<{ ok: boolean; emailId?: string; error?: string }> {
    const result = await sendWithProviderSdk(provider, {
        apiKey,
        fromEmail,
        fromName: 'AlphaClone Systems',
        to,
        subject,
        html,
        text,
    });

    return { ok: result.ok, emailId: result.emailId, error: result.error };
}

async function logEmailSent(
    supabase: SupabaseClient,
    params: {
        tenantId: string | null;
        provider: 'brevo' | 'sendgrid' | 'resend';
        toEmail: string;
        subject: string;
        emailId?: string;
    }
): Promise<void> {
    try {
        await supabase.from('email_logs').insert({
            tenant_id: params.tenantId,
            provider: params.provider,
            to_email: params.toEmail,
            subject: params.subject,
            status: 'sent',
            email_id: params.emailId ?? null,
            created_at: new Date().toISOString(),
        });
    } catch (e) {
        console.warn('[platformTemplateEmail] email_logs insert skipped:', e);
    }
}

/**
 * Loads a global (tenant_id IS NULL) template and sends via platform or user SendGrid / Resend.
 */
export async function sendPlatformTemplateEmail(
    supabase: SupabaseClient,
    options: {
        templateName: string;
        to: string;
        variables: Record<string, string | number>;
        /** When set, SendGrid integration is resolved for this user before platform fallback. */
        credentialUserId?: string | null;
        templateAllowlist: Set<string>;
        skipIfWelcomeAlreadySent?: boolean;
        authUserId?: string | null;
    }
): Promise<PlatformTemplateEmailResult> {
    const {
        templateName,
        to,
        variables,
        credentialUserId,
        templateAllowlist,
        skipIfWelcomeAlreadySent,
        authUserId,
    } = options;

    if (!templateAllowlist.has(templateName)) {
        return { success: false, error: 'Template not allowed' };
    }

    if (skipIfWelcomeAlreadySent && templateName === 'Welcome Email' && authUserId) {
        const { data: authData, error: authErr } =
            await supabase.auth.admin.getUserById(authUserId);
        if (!authErr && authData.user?.user_metadata?.welcome_email_sent_at) {
            return { success: true, skipped: true };
        }
    }

    const { data: row, error: tErr } = await supabase
        .from('email_templates')
        .select('subject, body_html, body_text')
        .eq('name', templateName)
        .is('tenant_id', null)
        .maybeSingle();

    if (tErr || !row) {
        return { success: false, error: `Template not found: ${templateName}` };
    }

    const tpl = row as TemplateRow;
    const subject = applyVariables(tpl.subject, variables);
    const html = applyVariables(tpl.body_html, variables);
    const text = applyVariables(tpl.body_text ?? '', variables);

    const { apiKey, fromEmail, provider } = await resolveMailCredentials(
        supabase,
        credentialUserId ?? authUserId ?? null
    );

    if (!apiKey) {
        return { success: false, error: 'Email service not configured' };
    }

    const sent = await deliver(provider, apiKey, fromEmail, to, subject, html, text);
    if (!sent.ok) {
        console.error('[platformTemplateEmail] deliver failed:', sent.error);
        return { success: false, error: 'Delivery failed' };
    }

    await logEmailSent(supabase, {
        tenantId: null,
        provider,
        toEmail: to,
        subject,
        emailId: sent.emailId,
    });

    if (templateName === 'Welcome Email' && authUserId) {
        const { data: existing } = await supabase.auth.admin.getUserById(authUserId);
        const meta = existing?.user?.user_metadata ?? {};
        await supabase.auth.admin.updateUserById(authUserId, {
            user_metadata: {
                ...meta,
                welcome_email_sent_at: new Date().toISOString(),
            },
        });
    }

    return { success: true, provider };
}

export function defaultDashboardUrl(): string {
    return ENV.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';
}
