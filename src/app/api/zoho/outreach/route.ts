import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { zohoServerService } from '@/services/server/zohoServerService';
import { routeAIRequest } from '@/services/aiRouter';

export const runtime = 'nodejs';
export const maxDuration = 300; // Increased timeout for bulk AI generation

export async function POST(req: Request) {
    try {
        const { userId, leadIds, customPrompt, tone, fromAddress } = await req.json();

        if (!userId || !leadIds || !Array.isArray(leadIds)) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        if (leadIds.length > 20) {
            return NextResponse.json({ error: 'Maximum 20 leads allowed at once' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        // Fetch leads from DB
        const { data: leads, error: leadError } = await supabase
            .from('leads')
            .select('*')
            .in('id', leadIds);

        if (leadError || !leads) {
            console.error('[Outreach API] Lead fetch error:', leadError);
            throw new Error('Failed to fetch lead data');
        }

        const results = [];

        // Fetch business name for context (from tenant or first lead's owner)
        // For simplicity, we'll assume AlphaClone Systems or fetch from the lead's notes if available
        const businessContext = "AlphaClone Systems (AI & Automation Agency)";

        for (const lead of leads) {
            const recipientEmail = lead.email;

            if (!recipientEmail) {
                results.push({
                    id: lead.id,
                    name: lead.business_name,
                    status: 'error',
                    error: 'No email address found for this lead'
                });
                continue;
            }

            try {
                console.log(`[Outreach API] Generating content for ${lead.business_name}...`);

                // 1. Generate Personalized AI Content
                const aiPrompt = `Write a personalized ${tone || 'professional'} outreach email to a business lead.
                
Lead Details:
- Business Name: ${lead.business_name}
- Industry: ${lead.industry || 'General Business'}
- Location: ${lead.location || 'Unknown'}
- Additional Info: ${lead.sdr_insight || lead.notes || 'N/A'}

Writer Context:
- Company: ${businessContext}
- Goal: ${customPrompt || 'Introduce our AI automation services and schedule a demo.'}

Requirements:
- First line should be a specific, personalized observation about their business or industry.
- Keep the body under 150 words.
- Use a clear, high-intent subject line.
- Format strictly as:
Subject: [Subject Line]

[Message Body]`;

                const aiResponse = await routeAIRequest({
                    prompt: aiPrompt,
                    maxTokens: 600,
                    temperature: 0.7
                });

                if (!aiResponse.success || !aiResponse.content) {
                    throw new Error(aiResponse.error || 'AI content generation failed');
                }

                const rawContent = aiResponse.content.trim();

                // 2. Parse Subject and Body
                const subjectLineMatch = rawContent.match(/^Subject:\s*(.*)/im);
                const subject = subjectLineMatch ? subjectLineMatch[1].trim() : `Strategic Partnership: ${lead.business_name} x AlphaClone`;

                // Remove the subject line from the body
                let body = rawContent.replace(/^Subject:.*\n?/im, '').trim();

                // Convert newlines to HTML for Zoho
                const htmlBody = body.replace(/\n/g, '<br/>');

                // 3. Send via Zoho
                console.log(`[Outreach API] Sending email to ${recipientEmail} via Zoho...`);
                await zohoServerService.sendMessage(userId, {
                    toAddress: recipientEmail,
                    subject: subject,
                    content: htmlBody,
                    fromAddress: fromAddress
                });

                // 4. Update lead status in DB
                await supabase
                    .from('leads')
                    .update({
                        outreach_status: 'sent',
                        outreach_message: body,
                        last_outreach_at: new Date().toISOString()
                    })
                    .eq('id', lead.id);

                results.push({
                    id: lead.id,
                    name: lead.business_name,
                    status: 'success'
                });

            } catch (err: any) {
                console.error(`[Outreach API] Error processing lead ${lead.id}:`, err);
                results.push({
                    id: lead.id,
                    name: lead.business_name,
                    status: 'error',
                    error: err.message
                });
            }
        }

        return NextResponse.json({
            success: true,
            processedCount: leads.length,
            results
        });

    } catch (error: any) {
        console.error('[Outreach API Global Error]:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error during outreach process'
        }, { status: 500 });
    }
}
