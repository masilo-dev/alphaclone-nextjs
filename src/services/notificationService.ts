import { supabase } from '../lib/supabase';
import { DailyCall } from '@daily-co/daily-js';
import { sendAuditToMeeting } from '../lib/meetingAudit';
import { tenantService } from './tenancy/TenantService';

// Global reference to the Daily call object (set by the meeting component)
let _dailyCallObject: DailyCall | null = null;

export function setDailyCallObject(callObject: DailyCall | null) {
    _dailyCallObject = callObject;
}

export interface Notification {
    id: string;
    userId: string;
    type: 'message' | 'project' | 'payment' | 'system' | 'alert' | 'task';
    title: string;
    message?: string;
    read: boolean;
    link?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    metadata: Record<string, any>;
    created_at: string;
}

export interface NotificationSubscription {
    unsubscribe: () => Promise<void>;
}

export const notificationService = {
    async sendNotification(params: {
        userId: string;
        type: 'message' | 'project' | 'payment' | 'system' | 'alert' | 'task';
        title: string;
        message?: string;
        link?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        metadata?: Record<string, any>;
    }) {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) return { success: false, error: 'No active workspace selected' };
        const response = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, ...params }) });
        const payload = await response.json().catch(() => ({}));

        // Send audit to meeting
        if (_dailyCallObject) {
            sendAuditToMeeting(_dailyCallObject, {
                source: 'notification',
                type: 'notification_sent',
                details: {
                    userId: params.userId,
                    type: params.type,
                    title: params.title,
                },
                timestamp: new Date().toISOString(),
            });
        }

        return { success: response.ok, error: response.ok ? undefined : payload.error || 'Notification could not be sent' };
    },

    async getNotifications(userId: string) {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) return { notifications: [], error: 'No active workspace selected' };
        const response = await fetch(`/api/notifications?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        return { notifications: response.ok ? payload.notifications as Notification[] || [] : [], error: response.ok ? undefined : payload.error || 'Notifications could not be loaded' };
    },

    async markAsRead(notificationId: string) {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) return { error: 'No active workspace selected' };
        const response = await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, ids: [notificationId], read: true }) });
        const payload = await response.json().catch(() => ({}));
        return { error: response.ok ? undefined : payload.error || 'Notification could not be updated' };
    },

    async markAllAsRead(userId: string) {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) return { error: 'No active workspace selected' };
        const loaded = await this.getNotifications(userId);
        const ids = loaded.notifications.filter((notification) => !notification.read).map((notification) => notification.id);
        if (!ids.length) return { error: loaded.error };
        const response = await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, ids, read: true }) });
        const payload = await response.json().catch(() => ({}));
        return { error: response.ok ? undefined : payload.error || 'Notifications could not be updated' };
    },

    async deleteNotification(notificationId: string) {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) return { error: 'No active workspace selected' };
        const response = await fetch(`/api/notifications?tenantId=${encodeURIComponent(tenantId)}&notificationId=${encodeURIComponent(notificationId)}`, { method: 'DELETE' });
        const payload = await response.json().catch(() => ({}));
        return { error: response.ok ? undefined : payload.error || 'Notification could not be deleted' };
    },

    /** Workspace-wide in-app + email announcement (owner/admin only). */
    async broadcastToTenant(params: {
        tenantId: string;
        title: string;
        message?: string;
        link?: string;
        email?: boolean;
        userIds?: string[];
    }) {
        const res = await fetch('/api/notifications/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { success: false, error: payload.error || 'Broadcast failed' };
        }
        return { success: true, ...payload };
    },

    // Subscribe to realtime notifications
    subscribe(userId: string, callback: (notification: Notification) => void): NotificationSubscription {
        const tenantId = tenantService.getCurrentTenantId();
        let channel: ReturnType<typeof supabase.channel> | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let stopped = false;
        let attempt = 0;

        const cleanupChannel = async () => {
            if (!channel) return;
            const stale = channel;
            channel = null;
            await supabase.removeChannel(stale);
        };

        const connect = async () => {
            if (stopped || !tenantId) return;
            await cleanupChannel();
            channel = supabase
            .channel(`notifications:${tenantId}:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `tenant_id=eq.${tenantId}`
                },
                (payload: any) => {
                    const notification = payload.new as Notification & { tenant_id?: string; user_id?: string };
                    if (notification.tenant_id === tenantId && notification.user_id === userId.trim()) {
                        callback(notification);
                    }
                }
            )
            .subscribe((status: string, err?: Error) => {
                if (status === 'SUBSCRIBED') {
                    attempt = 0;
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    if (stopped || retryTimer) return;
                    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt++, 5));
                    console.warn(`Notification subscription ${status.toLowerCase()}; retrying in ${delay}ms`, err?.message || '');
                    retryTimer = setTimeout(() => {
                        retryTimer = null;
                        void connect();
                    }, delay);
                }
            });
        };

        void connect();

        return {
            unsubscribe: async () => {
                stopped = true;
                if (retryTimer) clearTimeout(retryTimer);
                retryTimer = null;
                await cleanupChannel();
            },
        };
    },

    /**
     * AI-Powered Smart Notification
     * Generates a concise, high-impact summary of a task or event
     */
    async sendSmartNotification(params: {
        userId: string;
        type: 'task' | 'project' | 'alert';
        title: string;
        rawContext: string;
        link?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
    }) {
        try {
            const { generateText } = await import('./unifiedAIService');
            const prompt = `You are a high-performance productivity assistant. 
            Summarize the following context into a single, punchy, actionable notification sentence (max 15 words).
            
            CONTEXT: "${params.rawContext}"
            
            STRICT RULES:
            - No markdown.
            - No generic "You have a new task".
            - Focus on the "What" and "Why".`;

            const { text: summary } = await generateText(prompt, 100);
            
            return await this.sendNotification({
                userId: params.userId,
                type: params.type,
                title: params.title,
                message: summary || params.rawContext.substring(0, 100),
                link: params.link,
                priority: params.priority,
                metadata: { aiGenerated: true, originalContext: params.rawContext }
            });
        } catch (err) {
            // Fallback to standard notification
            return await this.sendNotification({
                userId: params.userId,
                type: params.type,
                title: params.title,
                message: params.rawContext.substring(0, 100),
                link: params.link,
                priority: params.priority
            });
        }
    },

    async unsubscribe(subscription: NotificationSubscription | ReturnType<typeof supabase.channel>) {
        if ('unsubscribe' in subscription && typeof subscription.unsubscribe === 'function') {
            await subscription.unsubscribe();
            return;
        }
        await supabase.removeChannel(subscription);
    },

    /**
     * Send a Platform-Wide Notification (Email + Internal)
     * Uses the BREVO_PLATFORM_API_KEY for emails.
     */
    async sendPlatformNotification(params: {
        userId: string;
        title: string;
        message: string;
        link?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        tenantId?: string;
    }) {
        // 1. Send internal notification
        await this.sendNotification({
            userId: params.userId,
            type: 'system',
            title: params.title,
            message: params.message,
            link: params.link,
            priority: params.priority || 'medium',
            metadata: { platformNotification: true }
        });

        // 2. Send platform-wide email via Brevo Platform Key
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('email, name')
                .eq('id', params.userId)
                .single();

            if (profile?.email && params.tenantId) {
                const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || '';
                const emailParams = {
                    tenantId: params.tenantId,
                    to: profile.email,
                    subject: params.title,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #0d9488;">AlphaClone Platform</h2>
                            <p>${params.message}</p>
                            ${params.link ? `<a href="${baseUrl}${params.link}" style="display: inline-block; padding: 10px 20px; background: #0d9488; color: white; text-decoration: none; border-radius: 5px;">View Update</a>` : ''}
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                            <small style="color: #666;">This is an automated platform notification.</small>
                        </div>
                    `,
                    isPlatformNotification: true
                };

                if (typeof window === 'undefined') {
                    const { sendEmailServer } = await import('@/lib/email/sendEmailServer');
                    await sendEmailServer(emailParams);
                } else {
                    await fetch(`${baseUrl}/api/email/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tenantId: params.tenantId,
                            to: profile.email,
                            subject: params.title,
                            body_html: emailParams.html,
                            isPlatformNotification: true,
                        }),
                    });
                }
            }
        } catch (err) {
            console.error('[sendPlatformNotification] Email failed:', err);
        }
    }
};
