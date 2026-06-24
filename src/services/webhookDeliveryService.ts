/**
 * Webhook Delivery Service - 120% Feature
 * Reliable webhook delivery with retries, backoff, and dashboard
 */

import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface Webhook {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  responseStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  deliveredAt?: string;
  nextRetryAt?: string;
  createdAt: string;
}

// Retry configuration with exponential backoff
const RETRY_CONFIG = {
  maxAttempts: 5,
  initialDelay: 5000, // 5 seconds
  maxDelay: 3600000, // 1 hour
  backoffMultiplier: 2,
};

/**
 * Register a new webhook
 */
export async function registerWebhook(
  url: string,
  events: string[],
  secret?: string
): Promise<{ webhook: Webhook | null; error: string | null }> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) throw new Error('No tenant');

    // Validate URL
    try {
      new URL(url);
    } catch {
      return { webhook: null, error: 'Invalid URL format' };
    }

    // Check if webhook already exists
    const { data: existing } = await supabase
      .from('webhooks')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('url', url)
      .maybeSingle();

    if (existing) {
      return { webhook: null, error: 'Webhook already exists for this URL' };
    }

    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        tenant_id: tenantId,
        url,
        events,
        secret,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      webhook: {
        id: data.id,
        tenantId: data.tenant_id,
        url: data.url,
        events: data.events,
        secret: data.secret,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
      error: null,
    };
  } catch (err) {
    console.error('Failed to register webhook:', err);
    return { webhook: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Trigger webhook delivery
 */
export async function triggerWebhook(
  event: string,
  payload: any
): Promise<void> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) return;

    // Find active webhooks that subscribe to this event
    const { data: webhooks } = await supabase
      .from('webhooks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .contains('events', [event]);

    if (!webhooks || webhooks.length === 0) return;

    // Create delivery records
    for (const webhook of webhooks) {
      await supabase.from('webhook_deliveries').insert({
        webhook_id: webhook.id,
        event,
        payload: JSON.stringify(payload),
        status: 'pending',
        attempts: 0,
        created_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('Failed to trigger webhook:', err);
  }
}

/**
 * Process pending webhook deliveries
 * Should be called by a cron job every minute
 */
export async function processWebhookDeliveries(): Promise<{
  processed: number;
  delivered: number;
  failed: number;
}> {
  const stats = { processed: 0, delivered: 0, failed: 0 };

  try {
    // Get pending deliveries that are ready for retry
    const { data: deliveries } = await supabase
      .from('webhook_deliveries')
      .select(`
        *,
        webhooks(url, secret)
      `)
      .in('status', ['pending', 'retrying'])
      .or('next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}')
      .limit(100);

    if (!deliveries || deliveries.length === 0) return stats;

    for (const delivery of deliveries) {
      stats.processed++;

      try {
        const success = await attemptDelivery(delivery, delivery.webhooks);

        if (success) {
          stats.delivered++;
          await supabase
            .from('webhook_deliveries')
            .update({
              status: 'delivered',
              attempts: delivery.attempts + 1,
              delivered_at: new Date().toISOString(),
            })
            .eq('id', delivery.id);
        } else {
          await handleDeliveryFailure(delivery);
        }
      } catch (err) {
        await handleDeliveryFailure(delivery, err instanceof Error ? err.message : 'Unknown error');
        stats.failed++;
      }
    }

    return stats;
  } catch (err) {
    console.error('Failed to process webhook deliveries:', err);
    return stats;
  }
}

/**
 * Attempt a single webhook delivery
 */
async function attemptDelivery(
  delivery: any,
  webhook: { url: string; secret?: string }
): Promise<boolean> {
  try {
    // Prepare payload
    const payload = {
      event: delivery.event,
      data: JSON.parse(delivery.payload),
      timestamp: new Date().toISOString(),
      delivery_id: delivery.id,
    };

    // Calculate signature if secret exists
    const signature = webhook.secret
      ? await calculateSignature(JSON.stringify(payload), webhook.secret)
      : undefined;

    // Make request
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-ID': delivery.id,
        'X-Event-Type': delivery.event,
        ...(signature && { 'X-Webhook-Signature': signature }),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const responseBody = await response.text();

    // Update delivery with response
    await supabase
      .from('webhook_deliveries')
      .update({
        response_status: response.status,
        response_body: responseBody.substring(0, 10000), // Limit response size
      })
      .eq('id', delivery.id);

    // Success if 2xx status
    return response.status >= 200 && response.status < 300;
  } catch (err) {
    return false;
  }
}

/**
 * Handle delivery failure and schedule retry
 */
async function handleDeliveryFailure(delivery: any, errorMessage?: string): Promise<void> {
  const attempts = delivery.attempts + 1;

  if (attempts >= RETRY_CONFIG.maxAttempts) {
    // Max retries reached - mark as failed
    await supabase
      .from('webhook_deliveries')
      .update({
        status: 'failed',
        attempts,
        error_message: errorMessage || 'Max retries exceeded',
      })
      .eq('id', delivery.id);
  } else {
    // Schedule retry with exponential backoff
    const delay = Math.min(
      RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempts - 1),
      RETRY_CONFIG.maxDelay
    );

    const nextRetryAt = new Date(Date.now() + delay);

    await supabase
      .from('webhook_deliveries')
      .update({
        status: 'retrying',
        attempts,
        error_message: errorMessage,
        next_retry_at: nextRetryAt.toISOString(),
      })
      .eq('id', delivery.id);
  }
}

/**
 * Calculate HMAC signature for webhook verification
 */
async function calculateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Get webhook delivery history
 */
export async function getWebhookDeliveries(
  webhookId?: string,
  limit: number = 50
): Promise<{ deliveries: WebhookDelivery[]; error: string | null }> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) return { deliveries: [], error: 'No tenant' };

    let query = supabase
      .from('webhook_deliveries')
      .select(`
        *,
        webhooks(url)
      `)
      .eq('webhooks.tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (webhookId) {
      query = query.eq('webhook_id', webhookId);
    }

    const { data, error } = await query;

    if (error) throw error;

    interface DeliveryRow {
      id: string;
      webhook_id: string;
      event: string;
      payload: string;
      status: 'pending' | 'delivered' | 'failed' | 'retrying';
      attempts: number;
      response_status?: number;
      response_body?: string;
      error_message?: string;
      delivered_at?: string;
      next_retry_at?: string;
      created_at: string;
      webhooks?: { url: string };
    }

    return {
      deliveries: (data || []).map((d: DeliveryRow) => ({
        id: d.id,
        webhookId: d.webhook_id,
        event: d.event,
        payload: JSON.parse(d.payload),
        status: d.status,
        attempts: d.attempts,
        responseStatus: d.response_status,
        responseBody: d.response_body,
        errorMessage: d.error_message,
        deliveredAt: d.delivered_at,
        nextRetryAt: d.next_retry_at,
        createdAt: d.created_at,
      })),
      error: null,
    };
  } catch (err) {
    console.error('Failed to get webhook deliveries:', err);
    return { deliveries: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get webhook statistics
 */
export async function getWebhookStats(webhookId?: string): Promise<{
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  successRate: number;
  averageLatency?: number;
}> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) {
      return { total: 0, delivered: 0, failed: 0, pending: 0, successRate: 0 };
    }

    let query = supabase
      .from('webhook_deliveries')
      .select('status', { count: 'exact' })
      .eq('webhooks.tenant_id', tenantId);

    if (webhookId) {
      query = query.eq('webhook_id', webhookId);
    }

    const { data } = await query;

    interface StatusRow { status: string }

    const counts = {
      total: data?.length || 0,
      delivered: data?.filter((d: StatusRow) => d.status === 'delivered').length || 0,
      failed: data?.filter((d: StatusRow) => d.status === 'failed').length || 0,
      pending: data?.filter((d: StatusRow) => d.status === 'pending' || d.status === 'retrying').length || 0,
    };

    return {
      ...counts,
      successRate: counts.total > 0 ? (counts.delivered / counts.total) * 100 : 0,
    };
  } catch (err) {
    console.error('Failed to get webhook stats:', err);
    return { total: 0, delivered: 0, failed: 0, pending: 0, successRate: 0 };
  }
}

/**
 * Verify webhook signature
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = await calculateSignature(payload, secret);
  return signature === expected;
}
