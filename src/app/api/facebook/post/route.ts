import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { isSocialPublishEnabled } from '@/lib/social/publishConfig';
import { linkedInFetch } from '@/lib/linkedin/linkedinClient';
import {
  extractCompanyPagesFromMetadata,
  getLinkedInIntegrationWithToken,
} from '@/services/linkedin/linkedinIntegrationService';
import {
  buildFacebookTextOnlyFallbackMeta,
  isFacebookMediaAttachmentError,
  publishFacebookFeedTextOnly,
} from '@/lib/social/facebookTextOnlyFallback';
import { formatFacebookGraphErrorMessage, parseFacebookGraphError } from '@/lib/facebook/parseFacebookGraphError';

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
        .select('id, page_id, page_name, tenant_id, page_access_token, user_access_token, expires_at')
        .eq('user_id', user.id)
        .eq('page_id', pageId)
        .eq('is_active', true)
        .single();

    if (!integration) {
        return NextResponse.json({ error: 'Facebook page not connected. Please reconnect your Facebook account.' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { getFacebookTokens } = await import('@/services/facebook/facebookIntegrationService');
    const tokens = await getFacebookTokens(admin, integration);
    const token = tokens.pageAccessToken;

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
        ? `https://graph.facebook.com/v21.0/${pageId}/photos`
        : `https://graph.facebook.com/v21.0/${pageId}/feed`;

    if (imageUrl) body.url = imageUrl;

    // Also post to Instagram when a linked Business account exists for this Page
    if (imageUrl && integration.tenant_id) {
        try {
            const { getInstagramIntegrationWithToken } = await import(
                '@/services/instagram/instagramIntegrationService'
            );
            const igIntegration = await getInstagramIntegrationWithToken(admin, {
                tenantId: integration.tenant_id,
                userId: user.id,
                facebookPageId: String(pageId),
            });
            if (igIntegration) {
                const igToken = igIntegration.pageAccessToken;
                const igAccountId = igIntegration.instagram_account_id;
                const igRes = await fetch(
                    `https://graph.facebook.com/v21.0/${igAccountId}/media`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            image_url: imageUrl,
                            caption: message,
                            access_token: igToken,
                        }),
                    }
                );
                const igData = await igRes.json();
                if (igData.id) {
                    await fetch(
                        `https://graph.facebook.com/v21.0/${igAccountId}/media_publish`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                creation_id: igData.id,
                                access_token: igToken,
                            }),
                        }
                    );
                } else if (igData.error) {
                    console.error('[Facebook Post] Instagram cross-post failed:', igData.error);
                }
            }
        } catch (igErr) {
            console.error('[Facebook Post] Instagram cross-post failed:', igErr);
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

        const parsed = parseFacebookGraphError(res.status, data);
        const graphMessage = formatFacebookGraphErrorMessage(parsed);

        // Media URL failures are not Facebook auth failures — retry caption-only.
        if (imageUrl && isFacebookMediaAttachmentError(res.status, data)) {
            const fallbackMeta = buildFacebookTextOnlyFallbackMeta({
                httpStatus: res.status,
                body: data,
            });
            const textOnly = await publishFacebookFeedTextOnly({
                pageId,
                pageAccessToken: token,
                caption: message,
                linkUrl: link || null,
            });
            if (textOnly.ok) {
                return NextResponse.json({
                    success: true,
                    post_id: (textOnly.body.id as string) || (textOnly.body.post_id as string),
                    media_fallback: fallbackMeta,
                    warning: `Facebook could not attach the image (${graphMessage}). Posted caption-only instead.`,
                });
            }
        }

        // Provide a helpful message for the specific permissions error (code 200)
        const fbMessage = String(data.error.message || '');
        if (
            data.error.code === 200 ||
            data.error.code === 190 ||
            fbMessage.includes('pages_manage_posts') ||
            fbMessage.includes('pages_read_engagement') ||
            fbMessage.includes('impersonating a')
        ) {
            return NextResponse.json(
                {
                    error: 'Reconnect Facebook and grant Page publishing permissions.',
                    code: 'FACEBOOK_PERMISSION',
                    action: 'reconnect',
                    provider_error: graphMessage,
                },
                { status: 403 }
            );
        }

        return NextResponse.json(
            {
                error: graphMessage,
                code: 'FACEBOOK_GRAPH_ERROR',
                provider: 'facebook',
            },
            { status: 400 }
        );
    }

    // Mirror to first connected LinkedIn company page when available (personal + org business pages)
    if (integration.tenant_id) {
        try {
            const admin = createSupabaseAdminClient();
            const linkedinIntegration = await getLinkedInIntegrationWithToken(admin, {
                tenantId: integration.tenant_id,
                userId: user.id,
            });
            const companyPages = extractCompanyPagesFromMetadata(linkedinIntegration?.metadata);
            const organizationId = companyPages[0]?.id;
            if (linkedinIntegration?.accessToken && organizationId) {
                const authorUrn = `urn:li:organization:${organizationId}`;
                const liBody: Record<string, unknown> = {
                    author: authorUrn,
                    lifecycleState: 'PUBLISHED',
                    specificContent: {
                        'com.linkedin.ugc.ShareContent': {
                            shareCommentary: { text: message },
                            shareMediaCategory: imageUrl ? 'IMAGE' : 'NONE',
                            media: [],
                        },
                    },
                    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
                };

                if (imageUrl) {
                    const registerRes = await linkedInFetch(
                        'https://api.linkedin.com/v2/assets?action=registerUpload',
                        linkedinIntegration.accessToken,
                        {
                            method: 'POST',
                            body: JSON.stringify({
                                registerUploadRequest: {
                                    recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                                    owner: authorUrn,
                                    serviceRelationships: [{
                                        relationshipType: 'OWNER',
                                        identifier: 'urn:li:userGeneratedContent',
                                    }],
                                },
                            }),
                        }
                    );
                    const registerData = await registerRes.json();
                    const uploadUrl =
                        registerData?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
                    const asset = registerData?.value?.asset;
                    if (uploadUrl && asset) {
                        const imageRes = await fetch(imageUrl);
                        const imageBlob = await imageRes.blob();
                        await fetch(uploadUrl, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'image/jpeg' },
                            body: imageBlob,
                        });
                        (liBody.specificContent as Record<string, unknown>)['com.linkedin.ugc.ShareContent'] = {
                            ...(liBody.specificContent as Record<string, Record<string, unknown>>)['com.linkedin.ugc.ShareContent'],
                            shareMediaCategory: 'IMAGE',
                            media: [{ status: 'READY', media: asset }],
                        };
                    }
                }

                await linkedInFetch(
                    'https://api.linkedin.com/v2/ugcPosts',
                    linkedinIntegration.accessToken,
                    { method: 'POST', body: JSON.stringify(liBody) }
                );
            }
        } catch (liErr) {
            console.error('LinkedIn posting failed:', liErr);
        }
    }

    return NextResponse.json({ success: true, post_id: data.id || data.post_id });
}
