import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const { data, error } = await supabase
        .from('sms_campaigns')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

    if (error) return clientErrorResponse(error, { request: req, scope: 'sms/campaign' });
    return NextResponse.json({ campaigns: data });
}

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { tenantId, name, message_body, from_number, recipient_source, recipient_filter, scheduled_at } = body;

    if (!tenantId || !name || !message_body) {
        return NextResponse.json({ error: 'tenantId, name, and message_body required' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('sms_campaigns')
        .insert({
            tenant_id: tenantId,
            name,
            message_body,
            from_number: from_number || null,
            recipient_source: recipient_source || 'manual',
            recipient_filter: recipient_filter || {},
            scheduled_at: scheduled_at || null,
            status: scheduled_at ? 'scheduled' : 'draft',
        })
        .select()
        .single();

    if (error) return clientErrorResponse(error, { request: req, scope: 'sms/campaign' });
    return NextResponse.json({ campaign: data });
}
