import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import crypto from 'crypto';

/**
 * Facebook Data Deletion Callback
 * https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 *
 * GET  → shows instructions URL (used by Facebook app dashboard)
 * POST → processes Facebook's signed_request and records deletion
 */

function parseSignedRequest(signedRequest: string, appSecret: string): Record<string, unknown> | null {
    const [encodedSig, payload] = signedRequest.split('.');
    if (!encodedSig || !payload) return null;

    const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const expectedSig = crypto
        .createHmac('sha256', appSecret)
        .update(payload)
        .digest();

    if (!crypto.timingSafeEqual(sig, expectedSig)) return null;

    try {
        return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
}

export async function GET() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';
    return NextResponse.json({
        url: `${appUrl}/data-deletion`,
        instructions: 'Visit the URL to submit a data deletion request.',
    });
}

export async function POST(req: NextRequest) {
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const appUrl    = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';

    if (!appSecret) {
        return NextResponse.json({ error: 'App not configured' }, { status: 500 });
    }

    try {
        const body = await req.text();
        const params = new URLSearchParams(body);
        const signedRequest = params.get('signed_request');

        if (!signedRequest) {
            return NextResponse.json({ error: 'No signed_request' }, { status: 400 });
        }

        const data = parseSignedRequest(signedRequest, appSecret);
        if (!data) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        }

        const facebookUserId = String(data.user_id || '');
        const supabase = createSupabaseAdminClient();

        // Check if already requested
        const { data: existing } = await supabase
            .from('data_deletion_requests')
            .select('id, confirmation_code')
            .eq('facebook_user_id', facebookUserId)
            .eq('status', 'pending')
            .single();

        if (existing) {
            return NextResponse.json({
                url: `${appUrl}/data-deletion?code=${existing.confirmation_code}`,
                confirmation_code: existing.confirmation_code,
            });
        }

        // Create new deletion request
        const { data: record, error } = await supabase
            .from('data_deletion_requests')
            .insert({
                facebook_user_id: facebookUserId,
                source: 'facebook',
                status: 'pending',
                reason: 'Facebook data deletion callback',
                request_type: 'full_deletion',
            })
            .select('confirmation_code')
            .single();

        if (error || !record) {
            return NextResponse.json({ error: 'Failed to record request' }, { status: 500 });
        }

        // ── Cascade delete ALL PII for this Facebook user (GDPR/CCPA) ──────────
        // 1. Get integration IDs first (needed for cascading messenger conversations)
        const { data: integrations } = await supabase
            .from('facebook_integrations')
            .select('id')
            .eq('facebook_user_id', facebookUserId);

        const integrationIds = (integrations || []).map((i: any) => i.id);

        // 2. Delete messenger conversations linked to those integrations
        if (integrationIds.length > 0) {
            await supabase
                .from('messenger_conversations')
                .delete()
                .in('integration_id', integrationIds);
        }

        // 3. Delete facebook_leads for this user
        await supabase
            .from('facebook_leads')
            .delete()
            .eq('facebook_user_id', facebookUserId);

        // 4. Delete the integrations themselves
        await supabase
            .from('facebook_integrations')
            .delete()
            .eq('facebook_user_id', facebookUserId);

        // Facebook expects exactly this response shape
        return NextResponse.json({
            url: `${appUrl}/data-deletion?code=${record.confirmation_code}`,
            confirmation_code: record.confirmation_code,
        });

    } catch (err) {
        console.error('Data deletion error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
