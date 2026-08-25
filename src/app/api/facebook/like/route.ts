import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getFacebookIntegrationWithToken } from '@/services/facebook/facebookIntegrationService';

type LikeRequestBody = {
    pageId: string;
    targetId: string; // post ID or comment ID
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

    const body = (await req.json()) as LikeRequestBody;
    const { pageId, targetId } = body;

    if (!pageId || !targetId) {
        return NextResponse.json(
            { error: 'pageId and targetId are required' },
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

    const endpoint = `https://graph.facebook.com/v21.0/${targetId}/likes`;

    const params = new URLSearchParams();
    params.set('access_token', token);

    let res: Response;
    try {
        res = await fetchWithRetry(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
    } catch (error) {
        console.error('[Facebook Like] network failure:', error);
        return NextResponse.json(
            { error: 'Facebook network error. Please retry.', code: 'FACEBOOK_NETWORK' },
            { status: 502 }
        );
    }

    const data = await res.json();
    if (!res.ok || data?.error) {
        const graphError = data?.error || {};
        const rawMessage = String(graphError.message || '');
        
        return NextResponse.json(
            { error: rawMessage || 'Failed to like target', code: 'FACEBOOK_GRAPH_ERROR' },
            { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
}
