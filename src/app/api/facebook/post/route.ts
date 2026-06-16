import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isSocialPublishEnabled } from '@/lib/social/publishConfig';

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

    if (!isSocialPublishEnabled()) {
        return NextResponse.json({ error: 'Publishing disabled' }, { status: 403 });
    }

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

    // Also post to Instagram if connected
    const { data: instagramAccount } = await supabase
        .from('facebook_integrations')
        .select('instagram_account_id, instagram_access_token')
        .eq('user_id', user.id)
        .eq('page_id', pageId)
        .eq('is_active', true)
        .single();

    if (instagramAccount?.instagram_account_id && instagramAccount?.instagram_access_token) {
        try {
            const igBody: Record<string, string> = {
                caption: message,
                access_token: instagramAccount.instagram_access_token,
            };
            if (imageUrl) {
                igBody.image_url = imageUrl;
                const igRes = await fetch(
                    `https://graph.facebook.com/v19.0/${instagramAccount.instagram_account_id}/media`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(igBody),
                    }
                );
                const igData = await igRes.json();
                if (igData.id) {
                    // Publish the media
                    await fetch(
                        `https://graph.facebook.com/v19.0/${instagramAccount.instagram_account_id}/media_publish`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                creation_id: igData.id,
                                access_token: instagramAccount.instagram_access_token,
                            }),
                        }
                    );
                }
            } else {
                // Carousel or simple post not supported for Instagram without media
                console.log('Instagram post requires media (image/video)');
            }
        } catch (igErr) {
            console.error('Instagram posting failed:', igErr);
        }
    }

    let res: Response;
    try {
        res = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        });
    } catch (error: any) {
        console.error('[Facebook Post] network failure:', error);
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
        console.error('[Facebook Post] Graph API error:', data.error);

        // Provide a helpful message for the specific permissions error (code 200)
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
                    error: 'Reconnect Facebook and grant Page publishing permissions.',
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

    // Also post to LinkedIn if connected
    const { data: linkedinIntegration } = await supabase
        .from('linkedin_integrations')
        .select('access_token, organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

    if (linkedinIntegration?.access_token) {
        try {
            const liBody: Record<string, any> = {
                author: `urn:li:organization:${linkedinIntegration.organization_id}`,
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: {
                            text: message,
                        },
                        shareMediaCategory: imageUrl ? 'IMAGE' : 'NONE',
                    },
                },
                visibility: {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
                },
            };

            if (imageUrl) {
                // Register image upload first
                const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${linkedinIntegration.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        registerUploadRequest: {
                            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                            owner: `urn:li:organization:${linkedinIntegration.organization_id}`,
                            serviceRelationships: [{
                                relationshipType: 'OWNER',
                                identifier: 'urn:li:userGeneratedContent',
                            }],
                        },
                    }),
                });
                const registerData = await registerRes.json();
                const uploadUrl = registerData?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
                if (uploadUrl) {
                    // Upload image
                    const imageRes = await fetch(imageUrl);
                    const imageBlob = await imageRes.blob();
                    await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'image/jpeg' },
                        body: imageBlob,
                    });
                    liBody.specificContent['com.linkedin.ugc.ShareContent'].media = [{
                        status: 'READY',
                        media: registerData.value.asset,
                    }];
                }
            }

            await fetch('https://api.linkedin.com/v2/ugcPosts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${linkedinIntegration.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(liBody),
            });
        } catch (liErr) {
            console.error('LinkedIn posting failed:', liErr);
        }
    }

    return NextResponse.json({ success: true, post_id: data.id || data.post_id });
}
