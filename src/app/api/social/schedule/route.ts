import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
        tenantId, title, caption, platforms, media_urls, media_types,
        link_url, hashtags, scheduled_at, facebook_page_id,
    } = body;

    if (!tenantId || !caption) {
        return NextResponse.json({ error: 'tenantId and caption required' }, { status: 400 });
    }

    const status = scheduled_at ? 'scheduled' : 'draft';

    const { data: post, error } = await supabase
        .from('social_posts')
        .insert({
            tenant_id: tenantId,
            user_id: user.id,
            title,
            caption,
            platforms: platforms || [],
            media_urls: media_urls || [],
            media_types: media_types || [],
            link_url: link_url || null,
            hashtags: hashtags || [],
            status,
            scheduled_at: scheduled_at || null,
            facebook_page_id: facebook_page_id || null,
        })
        .select()
        .single();

    if (error) return clientErrorResponse(error, { request: req, scope: 'social/schedule' });

    // If publishing now (no scheduled_at, platform includes facebook), post immediately
    if (!scheduled_at && platforms?.includes('facebook') && facebook_page_id) {
        publishToFacebook(post.id, tenantId, facebook_page_id, caption, media_urls?.[0], link_url).catch(console.error);
    }

    return NextResponse.json({ success: true, post });
}

export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const { data, error } = await supabase
        .from('social_posts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

    if (error) return clientErrorResponse(error, { request: req, scope: 'social/schedule' });
    return NextResponse.json({ posts: data });
}

async function publishToFacebook(
    postId: string, tenantId: string, pageId: string,
    caption: string, imageUrl?: string, linkUrl?: string
) {
    const { createSupabaseAdminClient } = await import('@/lib/supabase-server');
    const adminClient = createSupabaseAdminClient();

    try {
        const { data: integration } = await adminClient
            .from('facebook_integrations')
            .select('page_access_token')
            .eq('page_id', pageId)
            .eq('is_active', true)
            .single();

        if (!integration?.page_access_token) {
            await adminClient.from('social_posts').update({ status: 'failed', error_message: 'Page not connected' }).eq('id', postId);
            return;
        }

        await adminClient.from('social_posts').update({ status: 'publishing' }).eq('id', postId);

        const fbBody: Record<string, string> = {
            message: caption,
            access_token: integration.page_access_token,
        };
        if (linkUrl) fbBody.link = linkUrl;
        if (imageUrl) fbBody.url = imageUrl;

        const endpoint = imageUrl
            ? `https://graph.facebook.com/v19.0/${pageId}/photos`
            : `https://graph.facebook.com/v19.0/${pageId}/feed`;

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fbBody),
        });
        const result = await res.json();

        if (result.error) {
            console.error('[social/schedule] Facebook Graph error:', result.error);
            await adminClient
                .from('social_posts')
                .update({ status: 'failed', error_message: 'Facebook publish failed' })
                .eq('id', postId);
        } else {
            await adminClient.from('social_posts').update({
                status: 'published',
                facebook_post_id: result.id || result.post_id,
                published_at: new Date().toISOString(),
            }).eq('id', postId);
        }
    } catch (err) {
        console.error('[social/schedule] publish job:', err);
        await adminClient
            .from('social_posts')
            .update({ status: 'failed', error_message: 'Publish job failed' })
            .eq('id', postId);
    }
}
