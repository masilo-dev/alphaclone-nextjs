import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/apiAuth';
import webPush from 'web-push';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:sales@alphaclonesystems.com';

if (vapidPublicKey && vapidPrivateKey) {
    try {
        webPush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
    } catch (err) {
        console.error('[Push Send API] Failed to initialize Web Push – invalid keys:', err);
    }
} else {
    console.warn('[Push Send API] Web Push VAPID keys are missing from environment variables.');
}

export async function POST(req: NextRequest) {
    try {
        // Authenticate caller
        const { supabase } = await requireAuthenticatedUser();

        if (!vapidPublicKey || !vapidPrivateKey) {
            return NextResponse.json({ error: 'VAPID keys not configured on server' }, { status: 500 });
        }

        const body = await req.json();
        const targetUserId = body.user_id || body.userId;
        const { title, body: messageBody, url } = body;

        if (!targetUserId || !title) {
            return NextResponse.json({ error: 'Missing user_id or title' }, { status: 400 });
        }

        // Fetch subscriptions for target user
        const { data: subscriptions, error: fetchError } = await supabase
            .from('push_subscriptions')
            .select('id, subscription, endpoint, keys')
            .eq('user_id', targetUserId);

        if (fetchError) {
            throw fetchError;
        }

        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json({ success: true, sent: 0, message: 'No subscriptions found for user' });
        }

        const payload = JSON.stringify({
            title,
            body: messageBody || '',
            url: url || '/',
            icon: '/favicon-192x192.png',
            badge: '/favicon-96x96.png'
        });

        // Send push to all registered devices of the user
        const results = await Promise.allSettled(
            subscriptions.map((sub: any) => {
                const subObj = sub.subscription
                    ? (typeof sub.subscription === 'string' ? JSON.parse(sub.subscription) : sub.subscription)
                    : { endpoint: sub.endpoint, keys: sub.keys };
                return webPush.sendNotification(subObj, payload);
            })
        );

        // Track and remove expired/invalid subscriptions (410 Gone / 404 Not Found)
        const expiredSubIds: string[] = [];
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const reason = result.reason as any;
                if (reason?.statusCode === 410 || reason?.statusCode === 404) {
                    expiredSubIds.push(subscriptions[index].id);
                } else {
                    console.error('[Push Send API] Error sending notification to subscription:', subscriptions[index].id, reason);
                }
            }
        });

        if (expiredSubIds.length > 0) {
            const { error: deleteError } = await supabase
                .from('push_subscriptions')
                .delete()
                .in('id', expiredSubIds);

            if (deleteError) {
                console.error('[Push Send API] Failed to clean up expired subscriptions:', deleteError);
            } else {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[Push Send API] Cleaned up ${expiredSubIds.length} expired subscriptions.`);
                }
            }
        }

        const sentCount = results.filter(r => r.status === 'fulfilled').length;

        return NextResponse.json({
            success: true,
            sent: sentCount,
            total: subscriptions.length,
            cleanedUp: expiredSubIds.length
        });
    } catch (err: any) {
        console.error('[Push Send API] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
