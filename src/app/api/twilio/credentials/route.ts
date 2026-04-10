import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * Required Supabase table (run once in your Supabase SQL editor):
 *
 * CREATE TABLE IF NOT EXISTS twilio_integrations (
 *   id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   tenant_id     UUID NOT NULL UNIQUE,
 *   account_sid   TEXT NOT NULL,
 *   auth_token    TEXT NOT NULL,
 *   phone_number  TEXT NOT NULL,
 *   is_active     BOOLEAN DEFAULT true,
 *   created_at    TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at    TIMESTAMPTZ DEFAULT NOW()
 * );
 */

async function getAuthenticatedUser(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/** GET /api/twilio/credentials?tenantId=xxx — returns masked credentials */
export async function GET(req: NextRequest) {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from('twilio_integrations')
        .select('id, account_sid, phone_number, is_active, created_at')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!data) return NextResponse.json({ connected: false });

    return NextResponse.json({
        connected: true,
        accountSid: data.account_sid,
        phoneNumber: data.phone_number,
        connectedAt: data.created_at,
    });
}

/** POST /api/twilio/credentials — save or update credentials */
export async function POST(req: NextRequest) {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tenantId, accountSid, authToken, phoneNumber } = await req.json();

    if (!tenantId || !accountSid || !authToken || !phoneNumber) {
        return NextResponse.json(
            { error: 'tenantId, accountSid, authToken, and phoneNumber are all required' },
            { status: 400 }
        );
    }

    // Quick validation — verify credentials work before saving
    try {
        const testUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;
        const testRes = await fetch(testUrl, {
            headers: {
                Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            },
        });
        if (!testRes.ok) {
            return NextResponse.json(
                { error: 'Invalid Twilio credentials — please check your Account SID and Auth Token.' },
                { status: 400 }
            );
        }
    } catch {
        return NextResponse.json(
            { error: 'Could not reach Twilio to verify credentials.' },
            { status: 502 }
        );
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
        .from('twilio_integrations')
        .upsert(
            {
                tenant_id: tenantId,
                account_sid: accountSid,
                auth_token: authToken,
                phone_number: phoneNumber,
                is_active: true,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'tenant_id' }
        );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}

/** DELETE /api/twilio/credentials?tenantId=xxx — disconnect */
export async function DELETE(req: NextRequest) {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
        .from('twilio_integrations')
        .delete()
        .eq('tenant_id', tenantId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
