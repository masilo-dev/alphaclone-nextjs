import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const pageId = formData.get('pageId') as string;
    const message = formData.get('message') as string;
    const file = formData.get('file') as File | null;

    if (!pageId || !file) {
        return NextResponse.json({ error: 'pageId and file are required' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    const { data: integration } = await supabase
        .from('facebook_integrations')
        .select('page_access_token')
        .eq('user_id', user.id)
        .eq('page_id', pageId)
        .eq('is_active', true)
        .single();

    if (!integration?.page_access_token) {
        return NextResponse.json({
            error: 'Page Access Token missing. Please reconnect your Facebook account.',
            action: 'reconnect',
        }, { status: 400 });
    }

    // Forward directly to Facebook Photos API using multipart/form-data with `source`
    const fbForm = new FormData();
    fbForm.append('source', file);
    if (message?.trim()) fbForm.append('caption', message.trim());
    fbForm.append('access_token', integration.page_access_token);

    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
        method: 'POST',
        body: fbForm,
    });

    const data = await res.json();

    if (data.error) {
        console.error('[Facebook Photo Upload] Graph API error:', data.error);
        if (data.error.code === 200 || data.error.message?.includes('pages_manage_posts')) {
            return NextResponse.json(
                {
                    error: 'Permission denied. Reconnect your Facebook page to grant photo posting permission.',
                    code: 'FACEBOOK_PERMISSION',
                    action: 'reconnect',
                },
                { status: 403 }
            );
        }
        return NextResponse.json(
            { error: 'Photo upload failed', code: 'FACEBOOK_GRAPH_ERROR' },
            { status: 400 }
        );
    }

    return NextResponse.json({ success: true, post_id: data.id || data.post_id });
}
