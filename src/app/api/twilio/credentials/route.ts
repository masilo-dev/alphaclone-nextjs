import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess } from '@/lib/apiAuth';

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

function maskAccountSid(value: string) {
    return value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value;
}

function maskPhoneNumber(value: string) {
    return value.length > 4 ? `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}` : value;
}

/** GET /api/twilio/credentials?tenantId=xxx - returns masked credentials */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const { admin: supabase } = await requireTenantAccess(tenantId);
    const { data, error } = await supabase
        .from('twilio_integrations')
        .select('id, account_sid, phone_number, is_active, created_at')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .maybeSingle();

    if (error) return clientErrorResponse(error, { request: req, scope: 'twilio/credentials' });

    if (!data) return NextResponse.json({ connected: false });

    return NextResponse.json({
        connected: true,
        accountSidMasked: maskAccountSid(data.account_sid),
        phoneNumberMasked: maskPhoneNumber(data.phone_number),
        connectedAt: data.created_at,
    });
}

/** POST /api/twilio/credentials - save or update credentials */
export async function POST(req: NextRequest) {
    const { tenantId, accountSid, authToken, phoneNumber } = await req.json();

    if (!tenantId || !accountSid || !authToken || !phoneNumber) {
        return NextResponse.json(
            { error: 'tenantId, accountSid, authToken, and phoneNumber are all required' },
            { status: 400 }
        );
    }

    await requireTenantAccess(tenantId);

    try {
        const testUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;
        const testRes = await fetch(testUrl, {
            headers: {
                Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            },
        });
        if (!testRes.ok) {
            return NextResponse.json(
                { error: 'Invalid Twilio credentials - please check your Account SID and Auth Token.' },
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

    if (error) return clientErrorResponse(error, { request: req, scope: 'twilio/credentials' });

    return NextResponse.json({ success: true });
}

/** DELETE /api/twilio/credentials?tenantId=xxx - disconnect */
export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const { admin: supabase } = await requireTenantAccess(tenantId);
    const { error } = await supabase
        .from('twilio_integrations')
        .delete()
        .eq('tenant_id', tenantId);

    if (error) return clientErrorResponse(error, { request: req, scope: 'twilio/credentials' });

    return NextResponse.json({ success: true });
}
