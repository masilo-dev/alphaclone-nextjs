import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { getFacebookIntegration, getFacebookTokens } from '@/services/facebook/facebookIntegrationService';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pageId = (searchParams.get('pageId') || '').trim();
  const postId = (searchParams.get('postId') || '').trim();
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25', 10), 1), 100);

  if (!pageId || !postId) {
    return NextResponse.json(
      { success: false, error: 'pageId and postId are required' },
      { status: 400 }
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    const integration = await getFacebookIntegration(admin, { userId: user.id, pageId });

    const tokens = integration ? await getFacebookTokens(admin, integration) : { pageAccessToken: null, userAccessToken: null };
    const token = tokens.pageAccessToken || tokens.userAccessToken;
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Facebook page token not found. Reconnect your Facebook page.',
          code: 'FACEBOOK_RECONNECT_REQUIRED',
          action: 'reconnect',
        },
        { status: 400 }
      );
    }

    const fields = [
      'id',
      'message',
      'created_time',
      'from',
      'like_count',
      'comments.limit(10){id,message,created_time,from,like_count}',
    ].join(',');

    const url = `https://graph.facebook.com/v21.0/${postId}/comments?fields=${fields}&filter=stream&order=reverse_chronological&limit=${limit}&access_token=${token}`;
    const response = await fetch(url, { next: { revalidate: 0 } });
    const data = await response.json();

    if (!response.ok || data?.error) {
      const message = data?.error?.message || 'Failed to load comments';
      return NextResponse.json(
        { success: false, error: message, code: 'FACEBOOK_GRAPH_ERROR' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      comments: Array.isArray(data?.data) ? data.data : [],
      paging: data?.paging || null,
    });
  } catch (error: unknown) {
    return clientErrorResponse(error, { request: req, scope: 'facebook/comments.GET' });
  }
}
