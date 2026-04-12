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

    if (!integration) {
        return NextResponse.json({ error: 'Facebook page not connected. Please reconnect your Facebook account.' }, { status: 400 });
    }

    // IMPORTANT: Posting to a Facebook Page REQUIRES the Page Access Token.
    // Using the User Access Token will always fail with the permissions error:
    // "requires pages_read_engagement and pages_manage_posts".
    // The Page Access Token is obtained during the OAuth callback via /me/accounts.
    const token = integration.page_access_token;

    if (!token) {
        return NextResponse.json({
            error: 'Page Access Token is missing. Please disconnect and reconnect your Facebook account to refresh permissions.',
            action: 'reconnect',
        }, { status: 400 });
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

    if (data.error) {
        console.error('[Facebook Post] Graph API error:', data.error);

        // Provide a helpful message for the specific permissions error (code 200)
        if (data.error.code === 200 || data.error.message?.includes('pages_manage_posts')) {
            return NextResponse.json(
                {
                    error: 'Reconnect your Facebook page to grant required posting permissions.',
                    code: 'FACEBOOK_PERMISSION',
                    action: 'reconnect',
                },
                { status: 403 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to post to Facebook', code: 'FACEBOOK_GRAPH_ERROR' },
            { status: 400 }
        );
    }

    return NextResponse.json({ success: true, post_id: data.id || data.post_id });
}
