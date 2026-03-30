import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { normalizePhoneNumber } from '@/services/engine/CommunicationEngine';

/**
 * POST /api/sms/send
 * Send a single SMS via Twilio using per-account credentials
 */
export async function POST(req: NextRequest) {
    const supabase = createSupabaseAdminClient();

    try {
        const { to, message, from, tenantId, userId, campaignId, leadId } = await req.json();

        // Resolve credentials: tenant DB record takes priority over env vars
        let accountSid  = process.env.TWILIO_ACCOUNT_SID;
        let authToken   = process.env.TWILIO_AUTH_TOKEN;
        let defaultFrom = process.env.TWILIO_PHONE_NUMBER;

        if (tenantId) {
            const { data: creds } = await supabase
                .from('twilio_integrations')
                .select('account_sid, auth_token, phone_number')
                .eq('tenant_id', tenantId)
                .eq('is_active', true)
                .maybeSingle();

            if (creds) {
                accountSid  = creds.account_sid;
                authToken   = creds.auth_token;
                defaultFrom = creds.phone_number;
            }
        }

        if (!accountSid || !authToken) {
            return NextResponse.json({ error: 'Twilio credentials not configured. Add your credentials in Settings > Integrations.' }, { status: 503 });
        }

        if (!to || !message) {
            return NextResponse.json({ error: 'to and message are required' }, { status: 400 });
        }

        // 1. Resolve Twilio Credentials (Per-Account / Per-Tenant)
        // We prioritize the 'integrations' table for "tailored" accounts
        let accountSid = process.env.TWILIO_ACCOUNT_SID;
        let authToken  = process.env.TWILIO_AUTH_TOKEN;
        let fromNumber = from || process.env.TWILIO_PHONE_NUMBER;

        if (tenantId || userId) {
            // Find the integration for the specific user or tenant owner
            let lookupId = userId;
            
            if (!lookupId && tenantId) {
                // If only tenantId is provided, get the owner
                const { data: tenant } = await supabase
                    .from('tenants')
                    .select('created_by')
                    .eq('id', tenantId)
                    .single();
                lookupId = tenant?.created_by;
            }

            if (lookupId) {
                const { data: integration } = await supabase
                    .from('integrations')
                    .select('config, enabled')
                    .eq('user_id', lookupId)
                    .eq('type', 'twilio')
                    .eq('enabled', true)
                    .maybeSingle();

                if (integration?.config) {
                    accountSid = integration.config.accountSid || accountSid;
                    authToken  = integration.config.authToken  || authToken;
                    fromNumber = from || integration.config.fromNumber || fromNumber;
                }
            }
        }

        if (!accountSid || !authToken) {
            return NextResponse.json({ error: 'Twilio credentials not found for this account' }, { status: 503 });
        }

        const toNormalized   = normalizePhoneNumber(to);
        const fromNormalized = fromNumber;

        if (!fromNormalized) {
            return NextResponse.json({ error: 'No from number configured for this account' }, { status: 503 });
        }

        // 2. Call Twilio REST API
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const params = new URLSearchParams({
            To:   toNormalized,
            From: fromNormalized,
            Body: message,
        });

        const twilioRes = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            },
            body: params.toString(),
        });

        const twilioData = await twilioRes.json();

        if (twilioData.status === 'failed' || twilioData.code) {
            // Log failed message
            if (tenantId) {
                await supabase.from('sms_messages').insert({
                    tenant_id: tenantId,
                    campaign_id: campaignId || null,
                    lead_id: leadId || null,
                    from_number: fromNormalized,
                    to_number: toNormalized,
                    body: message,
                    status: 'failed',
                    twilio_sid: twilioData.sid || null,
                    error_message: twilioData.message || 'Twilio error',
                });
            }
            return NextResponse.json({
                success: false,
                error: twilioData.message || 'Twilio send failed',
                code: twilioData.code,
            }, { status: 400 });
        }

        // 3. Log successful message
        if (tenantId) {
            await supabase.from('sms_messages').insert({
                tenant_id: tenantId,
                campaign_id: campaignId || null,
                lead_id: leadId || null,
                from_number: fromNormalized,
                to_number: toNormalized,
                body: message,
                status: 'sent',
                twilio_sid: twilioData.sid,
                sent_at: new Date().toISOString(),
            });
        }

        return NextResponse.json({
            success: true,
            sid: twilioData.sid,
            status: twilioData.status,
            to: twilioData.to,
        });

    } catch (err) {
        console.error('SMS send error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
