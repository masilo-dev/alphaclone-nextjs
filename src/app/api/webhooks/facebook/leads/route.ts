import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import crypto from 'crypto';
import { ENV } from '@/config/env';

const VERIFY_TOKEN = ENV.FACEBOOK_VERIFY_TOKEN;
const APP_SECRET = ENV.FACEBOOK_APP_SECRET;

// Facebook webhook verification (GET)
export async function GET(req: NextRequest) {
    try {
        if (!VERIFY_TOKEN) {
            console.error('[Facebook Leads Webhook] Verification token is not configured');
            return new Response('Webhook not configured', { status: 503 });
        }

        const { searchParams } = new URL(req.url);
        const mode = searchParams.get('hub.mode');
        const token = searchParams.get('hub.verify_token');
        const challenge = searchParams.get('hub.challenge');

        console.log(`[Facebook Leads Webhook] Incoming verification request: mode=${mode}, token=${token ? 'present' : 'missing'}`);

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('[Facebook Leads Webhook] Verification successful!');
            return new Response(challenge, {
                status: 200,
                headers: { 'Content-Type': 'text/plain' },
            });
        }
        
        console.warn('[Facebook Leads Webhook] Verification failed');
        return new Response('Forbidden', { status: 403 });
    } catch (err) {
        console.error('[Facebook Leads Webhook] GET error:', err);
        return new Response('Internal error', { status: 500 });
    }
}

// Facebook webhook events (POST)
export async function POST(req: NextRequest) {
    try {
        if (!APP_SECRET) {
            console.error('[Facebook Leads Webhook] App secret is not configured');
            return new NextResponse('Webhook not configured', { status: 503 });
        }

        const bodyText = await req.text();
        const signatureHeader = req.headers.get('x-hub-signature-256');

        if (signatureHeader) {
            const signature = signatureHeader.replace('sha256=', '');
            const expectedSignature = crypto
                .createHmac('sha256', APP_SECRET)
                .update(bodyText)
                .digest('hex');

            let isValid = false;
            try {
                // Both buffers must be the same length for timingSafeEqual
                const sigBuf = Buffer.from(signature, 'hex');
                const expBuf = Buffer.from(expectedSignature, 'hex');
                if (sigBuf.length === expBuf.length) {
                    isValid = crypto.timingSafeEqual(sigBuf, expBuf);
                }
            } catch {
                isValid = false;
            }

            if (!isValid) {
                console.warn('[Facebook Leads Webhook] Rejected: invalid HMAC signature');
                return new NextResponse('Unauthorized', { status: 401 });
            }
        } else {
            console.warn('[Facebook Leads Webhook] Rejected: missing signature header');
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = JSON.parse(bodyText);

        if (body.object !== 'page') {
            return NextResponse.json({ status: 'ignored' });
        }

        for (const entry of body.entry || []) {
            const pageId = entry.id;
            for (const change of entry.changes || []) {
                if (change.field !== 'leadgen') continue;

                const leadgenId = change.value?.leadgen_id;
                const formId = change.value?.form_id;
                const adId = change.value?.ad_id;
                const adName = change.value?.ad_name;
                const adsetId = change.value?.adset_id;
                const campaignId = change.value?.campaign_id;
                const campaignName = change.value?.campaign_name;

                if (!leadgenId) continue;

                // Find the page integration to get the access token
                const supabaseAdmin = createSupabaseAdminClient();
                const { data: integration } = await supabaseAdmin
                    .from('facebook_integrations')
                    .select('page_access_token, user_id, tenant_id')
                    .eq('page_id', pageId)
                    .eq('is_active', true)
                    .single();

                if (!integration?.page_access_token) continue;

                // Fetch lead details from Graph API
                const leadRes = await fetch(
                    `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${integration.page_access_token}&fields=id,created_time,field_data,ad_id,form_id`
                );
                const leadData = await leadRes.json();

                if (!leadData.id) continue;

                // Parse field_data into named fields
                const fields: Record<string, string> = {};
                for (const f of leadData.field_data || []) {
                    fields[f.name] = f.values?.[0] || '';
                }

                const firstName = fields['first_name'] || fields['full_name']?.split(' ')[0] || '';
                const lastName = fields['last_name'] || fields['full_name']?.split(' ').slice(1).join(' ') || '';
                const email = fields['email'] || '';
                const phone = fields['phone_number'] || fields['phone'] || '';
                const company = fields['company_name'] || fields['company'] || '';
                const jobTitle = fields['job_title'] || '';

                // Insert facebook_lead record
                const { data: fbLead, error: fbLeadError } = await supabaseAdmin
                    .from('facebook_leads')
                    .upsert({
                        tenant_id: integration.tenant_id,
                        user_id: integration.user_id,
                        lead_id: leadgenId,
                        form_id: formId,
                        ad_id: adId,
                        ad_name: adName,
                        adset_id: adsetId,
                        campaign_id: campaignId,
                        campaign_name: campaignName,
                        page_id: pageId,
                        first_name: firstName,
                        last_name: lastName,
                        email,
                        phone,
                        company,
                        job_title: jobTitle,
                        field_data: fields,
                        status: 'new',
                        received_at: new Date().toISOString(),
                    }, { onConflict: 'lead_id' })
                    .select()
                    .single();

                if (fbLeadError) {
                    console.error('[Facebook Leads Webhook] Failed to upsert facebook_lead:', fbLeadError);
                    continue;
                }

                // Auto-create a lead in the main leads table
                if (fbLead && (email || phone || firstName)) {
                    const { data: createdLead } = await supabaseAdmin
                        .from('leads')
                        .insert({
                            tenant_id: integration.tenant_id,
                            business_name: company || `${firstName} ${lastName}`.trim(),
                            contact_name: `${firstName} ${lastName}`.trim(),
                            email,
                            phone,
                            industry: '',
                            source: 'Facebook Lead Ad',
                            source_details: `Campaign: ${campaignName || adName || formId}`,
                            status: 'new',
                            stage: 'lead',
                            notes: `Facebook Lead Ad. Form ID: ${formId}. All fields: ${JSON.stringify(fields)}`,
                            metadata: {
                                facebook_lead_id: leadgenId,
                                form_id: formId,
                                ad_id: adId,
                                campaign_id: campaignId,
                            },
                        })
                        .select('id')
                        .single();

                    if (createdLead) {
                        await supabaseAdmin
                            .from('facebook_leads')
                            .update({ crm_lead_id: createdLead.id, status: 'new' })
                            .eq('lead_id', leadgenId);
                    }
                }
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (err) {
        console.error('Facebook webhook error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
