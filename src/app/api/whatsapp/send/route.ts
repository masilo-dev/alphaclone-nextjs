import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { tenantId, to, message } = await req.json();

        if (!tenantId || !to || !message) {
            return NextResponse.json({ error: 'tenantId, to, and message are required' }, { status: 400 });
        }

        // Check for WhatsApp integration
        const { data: integration } = await supabase
            .from('integrations')
            .select('config')
            .eq('tenant_id', tenantId)
            .eq('type', 'whatsapp')
            .eq('enabled', true)
            .single();

        if (!integration?.config) {
            // No WhatsApp integration - return fallback URL
            return NextResponse.json({
                success: false,
                fallbackUrl: `https://wa.me/${to.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`,
                error: 'WhatsApp integration not configured'
            });
        }

        const config = integration.config as Record<string, any>;
        const provider = config.provider || 'twilio';

        if (provider === 'twilio') {
            const accountSid = config.accountSid;
            const authToken = config.authToken;
            const from = config.fromNumber;

            if (!accountSid || !authToken || !from) {
                return NextResponse.json({
                    success: false,
                    fallbackUrl: `https://wa.me/${to.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`,
                    error: 'Twilio configuration incomplete'
                });
            }

            const twilioRes = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        To: `whatsapp:${to}`,
                        From: `whatsapp:${from}`,
                        Body: message,
                    }),
                }
            );

            const twilioData = await twilioRes.json();

            if (!twilioRes.ok) {
                return NextResponse.json({
                    success: false,
                    fallbackUrl: `https://wa.me/${to.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`,
                    error: twilioData.message || 'Twilio send failed'
                });
            }

            return NextResponse.json({ success: true, messageId: twilioData.sid });
        }

        // Fallback for other providers
        return NextResponse.json({
            success: false,
            fallbackUrl: `https://wa.me/${to.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`,
            error: 'Unsupported WhatsApp provider'
        });

    } catch (error) {
        console.error('WhatsApp send error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to send WhatsApp message'
        }, { status: 500 });
    }
}
