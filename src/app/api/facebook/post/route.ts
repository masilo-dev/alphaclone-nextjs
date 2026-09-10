import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { getSocialPublishingService } from '@/lib/social/SocialPublishingService';

export async function POST(req: NextRequest) {
  try {
    const { tenantId, pageId, message, link, imageUrl } = await req.json();
    const { user } = await requireTenantAccess(tenantId, req);
    if (!pageId || !message) return NextResponse.json({ error: 'pageId and message required' }, { status: 400 });
    const result = await getSocialPublishingService().publish({
      tenantId, userId: user.id, platform: 'facebook', identityType: 'facebook_page', identityId: pageId,
      caption: message, linkUrl: link, mediaUrls: imageUrl ? [imageUrl] : [], publishNow: true,
    });
    return NextResponse.json({ success: result.ok, post_id: result.data?.provider_post_id, live_url: result.data?.live_url, social_post_id: result.data?.social_post_id, error: result.error?.message }, { status: result.ok ? 200 : 422 });
  } catch (error) { return routeErrorResponse(error); }
}
