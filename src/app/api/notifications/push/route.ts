import { NextResponse } from 'next/server';
import webPush from 'web-push';
import { supabase } from '@/lib/supabase'; // Use admin client if possible, but for now use standard
// Note: In a real app, you should use createClient from @supabase/ssr or supabase-admin with service role key 
// to fetch all subscriptions, regardless of RLS. 
// However, assuming this route is called with a user context or we use a service role client.
// For this implementation, I'll assume we pass the VAPID keys via env vars directly to webPush.

const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
    webPush.setVapidDetails(
        'mailto:support@alphaclone.io',
        vapidPublicKey,
        vapidPrivateKey
    );
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

        // Fetch user's subscriptions
        // Ideally use a service role client here to bypass RLS if the sender is not the user themselves (usually system)
        // For now, valid provided the DB access allows it.
        const { data: subscriptions, error } = await supabase
            .from('push_subscriptions')
            .select('*')
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
            subscriptions.map(sub =>
                webPush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: sub.keys as any
                    },
                    payload
                )
            )
        );

        // Cleanup invalid subscriptions (410 Gone)
        const invalidEndpoints: string[] = [];
        results.forEach((result, index) => {
            if (result.status === 'rejected' && (result.reason as any).statusCode === 410) {
                invalidEndpoints.push(subscriptions[index].endpoint);
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
