import { createHmac } from 'crypto';
import { supabase } from '../../lib/supabase';

/**
 * Webhook Delivery Service
 * Sends webhooks to external systems with retry logic
 */

export interface WebhookEvent {
    type: string;
    data: any;
    tenantId: string;
    timestamp: string;
}

export interface WebhookDelivery {
    id: string;
    webhookId: string;
    eventType: string;
    payload: any;
    status: 'pending' | 'delivered' | 'failed';
    attempts: number;
    maxAttempts: number;
    lastAttemptAt?: string;
    nextRetryAt?: string;
    responseStatus?: number;
    responseBody?: string;
    errorMessage?: string;
}

export const WEBHOOK_EVENTS = {
    // Tenant events
    TENANT_CREATED: 'tenant.created',
    TENANT_UPDATED: 'tenant.updated',
    TENANT_DELETED: 'tenant.deleted',

    // User events
    USER_INVITED: 'user.invited',
    USER_JOINED: 'user.joined',
    USER_REMOVED: 'user.removed',

    // Project events
    PROJECT_CREATED: 'project.created',
    PROJECT_UPDATED: 'project.updated',
    PROJECT_COMPLETED: 'project.completed',
    PROJECT_DELETED: 'project.deleted',

    // Contract events
    CONTRACT_CREATED: 'contract.created',
    CONTRACT_SIGNED: 'contract.signed',
    CONTRACT_EXPIRED: 'contract.expired',

    // Invoice events
    INVOICE_CREATED: 'invoice.created',
    INVOICE_PAID: 'invoice.paid',
    INVOICE_OVERDUE: 'invoice.overdue',

    // Subscription events
    SUBSCRIPTION_CREATED: 'subscription.created',
    SUBSCRIPTION_UPDATED: 'subscription.updated',
    SUBSCRIPTION_CANCELED: 'subscription.canceled',
    SUBSCRIPTION_RENEWED: 'subscription.renewed',

    // Payment events
    PAYMENT_SUCCEEDED: 'payment.succeeded',
    PAYMENT_FAILED: 'payment.failed',
};

