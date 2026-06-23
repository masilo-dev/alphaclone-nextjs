import { NextResponse } from 'next/server';
import webPush from 'web-push';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
// For this implementation, I'll assume we pass the VAPID keys via env vars directly to webPush.

const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

// Helper to check if keys are just placeholders
const isPlaceholder = (key?: string) => !key || key.includes('your_') || key.length < 20;

if (vapidPublicKey && vapidPrivateKey && !isPlaceholder(vapidPublicKey) && !isPlaceholder(vapidPrivateKey)) {
    try {
        webPush.setVapidDetails(
            'mailto:support@alphaclonesystems.com',
            vapidPublicKey,
            vapidPrivateKey
        );
    } catch (err) {
        console.error('Failed to initialize Web Push – invalid keys provided:', err);
    }
} else {
    console.warn('Web Push not initialized: VAPID keys are missing or placeholders.');
}

export async function POST(request: Request) {
    if (!vapidPublicKey || !vapidPrivateKey) {
        return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    try {
        const { userId, title, body, url } = await request.json();

        if (!userId || !title) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { data: subscriptions, error } = await supabase
            .from('push_subscriptions')
            .select('id, subscription, endpoint, keys')
            .eq('user_id', userId);

        if (error || !subscriptions) {
            throw new Error('Failed to fetch subscriptions');
        }

        const payload = JSON.stringify({
            title,
            body,
            url,
            icon: '/logo.png'
        });

        // Send to all user devices
        const results = await Promise.allSettled(
            subscriptions.map((sub: any) =>
                webPush.sendNotification(
                    sub.subscription
                        ? (typeof sub.subscription === 'string' ? JSON.parse(sub.subscription) : sub.subscription)
                        : { endpoint: sub.endpoint, keys: sub.keys as any },
                    payload
                )
            )
        );

        // Cleanup invalid subscriptions (410 Gone)
        const getSubscriptionEndpoint = (sub: any) => {
            if (sub.endpoint) return sub.endpoint;
            if (!sub.subscription) return undefined;

            const subscription =
                typeof sub.subscription === 'string'
                    ? JSON.parse(sub.subscription)
                    : sub.subscription;

            return subscription?.endpoint;
        };

        const invalidEndpoints: string[] = [];
        results.forEach((result, index) => {
            if (result.status === 'rejected' && (result.reason as any).statusCode === 410) {
                const endpoint = getSubscriptionEndpoint(subscriptions[index]);
                if (endpoint) invalidEndpoints.push(endpoint);
            }
        });

        if (invalidEndpoints.length > 0) {
            await supabase
                .from('push_subscriptions')
                .delete()
                .in('endpoint', invalidEndpoints);
        }

        return NextResponse.json({ success: true, sent: results.length });

    } catch (error) {
        console.error('Push notification error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
