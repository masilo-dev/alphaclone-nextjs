import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { normalizePhoneNumber } from '@/services/engine/CommunicationEngine';

/**
 * POST /api/sms/campaign/[id]/run
 * Executes an SMS campaign — fetches recipients and sends messages via Twilio
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = createSupabaseAdminClient();
    const campaignId = (await params).id;

    // 1. Load campaign
    const { data: campaign, error: campErr } = await supabase
        .from('sms_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

    if (campErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (['running', 'completed'].includes(campaign.status)) {
        return NextResponse.json({ error: `Campaign is already ${campaign.status}` }, { status: 400 });
    }

    // 2. Resolve Twilio Credentials for this specific Campaign/Tenant
    let accountSid = process.env.TWILIO_ACCOUNT_SID;
    let authToken  = process.env.TWILIO_AUTH_TOKEN;
    let fromNumber = campaign.from_number || process.env.TWILIO_PHONE_NUMBER;

    // Check for tenant-specific integration (New Table)
    const { data: twilioInteg } = await supabase
        .from('twilio_integrations')
        .select('account_sid, auth_token, phone_number, is_active')
        .eq('tenant_id', campaign.tenant_id)
        .maybeSingle();

    if (twilioInteg && twilioInteg.is_active) {
        accountSid = twilioInteg.account_sid;
        authToken  = twilioInteg.auth_token;
        fromNumber = campaign.from_number || twilioInteg.phone_number || fromNumber;
    } 
    // Fallback to legacy user-specific integration
    else {
        const { data: tenant } = await supabase
            .from('tenants')
            .select('created_by')
            .eq('id', campaign.tenant_id)
            .single();
        
        if (tenant?.created_by) {
            const { data: integration } = await supabase
                .from('integrations')
                .select('config, enabled')
                .eq('user_id', tenant.created_by)
                .eq('type', 'twilio')
                .eq('enabled', true)
                .maybeSingle();

            if (integration?.config) {
                accountSid = integration.config.accountSid || accountSid;
                authToken  = integration.config.authToken  || authToken;
                fromNumber = campaign.from_number || integration.config.fromNumber || fromNumber;
            }
        }
    }

    if (!accountSid || !authToken || !fromNumber) {
        await supabase.from('sms_campaigns').update({ status: 'failed', error_message: 'Twilio not configured for this account' }).eq('id', campaignId);
        return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 });
    }

    // 3. Mark running
    await supabase.from('sms_campaigns').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', campaignId);

    // Fetch recipients based on source
    let recipients: { phone: string; name?: string; leadId?: string }[] = [];

    if (campaign.recipient_source === 'leads') {
        const { data: leads } = await supabase
            .from('leads')
            .select('id, phone, contact_name')
            .eq('tenant_id', campaign.tenant_id)
            .not('phone', 'is', null)
            .neq('phone', '');

        recipients = (leads || []).map((l: any) => ({ phone: l.phone, name: l.contact_name, leadId: l.id }));

    } else if (campaign.recipient_source === 'clients') {
        const { data: clients } = await supabase
            .from('business_clients')
            .select('id, phone, name')
            .eq('tenant_id', campaign.tenant_id)
            .not('phone', 'is', null)
            .neq('phone', '');

        recipients = (clients || []).map((c: any) => ({ phone: c.phone, name: c.name }));

    } else if (campaign.recipient_source === 'manual') {
        // Manual recipients stored in recipient_filter.numbers
        const numbers: string[] = campaign.recipient_filter?.numbers || [];
        recipients = numbers.map(n => ({ phone: n }));
    }

    // Deduplicate
    const seen = new Set<string>();
    recipients = recipients.filter(r => {
        const key = r.phone?.replace(/\D/g, '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    await supabase.from('sms_campaigns').update({ recipients_total: recipients.length }).eq('id', campaignId);

    // Send messages with a small delay between each to avoid Twilio rate limits
    let sent = 0, failed = 0;

    for (const recipient of recipients) {
        try {
            const toNormalized = normalizePhoneNumber(recipient.phone);
            const params = new URLSearchParams({
                To:   toNormalized,
                From: fromNumber,
                Body: campaign.message_body,
            });

            const twilioRes = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
                    },
                    body: params.toString(),
                }
            );
            const result = await twilioRes.json();
            const success = !result.code && result.sid;

            await supabase.from('sms_messages').insert({
                tenant_id: campaign.tenant_id,
                campaign_id: campaignId,
                lead_id: recipient.leadId || null,
                from_number: fromNumber,
                to_number: toNormalized,
                body: campaign.message_body,
                status: success ? 'sent' : 'failed',
                twilio_sid: result.sid || null,
                error_message: success ? null : (result.message || 'Unknown error'),
                sent_at: success ? new Date().toISOString() : null,
            });

            if (success) sent++; else failed++;

        } catch (err) {
            failed++;
        }

        // Small delay — 50ms between messages
        await new Promise(r => setTimeout(r, 50));
    }

    // Mark completed
    await supabase.from('sms_campaigns').update({
        status: 'completed',
        sent_count: sent,
        failed_count: failed,
        completed_at: new Date().toISOString(),
    }).eq('id', campaignId);

    return NextResponse.json({ success: true, sent, failed, total: recipients.length });
}
