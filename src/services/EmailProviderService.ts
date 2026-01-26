import { toast } from 'react-hot-toast';

export interface EmailPayload {
    to: string;
    subject: string;
    html: string;
    text?: string;
    from?: string;
    fromName?: string;
    replyTo?: string;
}

/**
 * Unified Email Provider Service
 * Handles actual delivery via Resend or SendGrid
 */
export const emailProviderService = {
    /**
     * Send email via selected provider
     */
    async sendEmail(payload: EmailPayload): Promise<{ success: boolean; error: string | null }> {
        const apiKey = process.env.NEXT_PUBLIC_RESEND_API_KEY;

        if (!apiKey) {
            console.warn('Email Provider Not Configured: Missing NEXT_PUBLIC_RESEND_API_KEY');
            // For development/demo, we'll log it and return success if it's a mock environment
            // but in production this is a real failure.
            return {
                success: false,
                error: 'Email service not configured. Please add your Resend API Key.'
            };
        }

        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    from: payload.from || `${payload.fromName || 'AlphaClone Systems'} <onboarding@resend.dev>`,
                    to: payload.to,
                    subject: payload.subject,
                    html: payload.html,
                    text: payload.text,
                    reply_to: payload.replyTo
                }),
            });

            const data = await response.json();

            if (response.ok) {
                console.log('✅ Email sent successfully:', data.id);
                return { success: true, error: null };
            } else {
                console.error('❌ Email failed:', data);
                return { success: false, error: data.message || 'Failed to send email' };
            }
        } catch (err) {
            console.error('❌ Email unexpected error:', err);
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Unknown email error'
            };
        }
    }
};
