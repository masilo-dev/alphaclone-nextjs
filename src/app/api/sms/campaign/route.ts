import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';

const campaignSchema = z.object({
    tenantId: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    message_body: z.string().trim().min(1).max(1600),
    from_number: z.string().trim().max(40).optional(),
    recipient_source: z.enum(['manual', 'contacts', 'leads', 'segment']).optional(),
    recipient_filter: z.record(z.string(), z.unknown()).optional(),
    scheduled_at: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    const { admin: supabase } = await requireTenantAccess(tenantId, req);

    const { data, error } = await supabase
        .from('sms_campaigns')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

    if (error) return clientErrorResponse(error, { request: req, scope: 'sms/campaign' });
    return NextResponse.json({ campaigns: data });
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const parsed = campaignSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid campaign details', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { tenantId, name, message_body, from_number, recipient_source, recipient_filter, scheduled_at } = parsed.data;
    const { admin: supabase } = await requireTenantAccess(tenantId, req);

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

export async function DELETE(req: NextRequest) {
    try {
        const tenantId = req.nextUrl.searchParams.get('tenantId') || '';
        const campaignId = req.nextUrl.searchParams.get('campaignId') || '';
        if (!z.string().uuid().safeParse(tenantId).success || !z.string().uuid().safeParse(campaignId).success) {
            return NextResponse.json({ error: 'Valid tenantId and campaignId required' }, { status: 400 });
        }
        const { admin } = await requireTenantAccess(tenantId, req);
        const { data, error } = await admin.from('sms_campaigns').delete().eq('tenant_id', tenantId).eq('id', campaignId).select('id').maybeSingle();
        if (error) throw error;
        if (!data) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch (error) {
        return routeErrorResponse(error, 'SMS campaign could not be deleted', req);
    }
}
