import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

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
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const pageId = formData.get('pageId') as string;
    const message = formData.get('message') as string;
    const file = formData.get('file') as File | null;
    const fileUrl = formData.get('fileUrl') as string | null;
    const fileTypeParam = formData.get('fileType') as string | null;
    const coverFrame = formData.get('coverFrame') as File | null;

    if (!pageId) {
        return NextResponse.json({ error: 'pageId is required' }, { status: 400 });
    }

    let fileStream: Blob | File | null = null;
    let fileType = '';
    let fileName = 'file';

    if (fileUrl) {
        try {
            const fileRes = await fetch(fileUrl);
            if (!fileRes.ok) {
                return NextResponse.json({ error: 'Failed to retrieve media file from storage' }, { status: 400 });
            }
            const blob = await fileRes.blob();
            fileStream = blob;
            fileType = fileTypeParam || blob.type || '';
            fileName = fileUrl.split('/').pop() || 'file';
        } catch (fetchErr) {
            console.error('[Facebook Media Upload] failed to fetch fileUrl:', fetchErr);
            return NextResponse.json({ error: 'Failed to download file from URL' }, { status: 400 });
        }
    } else if (file) {
        fileStream = file;
        fileType = file.type || '';
        fileName = file.name || 'file';
    }

    if (!fileStream) {
        return NextResponse.json({ error: 'file or fileUrl is required' }, { status: 400 });
    }

    const isImage = fileType.startsWith('image/');
    const isVideo = fileType.startsWith('video/');
    if (!isImage && !isVideo) {
        return NextResponse.json({ error: 'File must be an image or video' }, { status: 400 });
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

    // Forward directly to Facebook Photos/Videos API using multipart/form-data with `source`
    const fbForm = new FormData();
    fbForm.append('source', fileStream, fileName);
    if (message?.trim()) {
        if (isVideo) {
            fbForm.append('description', message.trim());
        } else {
            fbForm.append('caption', message.trim());
        }
    }
    fbForm.append('access_token', integration.page_access_token);
    if (isVideo && coverFrame && coverFrame.type.startsWith('image/')) {
        fbForm.append('thumb', coverFrame);
    }

    const endpoint = isVideo
        ? `https://graph.facebook.com/v19.0/${pageId}/videos`
        : `https://graph.facebook.com/v19.0/${pageId}/photos`;

    let res: Response;
    try {
        res = await fetchWithRetry(endpoint, {
        method: 'POST',
        body: fbForm,
        });
    } catch (error: any) {
        console.error('[Facebook Media Upload] network failure:', error);
        return NextResponse.json(
            {
                error: 'Facebook network error. Please retry.',
                code: 'FACEBOOK_NETWORK',
            },
            { status: 502 }
        );
    }

    const data = await res.json();

    if (data.error) {
        console.error('[Facebook Media Upload] Graph API error:', data.error);
        const message = String(data.error.message || '');
        if (
            data.error.code === 200 ||
            data.error.code === 190 ||
            message.includes('pages_manage_posts') ||
            message.includes('pages_read_engagement') ||
            message.includes('impersonating a')
        ) {
            return NextResponse.json(
                {
                    error: 'Permission denied. Reconnect Facebook and grant Page publishing permissions.',
                    code: 'FACEBOOK_PERMISSION',
                    action: 'reconnect',
                },
                { status: 403 }
            );
        }
        return NextResponse.json(
            { error: 'Media upload failed', code: 'FACEBOOK_GRAPH_ERROR' },
            { status: 400 }
        );
    }

    return NextResponse.json({ success: true, post_id: data.id || data.post_id });
}
