import { NextRequest, NextResponse } from 'next/server';
import {
    createAdminSupabaseClientOrThrow,
    requireAuthenticatedUser,
    requireTenantAccess,
    routeErrorResponse,
} from '@/lib/apiAuth';
import { normalizePhoneNumber } from '@/services/engine/CommunicationEngine';

/**
 * POST /api/sms/send
 * Send a single SMS via Twilio using per-account credentials
 */
export async function POST(req: NextRequest) {
    try {
        const { user } = await requireAuthenticatedUser();
        const supabase = createAdminSupabaseClientOrThrow();
        const { to, message, from, tenantId, userId: ignoredUserId, campaignId, leadId } = await req.json();
        const resolvedUserId = user.id;

        if (!to || !message) {
            return NextResponse.json({ error: 'to and message are required' }, { status: 400 });
        }

        if (tenantId) {
            await requireTenantAccess(tenantId);
        }

        // 1. Resolve Twilio Credentials (Per-Tenant or Env Fallback)
        console.log(`[SMS Send] Resolving credentials for Tenant: ${tenantId}, User: ${resolvedUserId}`);

        let accountSid = process.env.TWILIO_ACCOUNT_SID;
        let authToken  = process.env.TWILIO_AUTH_TOKEN;
        let fromNumber = from || process.env.TWILIO_PHONE_NUMBER;

        if (tenantId) {
            const { data: creds, error: credError } = await supabase
                .from('twilio_integrations')
                .select('account_sid, auth_token, phone_number, is_active')
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (credError) console.error('[SMS Send] Twilio integration query error:', credError);

            if (creds && creds.is_active) {
                console.log(`[SMS Send] Using tenant-specific Twilio credentials for ${tenantId}`);
                accountSid = creds.account_sid;
                authToken  = creds.auth_token;
                fromNumber = from || creds.phone_number || fromNumber;
            } else {
                console.warn(`[SMS Send] No active tenant-specific Twilio integration found for ${tenantId}. Falling back...`);
            }
        } 
        
        // Fallback to legacy 'integrations' table if no tenant-specific creds found yet
        if ((!accountSid || !authToken) && resolvedUserId) {
            const { data: integration } = await supabase
                .from('integrations')
                .select('config, enabled')
                .eq('user_id', resolvedUserId)
                .eq('type', 'twilio')
                .eq('enabled', true)
                .maybeSingle();

            if (integration?.config) {
                console.log(`[SMS Send] Using legacy user-specific Twilio integration for ${resolvedUserId}`);
                accountSid = (integration.config as any).accountSid || accountSid;
                authToken  = (integration.config as any).authToken  || authToken;
                fromNumber = from || (integration.config as any).fromNumber || fromNumber;
            }
        }

        if (!accountSid || !authToken) {
            console.error('[SMS Send] Failed: Missing SID or Auth Token', { tenantId, userId: resolvedUserId, hasSid: !!accountSid, hasToken: !!authToken });
            return NextResponse.json({ 
                error: 'Twilio SID or Auth Token not found for this account. Please verify your Twilio integration in Settings.' 
            }, { status: 503 });
        }

        const toNormalized   = normalizePhoneNumber(to);
        const fromNormalized = fromNumber;

        if (!fromNormalized) {
            return NextResponse.json({ 
                error: 'Sender phone number (FROM) is missing. Please ensure your Twilio integration includes a verified phone number.' 
            }, { status: 503 });
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

        if (!twilioRes.ok || twilioData.code) {
            console.error('[sms/send] Twilio error:', twilioData);
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
                    error_message: 'Twilio send failed',
                });
            }
            return NextResponse.json(
                {
                    success: false,
                    error: 'SMS could not be sent. Verify your Twilio configuration.',
                    code: twilioData.code ?? 'TWILIO_ERROR',
                },
                { status: 400 }
            );
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
        return routeErrorResponse(err, 'Internal server error');
    }
}
