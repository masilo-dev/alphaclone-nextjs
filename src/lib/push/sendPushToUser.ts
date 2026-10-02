import webPush from 'web-push';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getVapidEmail, getVapidPrivateKey, getVapidPublicKey } from '@/lib/push/vapidEnv';

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return true;
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  const email = getVapidEmail();
  if (!publicKey || !privateKey) return false;
  try {
    webPush.setVapidDetails(email, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.warn('[sendPushToUser] VAPID initialization failed:', err);
    return false;
  }
}

export interface SendPushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
}

export interface SendPushResult {
  sent: number;
  failed: number;
  expiredCleaned: number;
}

/**
 * Sends a web push notification directly to all active subscriptions of a user.
 * Queries by user_id primarily, with fallback to tenant_id match.
 * Cleans up expired (404/410) endpoints automatically.
 */
export async function sendPushToUser(
  userId: string,
  payload: SendPushPayload,
  tenantId?: string
): Promise<SendPushResult> {
  const result: SendPushResult = { sent: 0, failed: 0, expiredCleaned: 0 };

  if (!ensureVapid()) {
    return result;
  }

  const admin = createSupabaseAdminClient();

  // Query subscriptions for this user
  let query = admin
    .from('push_subscriptions')
    .select('id, subscription, endpoint, keys, user_id, tenant_id')
    .eq('user_id', userId);

  const { data: userSubs, error: subsError } = await query;
  if (subsError) {
    console.warn('[sendPushToUser] Failed to fetch subscriptions:', subsError.message);
    return result;
  }

  let subs = userSubs || [];

  // Fallback: If no subs found by user_id and tenantId provided, check tenant subscriptions
  if (subs.length === 0 && tenantId) {
    const { data: tenantSubs } = await admin
      .from('push_subscriptions')
      .select('id, subscription, endpoint, keys, user_id, tenant_id')
      .eq('tenant_id', tenantId);
    if (tenantSubs && tenantSubs.length > 0) {
      subs = tenantSubs;
    }
  }

  if (subs.length === 0) {
    return result;
  }

  const pushBody = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/dashboard',
    tag: payload.tag,
    icon: payload.icon || '/favicon-192x192.png',
    badge: payload.badge || '/favicon-96x96.png',
    data: payload.data || {},
  });

  const pushPromises = subs.map((sub: any) => {
    const target = sub.subscription
      ? typeof sub.subscription === 'string'
        ? JSON.parse(sub.subscription)
        : sub.subscription
      : { endpoint: sub.endpoint, keys: sub.keys };
    return webPush.sendNotification(target, pushBody);
  });

  const outcomes = await Promise.allSettled(pushPromises);
  const expiredIds: string[] = [];

  outcomes.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      result.sent += 1;
    } else {
      result.failed += 1;
      const statusCode = (outcome.reason as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        expiredIds.push(subs[index].id);
      }
    }
  });

  if (expiredIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', expiredIds);
    result.expiredCleaned = expiredIds.length;
  }

  return result;
}
