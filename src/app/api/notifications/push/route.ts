import { NextRequest, NextResponse } from 'next/server';
import webPush from 'web-push';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { getVapidEmail, getVapidPrivateKey, getVapidPublicKey } from '@/lib/push/vapidEnv';

const vapidPublicKey = getVapidPublicKey();
const vapidPrivateKey = getVapidPrivateKey();

const isPlaceholder = (key?: string) => !key || key.includes('your_') || key.length < 20;

if (vapidPublicKey && vapidPrivateKey && !isPlaceholder(vapidPublicKey) && !isPlaceholder(vapidPrivateKey)) {
  try {
    webPush.setVapidDetails(getVapidEmail(), vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.error('Failed to initialize Web Push – invalid keys provided:', err);
  }
}

/**
 * @deprecated Prefer POST /api/push/send — this route now requires authentication
 * and only allows sending to the authenticated user's own subscriptions.
 */
export async function POST(request: NextRequest) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
  }

  try {
    const { user, supabase } = await requireAuthenticatedUser();
    const { userId, title, body, url } = await request.json();

    if (!title) {
      return NextResponse.json({ error: 'Missing required field: title' }, { status: 400 });
    }

    const targetUserId = userId || user.id;
    if (targetUserId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: can only push to your own user id' }, { status: 403 });
    }

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, subscription, endpoint, keys')
      .eq('user_id', targetUserId);

    if (error || !subscriptions) {
      throw new Error('Failed to fetch subscriptions');
    }

    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No subscriptions found for user' });
    }

    const payload = JSON.stringify({
      title,
      body,
      url,
      icon: '/logo.png',
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub: { subscription?: string | object; endpoint?: string; keys?: object }) =>
        webPush.sendNotification(
          sub.subscription
            ? typeof sub.subscription === 'string'
              ? JSON.parse(sub.subscription)
              : sub.subscription
            : { endpoint: sub.endpoint, keys: sub.keys as webPush.PushSubscription['keys'] },
          payload
        )
      )
    );

    const getSubscriptionEndpoint = (sub: { subscription?: string | object; endpoint?: string }) => {
      if (sub.endpoint) return sub.endpoint;
      if (!sub.subscription) return undefined;
      const subscription =
        typeof sub.subscription === 'string' ? JSON.parse(sub.subscription) : sub.subscription;
      return (subscription as webPush.PushSubscription)?.endpoint;
    };

    const invalidEndpoints: string[] = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected' && (result.reason as { statusCode?: number })?.statusCode === 410) {
        const endpoint = getSubscriptionEndpoint(subscriptions[index]);
        if (endpoint) invalidEndpoints.push(endpoint);
      }
    });

    if (invalidEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', invalidEndpoints);
    }

    const sentCount = results.filter((r) => r.status === 'fulfilled').length;
    return NextResponse.json({ success: true, sent: sentCount });
  } catch (error) {
    return routeErrorResponse(error, 'Push notification failed', request);
  }
}
