import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import webPush from 'web-push';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:sales@alphaclonesystems.com';

let vapidReady = false;
if (vapidPublicKey && vapidPrivateKey) {
    try {
        webPush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
        vapidReady = true;
    } catch (err) {
        console.error('[Notifications Dispatch] Invalid VAPID keys:', err);
    }
}

/**
 * Central notification fan-out: writes an in-app notification, sends a web-push
 * to all of the recipient's devices, and (optionally) emails them. Used so that
 * events like new messages reach users on their phone even when the app is closed.
 */
export async function POST(req: NextRequest) {
    try {
        // Caller must be authenticated (the sender / triggering user).
        await requireAuthenticatedUser();

        const admin = createSupabaseAdminClient();
        const body = await req.json();

        const recipientId: string | undefined = body.userId || body.user_id;
        const type: string = body.type || 'system';
        const title: string = body.title;
        const message: string | undefined = body.message;
        const link: string | undefined = body.link;
        const shouldEmail: boolean = body.email !== false; // default: also email

        if (!recipientId || !title) {
            return NextResponse.json({ error: 'Missing userId or title' }, { status: 400 });
        }

        // Resolve recipient profile (tenant + email) with the admin client (bypasses RLS).
        const { data: profile } = await admin
            .from('profiles')
            .select('email, name, tenant_id')
            .eq('id', recipientId)
            .maybeSingle();

        const tenantId: string | undefined = body.tenantId || profile?.tenant_id || undefined;

        // 1. In-app notification row (drives the realtime bell + badge).
        // Note: the table column is `action_url` (not `link`) and `message` is NOT NULL.
        if (tenantId) {
            await admin.from('notifications').insert({
                user_id: recipientId,
                tenant_id: tenantId,
                type,
                title,
                message: message || title,
                action_url: link || null,
                read: false,
            });
        }

        // 2. Web push to every registered device
        let pushed = 0;
        if (vapidReady) {
            const { data: subs } = await admin
                .from('push_subscriptions')
                .select('id, subscription, endpoint, keys')
                .eq('user_id', recipientId);

            if (subs && subs.length > 0) {
                const payload = JSON.stringify({
                    title,
                    body: message || '',
                    url: link || '/dashboard',
                    icon: '/favicon-192x192.png',
                    badge: '/favicon-96x96.png',
                });

                const results = await Promise.allSettled(
                    subs.map((sub: any) => {
                        const subObj = sub.subscription
                            ? (typeof sub.subscription === 'string' ? JSON.parse(sub.subscription) : sub.subscription)
                            : { endpoint: sub.endpoint, keys: sub.keys };
                        return webPush.sendNotification(subObj, payload);
                    })
                );

                const expired: string[] = [];
                results.forEach((r, i) => {
                    if (r.status === 'fulfilled') {
                        pushed += 1;
                    } else {
                        const code = (r.reason as any)?.statusCode;
                        if (code === 410 || code === 404) expired.push(subs[i].id);
                    }
                });
                if (expired.length > 0) {
                    await admin.from('push_subscriptions').delete().in('id', expired);
                }
            }
        }

        // 3. Email (best-effort) so the recipient is reached off-platform too
        let emailed = false;
        if (shouldEmail && tenantId && profile?.email) {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
                const result = await sendEmailServer({
                    tenantId,
                    to: profile.email,
                    subject: title,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #0d9488;">${title}</h2>
                            ${message ? `<p>${message}</p>` : ''}
                            ${link ? `<a href="${baseUrl}${link}" style="display:inline-block;padding:10px 20px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px;">Open AlphaClone</a>` : ''}
                            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
                            <small style="color:#666;">You're receiving this because you have notifications enabled on AlphaClone.</small>
                        </div>
                    `,
                    isPlatformNotification: true,
                });
                emailed = result.success;
            } catch (err) {
                console.error('[Notifications Dispatch] Email failed:', err);
            }
        }

        return NextResponse.json({ success: true, pushed, emailed });
    } catch (err: any) {
        const status = typeof err?.status === 'number' ? err.status : 500;
        if (status >= 500) console.error('[Notifications Dispatch] Error:', err);
        return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status });
    }
}
