import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { pageId, message, link, imageUrl } = await req.json();
    if (!pageId || !message) return NextResponse.json({ error: 'pageId and message required' }, { status: 400 });

    const { data: integration } = await supabase
        .from('facebook_integrations')
        .select('page_access_token, user_access_token, page_name')
        .eq('user_id', user.id)
        .eq('page_id', pageId)
        .eq('is_active', true)
        .single();

    const token = integration?.page_access_token || integration?.user_access_token;
    if (!token) {
        return NextResponse.json({ error: 'Facebook page not connected — please reconnect your page to grant posting permissions' }, { status: 400 });
    }

    const body: Record<string, string> = {
        message,
        access_token: token,
    };
    if (link) body.link = link;

    const endpoint = imageUrl
        ? `https://graph.facebook.com/v19.0/${pageId}/photos`
        : `https://graph.facebook.com/v19.0/${pageId}/feed`;

    if (imageUrl) body.url = imageUrl;

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });

    return NextResponse.json({ success: true, post_id: data.id || data.post_id });
}
