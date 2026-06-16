import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase
            .from('email_campaigns')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ campaigns: data || [] });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const supabase = createSupabaseAdminClient();

        const { data, error } = await supabase
            .from('email_campaigns')
            .insert({
                tenant_id: body.tenant_id,
                name: body.name,
                subject: body.subject,
                from_name: body.from_name,
                from_email: body.from_email,
                template_id: body.template_id,
                scheduled_at: body.scheduled_at,
                segment_filter: body.segment_filter || {},
                status: body.scheduled_at ? 'scheduled' : 'draft',
                created_by: body.created_by,
                total_recipients: 0,
                total_sent: 0,
                total_delivered: 0,
                total_opened: 0,
                total_clicked: 0,
                total_bounced: 0,
                total_unsubscribed: 0,
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ campaign: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const tenantId = searchParams.get('tenantId');

        if (!id || !tenantId) {
            return NextResponse.json({ error: 'Missing id or tenantId' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { error } = await supabase
            .from('email_campaigns')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenantId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
