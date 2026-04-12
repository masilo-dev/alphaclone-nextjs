import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { OPERATION_FAILED_MESSAGE } from '@/lib/api/operationResult';
import { UNITS_PER_OUTREACH_EMAIL } from '@/config/aiUsageQuotas';
import { consumeAiUnitsOr429 } from '@/lib/quotas/tenantAiUnitsQuota';
import { gmailServerService } from '../../../services/server/gmailServerService';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../lib/supabase-server';
import { routeAIRequest as generateText } from '../../../services/aiRouter';

export async function POST(req: NextRequest) {
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { leadIds, customPrompt, tone, fromAddress } = body;
        const userId = user.id;

        if (!leadIds || !Array.isArray(leadIds)) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdminClient();
        
        // Fetch leads
        const { data: leads, error: leadsError } = await supabaseAdmin
            .from('leads')
            .select('*')
            .in('id', leadIds);

        if (leadsError || !leads) {
            return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
        }

        if (leads.length === 0) {
            return NextResponse.json({ success: true, results: [] });
        }

        const tenantId = (leads[0] as { tenant_id?: string }).tenant_id;
        if (!tenantId) {
            return NextResponse.json({ error: 'Leads must belong to a workspace' }, { status: 400 });
        }
        for (const lead of leads) {
            if ((lead as { tenant_id?: string }).tenant_id !== tenantId) {
                return NextResponse.json({ error: 'All leads must belong to the same workspace' }, { status: 400 });
            }
        }

        const { data: membership } = await authClient
            .from('user_tenant_roles')
            .select('tenant_id')
            .eq('user_id', userId)
            .eq('tenant_id', tenantId)
            .maybeSingle();

        if (!membership?.tenant_id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { data: tenantRow } = await supabaseAdmin
            .from('tenants')
            .select('subscription_plan')
            .eq('id', tenantId)
            .maybeSingle();
        const plan = (tenantRow?.subscription_plan as string) || 'free';

        const totalUnits = UNITS_PER_OUTREACH_EMAIL * leads.length;
        const quotaBlock = await consumeAiUnitsOr429(supabaseAdmin, tenantId, plan, totalUnits);
        if (quotaBlock) return quotaBlock;

        const results = [];

        for (const lead of leads) {
            try {
                // Generate personalized email
                const prompt = `Write a short, professional cold email to "${lead.businessName}" (Industry: ${lead.industry || 'Business'}, Location: ${lead.location || 'Unknown'}).
                
                Product/Service representing: AlphaClone Systems (AI & Automation Agency).
                Goal: Offer to automate their workflow or improve their digital presence.
                Tone: ${tone || 'professional'}.
                Special Instructions: ${customPrompt || 'None'}.
                
                Format:
                Subject: [Subject Here]
                
                [Body Here]`;

                const aiResponse = await generateText({
                    prompt,
                    maxTokens: 500,
                    temperature: 0.7
                });

                const content = aiResponse.content;
                const subjectMatch = content.match(/Subject:\s*(.*)/i);
                const subject = subjectMatch ? subjectMatch[1].trim() : `Opportunity for ${lead.businessName}`;
                const messageBody = content.replace(/Subject:.*\n/i, '').trim();

                // Send via Gmail
                const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
                const messageParts = [
                    `To: ${lead.email}`,
                    `Subject: ${utf8Subject}`,
                    `Content-Type: text/plain; charset="UTF-8"`,
                    '',
                    messageBody,
                ];

                const message = messageParts.join('\n');
                const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

                await gmailServerService.proxyRequest(userId, 'messages/send', {
                    method: 'POST',
                    body: JSON.stringify({ raw: encodedMessage }),
                });

                results.push({ name: lead.businessName, status: 'success' });
            } catch (err: unknown) {
                console.error(`Failed to send outreach to ${lead.businessName}:`, err);
                results.push({ name: lead.businessName, status: 'error', error: OPERATION_FAILED_MESSAGE });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('Gmail Outreach Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'outreach' });
    }
}
