import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import webPush from 'web-push';
import { z } from 'zod';
import { escapeHtml } from '@/lib/email/sanitizeEmailHtml';
import { getVapidEmail, getVapidPrivateKey, getVapidPublicKey } from '@/lib/push/vapidEnv';

const vapidPublicKey = getVapidPublicKey();
const vapidPrivateKey = getVapidPrivateKey();
const vapidEmail = getVapidEmail();

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
        const admin = createSupabaseAdminClient();
        const body = z.object({
            tenantId: z.string().uuid(),
            userId: z.string().uuid().optional(),
            user_id: z.string().uuid().optional(),
            type: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/i).default('system'),
            title: z.string().trim().min(1).max(160),
            message: z.string().trim().max(2000).optional(),
            link: z.string().trim().max(1000).refine(value => value.startsWith('/') && !value.startsWith('//'), 'Notification links must be internal').optional(),
            email: z.boolean().default(true),
        }).refine(value => Boolean(value.userId || value.user_id), { message: 'Recipient is required' }).parse(await req.json());
        await requireTenantAccess(body.tenantId);
        const recipientId = body.userId || body.user_id!;
        const { type, title, message, link } = body;
        const shouldEmail = body.email;

        const { data: recipientMembership, error: membershipError } = await admin.from('tenant_users').select('user_id')
            .eq('tenant_id', body.tenantId).eq('user_id', recipientId).maybeSingle();
        if (membershipError) throw membershipError;
        if (!recipientMembership) return NextResponse.json({ error: 'Recipient is not a workspace member' }, { status: 404 });

        // Resolve recipient profile (tenant + email) with the admin client (bypasses RLS).
        const { data: profile } = await admin
            .from('profiles')
            .select('email, name')
            .eq('id', recipientId)
            .maybeSingle();

        const tenantId = body.tenantId;

        // 1. In-app notification row (drives the realtime bell + badge).
        // Note: the table column is `action_url` (not `link`) and `message` is NOT NULL.
        const { error: notificationError } = await admin.from('notifications').insert({
                user_id: recipientId,
                tenant_id: tenantId,
                type,
                title,
                message: message || title,
                action_url: link || null,
                read: false,
            });
        if (notificationError) throw notificationError;

        // 2. Web push to every registered device
        let pushed = 0;
        if (vapidReady) {
            const { data: subs } = await admin
                .from('push_subscriptions')
                .select('id, subscription, endpoint, keys')
                .eq('user_id', recipientId)
                .eq('tenant_id', tenantId);

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
                            <h2 style="color: #0d9488;">${escapeHtml(title)}</h2>
                            ${message ? `<p>${escapeHtml(message)}</p>` : ''}
                            ${link ? `<a href="${escapeHtml(baseUrl + link)}" style="display:inline-block;padding:10px 20px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px;">Open AlphaClone</a>` : ''}
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
    } catch (err: unknown) {
        return routeErrorResponse(err, 'Notification could not be dispatched', req);
    }
}
