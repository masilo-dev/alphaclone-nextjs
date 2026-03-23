import { NextRequest, NextResponse } from 'next/server';
import { gmailServerService } from '../../../services/server/gmailServerService';
import { createSupabaseAdminClient } from '../../../lib/supabase-server';
import { routeAIRequest as generateText } from '../../../services/aiRouter';

export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const body = await req.json();
        const { leadIds, customPrompt, tone, fromAddress } = body;

        if (!userId || !leadIds || !Array.isArray(leadIds)) {
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
            } catch (err: any) {
                console.error(`Failed to send outreach to ${lead.businessName}:`, err);
                results.push({ name: lead.businessName, status: 'error', error: err.message });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('Gmail Outreach Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
