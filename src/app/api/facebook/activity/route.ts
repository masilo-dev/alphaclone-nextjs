import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getFacebookIntegration, getFacebookTokens } from '@/services/facebook/facebookIntegrationService';

export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get('pageId');
    const tenantId = searchParams.get('tenantId');

    if (!pageId || !tenantId) return NextResponse.json({ error: 'pageId and tenantId required' }, { status: 400 });
    const { data: membership } = await supabase.from('tenant_users').select('tenant_id')
        .eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = createSupabaseAdminClient();
    const integration = await getFacebookIntegration(admin, { tenantId, userId: user.id, pageId });

    const tokens = integration ? await getFacebookTokens(admin, integration) : { pageAccessToken: null, userAccessToken: null };
    const token = tokens.pageAccessToken || tokens.userAccessToken;
    if (!token) {
        return NextResponse.json({ error: 'Facebook page not connected or token missing — please reconnect' }, { status: 400 });
    }

    try {
        // Fetch page feed (posts, comments, etc.)
        const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed?fields=id,message,created_time,story,full_picture,permalink_url,actions,shares,comments.summary(true),reactions.summary(true)&limit=10&access_token=${token}`);
        
        const data = await res.json();
        
        if (data.error) {
            console.error('[Facebook activity] Graph error:', data.error);
            return NextResponse.json(
                { error: 'Facebook could not load activity for this page.', code: 'FACEBOOK_GRAPH_ERROR' },
                { status: 400 }
            );
        }

        return NextResponse.json({ 
            success: true, 
            activity: data.data || [] 
        });
    } catch (err: any) {
        return clientErrorResponse(err, { request: req, scope: 'facebook/activity' });
    }
}
