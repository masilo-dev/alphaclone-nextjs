import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getFacebookIntegrationWithToken } from '@/services/facebook/facebookIntegrationService';

type CommentRequestBody = {
    pageId?: string;
    postId?: string;
    parentCommentId?: string;
    message?: string;
};

async function fetchWithRetry(url: string, init: RequestInit, attempts = 2): Promise<Response> {
    let lastError: unknown = null;
    for (let i = 0; i < attempts; i++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);
        try {
            const response = await fetch(url, { ...init, signal: controller.signal });
            clearTimeout(timeout);
            return response;
        } catch (error: any) {
            clearTimeout(timeout);
            lastError = error;
            const causeCode = error?.cause?.code;
            const retryable = causeCode === 'UND_ERR_SOCKET' || error?.name === 'AbortError';
            if (!retryable || i === attempts - 1) throw error;
            await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Fetch failed');
}

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as CommentRequestBody;
    const pageId = body.pageId?.trim();
    const postId = body.postId?.trim();
    const parentCommentId = body.parentCommentId?.trim();
    const message = body.message?.trim();

    if (!pageId || !message || (!postId && !parentCommentId)) {
        return NextResponse.json(
            { error: 'pageId, message, and postId or parentCommentId are required' },
            { status: 400 }
        );
    }

    const admin = createSupabaseAdminClient();
    const integration = await getFacebookIntegrationWithToken(admin, { userId: user.id, pageId });

    const token = integration?.pageAccessToken;
    if (!token) {
        return NextResponse.json(
            {
                error: 'Facebook page token not found. Reconnect your Facebook page.',
                code: 'FACEBOOK_RECONNECT_REQUIRED',
                action: 'reconnect',
            },
            { status: 400 }
        );
    }

    const targetId = parentCommentId || postId;
    const endpoint = `https://graph.facebook.com/v21.0/${targetId}/comments`;

    const params = new URLSearchParams();
    params.set('message', message);
    params.set('access_token', token);

    let res: Response;
    try {
        res = await fetchWithRetry(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
    } catch (error) {
        console.error('[Facebook Comment] network failure:', error);
        return NextResponse.json(
            { error: 'Facebook network error. Please retry.', code: 'FACEBOOK_NETWORK' },
            { status: 502 }
        );
    }

    const data = await res.json();
    if (!res.ok || data?.error) {
        const graphError = data?.error || {};
        const rawMessage = String(graphError.message || '');
        if (
            graphError.code === 190 ||
            graphError.code === 200 ||
            rawMessage.includes('pages_manage_engagement') ||
            rawMessage.includes('pages_read_engagement') ||
            rawMessage.includes('permissions')
        ) {
            return NextResponse.json(
                {
                    error: 'Missing Facebook page engagement permissions. Reconnect and approve all Page permissions.',
                    code: 'FACEBOOK_PERMISSION',
                    action: 'reconnect',
                },
                { status: 403 }
            );
        }

        return NextResponse.json(
            { error: rawMessage || 'Failed to publish comment', code: 'FACEBOOK_GRAPH_ERROR' },
            { status: 400 }
        );
    }

    return NextResponse.json({ success: true, commentId: data?.id || null });
}