export const webhookService = {
    /**
     * Send webhook to all registered endpoints for event type
     */
    async sendWebhook(
        tenantId: string,
        eventType: string,
        data: any
    ): Promise<void> {
        try {
            // Get all webhooks for this tenant that listen to this event
            const { data: webhooks, error } = await supabase
                .from('notification_webhooks')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('enabled', true)
                .contains('event_types', [eventType]);

            if (error) throw error;
            if (!webhooks || webhooks.length === 0) {
                console.log(`No webhooks registered for ${eventType}`);
                return;
            }

            // Create webhook event payload
            const event: WebhookEvent = {
                type: eventType,
                data,
                tenantId,
                timestamp: new Date().toISOString(),
            };

            // Send to all registered webhooks
            for (const webhook of webhooks) {
                await this.deliverWebhook(webhook.id, webhook.url, webhook.secret, event);
            }
        } catch (error) {
            console.error('Error sending webhook:', error);
        }
    },

    /**
     * Deliver webhook to specific endpoint
     */
    async deliverWebhook(
        webhookId: string,
        url: string,
        secret: string,
        event: WebhookEvent
    ): Promise<boolean> {
        try {
            // Generate signature
            const signature = this.generateSignature(JSON.stringify(event), secret);

            // Send HTTP POST request
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-AlphaClone-Signature': signature,
                    'X-AlphaClone-Event': event.type,
                    'X-AlphaClone-Timestamp': event.timestamp,
                },
                body: JSON.stringify(event),
            });

            const success = response.ok;

            // Update webhook last triggered
            if (success) {
                await supabase
                    .from('notification_webhooks')
                    .update({
                        last_triggered_at: new Date().toISOString(),
                        failure_count: 0,
                    })
                    .eq('id', webhookId);
            } else {
                await supabase
                    .from('notification_webhooks')
                    .update({
                        failure_count: supabase.sql`failure_count + 1`,
                    })
                    .eq('id', webhookId);
            }

            // Log delivery (optional - could be stored in webhook_deliveries table)
            console.log(`Webhook ${webhookId} delivery:`, {
                success,
                status: response.status,
                event: event.type,
            });

            return success;
        } catch (error) {
            console.error('Error delivering webhook:', error);

            // Increment failure count
            await supabase
                .from('notification_webhooks')
                .update({
                    failure_count: supabase.sql`failure_count + 1`,
                })
                .eq('id', webhookId);

            return false;
        }
    },

    /**
     * Generate HMAC signature for webhook verification
     */
    generateSignature(payload: string, secret: string): string {
        return createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
    },

    /**
     * Verify webhook signature (for receiving webhooks from external services)
     */
    verifySignature(payload: string, signature: string, secret: string): boolean {
        const expectedSignature = this.generateSignature(payload, secret);
        return signature === expectedSignature;
    },

    /**
     * Retry failed webhook deliveries with exponential backoff
     */
    async retryFailedWebhooks(): Promise<void> {
        // This would be called by a cron job
        // Get webhooks with failures
        const { data: webhooks } = await supabase
            .from('notification_webhooks')
            .select('*')
            .gt('failure_count', 0)
            .lt('failure_count', 5) // Max 5 retries
            .eq('enabled', true);

        if (!webhooks) return;

        for (const webhook of webhooks) {
            // Exponential backoff: 1min, 5min, 15min, 1hr, 6hr
            const backoffMinutes = [1, 5, 15, 60, 360][webhook.failure_count - 1] || 360;
            const lastTriggered = new Date(webhook.last_triggered_at || 0);
            const now = new Date();
            const minutesSinceLastAttempt =
                (now.getTime() - lastTriggered.getTime()) / 1000 / 60;

            if (minutesSinceLastAttempt >= backoffMinutes) {
                // Retry webhook
                console.log(`Retrying webhook ${webhook.id}`);
                // Would need to get the last failed event and retry it
            }
        }
    },

    /**
     * Register new webhook
     */
    async registerWebhook(
        tenantId: string,
        name: string,
        url: string,
        eventTypes: string[],
        secret?: string
    ): Promise<{ success: boolean; webhookId?: string; error?: string }> {
        try {
            // Generate secret if not provided
            const webhookSecret =
                secret || this.generateSignature(url + Date.now(), 'webhook-secret');

            const { data, error } = await supabase
                .from('notification_webhooks')
                .insert({
                    tenant_id: tenantId,
                    name,
                    url,
                    secret: webhookSecret,
                    event_types: eventTypes,
                    enabled: true,
                })
                .select('id')
                .single();

            if (error) throw error;

            return {
                success: true,
                webhookId: data.id,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to register webhook',
            };
        }
    },

    /**
     * Test webhook delivery
     */
    async testWebhook(webhookId: string): Promise<boolean> {
        try {
            const { data: webhook } = await supabase
                .from('notification_webhooks')
                .select('*')
                .eq('id', webhookId)
                .single();

            if (!webhook) throw new Error('Webhook not found');

            const testEvent: WebhookEvent = {
                type: 'webhook.test',
                data: { message: 'This is a test webhook' },
                tenantId: webhook.tenant_id,
                timestamp: new Date().toISOString(),
            };

            return await this.deliverWebhook(
                webhook.id,
                webhook.url,
                webhook.secret,
                testEvent
            );
        } catch (error) {
            console.error('Error testing webhook:', error);
            return false;
        }
    },

    /**
     * Get webhook delivery logs
     */
    async getWebhookLogs(webhookId: string, limit: number = 100): Promise<any[]> {
        // Would query webhook_deliveries table if we had one
        // For now, return empty array
        return [];
    },
};

/**
 * Common webhook payload examples for documentation
 */
export const WEBHOOK_EXAMPLES = {
    'tenant.created': {
        type: 'tenant.created',
        data: {
            id: 'tenant-123',
            name: 'Acme Corp',
            subscription_plan: 'pro',
            created_at: '2026-02-09T12:00:00Z',
        },
        tenantId: 'tenant-123',
        timestamp: '2026-02-09T12:00:00Z',
    },
    'user.invited': {
        type: 'user.invited',
        data: {
            email: 'user@example.com',
            role: 'client',
            invited_by: 'admin@example.com',
        },
        tenantId: 'tenant-123',
        timestamp: '2026-02-09T12:00:00Z',
    },
    'project.completed': {
        type: 'project.completed',
        data: {
            id: 'project-456',
            name: 'Website Redesign',
            completed_at: '2026-02-09T12:00:00Z',
            duration_days: 45,
        },
        tenantId: 'tenant-123',
        timestamp: '2026-02-09T12:00:00Z',
    },
    'invoice.paid': {
        type: 'invoice.paid',
        data: {
            id: 'invoice-789',
            amount: 5000,
            currency: 'USD',
            paid_at: '2026-02-09T12:00:00Z',
            payment_method: 'card',
        },
        tenantId: 'tenant-123',
        timestamp: '2026-02-09T12:00:00Z',
    },
};
