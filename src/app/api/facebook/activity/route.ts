import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get('pageId');

    if (!pageId) return NextResponse.json({ error: 'pageId required' }, { status: 400 });

    const { data: integration } = await supabase
        .from('facebook_integrations')
        .select('page_access_token')
        .eq('user_id', user.id)
        .eq('page_id', pageId)
        .eq('is_active', true)
        .single();

    if (!integration?.page_access_token) {
        return NextResponse.json({ error: 'Facebook page not connected' }, { status: 400 });
    }

    try {
        // Fetch page feed (posts, comments, etc.)
        const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed?fields=id,message,created_time,story,full_picture,permalink_url,actions,shares,comments.summary(true),reactions.summary(true)&limit=10&access_token=${integration.page_access_token}`);
        
        const data = await res.json();
        
        if (data.error) {
            return NextResponse.json({ error: data.error.message }, { status: 400 });
        }

        return NextResponse.json({ 
            success: true, 
            activity: data.data || [] 
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Failed to fetch activity' }, { status: 500 });
    }
}
