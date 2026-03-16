import { NextRequest, NextResponse } from 'next/server';
import { zohoServerService } from '@/services/server/zohoServerService';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { rateLimitMiddleware, rateLimitConfigs } from '@/lib/rateLimit';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const rateLimitRes = await rateLimitMiddleware(req, rateLimitConfigs.api.zoho);
    if (rateLimitRes) return rateLimitRes;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const result = await zohoServerService.deleteMessage(user.id, id);
        return NextResponse.json({ success: true, data: result });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: err.status || 500 });
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const rateLimitRes = await rateLimitMiddleware(req, rateLimitConfigs.api.zoho);
    if (rateLimitRes) return rateLimitRes;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const data = await zohoServerService.proxyRequest(user.id, `messages/${id}/details`);
        return NextResponse.json({ success: true, data: data.data || {} });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: err.status || 500 });
    }
}
