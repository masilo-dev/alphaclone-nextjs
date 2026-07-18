/**
 * COMMUNICATION ENGINE
 * Modular outbound communication: SMS (Twilio), Email, Notifications
 * All channels share the same sendMessage(channel, payload) interface.
 */

export type Channel = 'sms' | 'email' | 'whatsapp' | 'notification';

export interface SMSPayload {
    to: string;
    message: string;
    from?: string;
    tenantId?: string;
    campaignId?: string;
    leadId?: string;
}

export interface EmailPayload {
    to: string;
    subject: string;
    body: string;
    from?: string;
    tenantId?: string;
}

export interface WhatsAppPayload {
    tenantId: string;
    phone: string;
    message: string;
    integrationId?: string;
}

export interface NotificationPayload {
    tenantId: string;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    userId?: string;
}

export type MessagePayload = SMSPayload | EmailPayload | WhatsAppPayload | NotificationPayload;

/** Unified send interface — routes to correct channel handler */
export async function sendMessage(channel: Channel, payload: MessagePayload): Promise<{ success: boolean; sid?: string; error?: string }> {
    switch (channel) {
        case 'sms':       return sendSMS(payload as SMSPayload);
        case 'email':     return sendEmail(payload as EmailPayload);
        case 'whatsapp':  return sendWhatsApp(payload as WhatsAppPayload);
        case 'notification': return sendNotification(payload as NotificationPayload);
        default:
            return { success: false, error: `Unsupported communication channel: ${String(channel)}` };
    }
}

async function sendWhatsApp(payload: WhatsAppPayload): Promise<{ success: boolean; sid?: string; error?: string }> {
    const res = await fetch('/api/integrations/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok && data.success !== false, sid: data.messageId || data.sid, error: res.ok ? undefined : data.error || 'WhatsApp delivery failed' };
}

async function sendSMS(payload: SMSPayload): Promise<{ success: boolean; sid?: string; error?: string }> {
    const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return res.json();
}

async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/communications/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return res.json();
}

async function sendNotification(payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return res.json();
}

/** Validate a phone number — basic E.164 check */
export function validatePhoneNumber(phone: string): boolean {
    return /^\+?[1-9]\d{6,14}$/.test(phone.replace(/[\s\-().]/g, ''));
}

/** Normalize to E.164 format (best-effort) */
export function normalizePhoneNumber(phone: string, defaultCountryCode = '1'): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('00')) return `+${digits.slice(2)}`;
    if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
    if (digits.length > 10) return `+${digits}`;
    return phone;
}
