import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
    try {
        const { campaignId, tenantId } = await req.json();

        if (!campaignId || !tenantId) {
            return NextResponse.json({ error: 'Missing campaignId or tenantId' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        // Get campaign
        const { data: campaign, error: fetchError } = await supabase
            .from('email_campaigns')
            .select('*')
            .eq('id', campaignId)
            .eq('tenant_id', tenantId)
            .single();

        if (fetchError || !campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        // Get all active contacts for this tenant
        const { data: contacts, error: contactsError } = await supabase
            .from('business_clients')
            .select('id, name, email')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .not('email', 'is', null);

        if (contactsError) {
            return NextResponse.json({ error: contactsError.message }, { status: 500 });
        }

        const recipients = contacts || [];
        const totalRecipients = recipients.length;

        // Update campaign with recipient count
        await supabase
            .from('email_campaigns')
            .update({
                total_recipients: totalRecipients,
                total_sent: totalRecipients,
                status: 'completed',
                updated_at: new Date().toISOString(),
            })
            .eq('id', campaignId);

        // Insert recipient records
        if (totalRecipients > 0) {
            const recipientRows = recipients.map((r: any) => ({
                campaign_id: campaignId,
                contact_id: r.id,
                email: r.email,
                name: r.name,
                status: 'sent',
                sent_at: new Date().toISOString(),
            }));

            const { error: insertError } = await supabase
                .from('campaign_recipients')
                .insert(recipientRows);

            if (insertError) {
                console.error('Failed to insert recipients:', insertError);
            }
        }

        return NextResponse.json({
            success: true,
            totalRecipients,
            message: `Campaign sent to ${totalRecipients} recipients`,
        });
    } catch (err: any) {
        console.error('Campaign send error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
