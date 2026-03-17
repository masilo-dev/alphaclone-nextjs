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
     * Send email via secure server endpoint
     */
    async sendEmail(payload: EmailPayload): Promise<{ success: boolean; error: string | null }> {
        try {
            const response = await fetch('/api/email/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log('✅ Email sent successfully:', data.id);
                return { success: true, error: null };
            } else {
                console.error('❌ Email failed:', data);
                return { success: false, error: data.error || 'Failed to send email' };
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
