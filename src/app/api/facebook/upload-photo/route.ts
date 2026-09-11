import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { getSocialPublishingService } from '@/lib/social/SocialPublishingService';
import { uploadSocialMediaFromBuffer } from '@/lib/social/mediaUpload';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const tenantId = String(form.get('tenantId') || '');
    const { user } = await requireTenantAccess(tenantId, req);
    const pageId = String(form.get('pageId') || '');
    const caption = String(form.get('message') || '');
    if (!pageId || !caption) return NextResponse.json({ error: 'Page and caption required' }, { status: 400 });
    const file = form.get('file');
    const fileUrl = String(form.get('fileUrl') || '');
    if (!(file instanceof File) && !fileUrl) return NextResponse.json({ error: 'Media required' }, { status: 400 });
    let assetId: string | undefined;
    if (file instanceof File) {
      if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Image exceeds 10 MB' }, { status: 413 });
      const asset = await uploadSocialMediaFromBuffer({ tenantId, userId: user.id, filename: file.name, mimeType: file.type, buffer: Buffer.from(await file.arrayBuffer()) });
      assetId = asset.media_asset_id;
    }
    const result = await getSocialPublishingService().publish({
      tenantId, userId: user.id, platform: 'facebook', identityType: 'facebook_page', identityId: pageId,
      caption, mediaAssetIds: assetId ? [assetId] : [], mediaUrls: assetId ? [] : [fileUrl], publishNow: true,
    });
    return NextResponse.json({ success: result.ok, post_id: result.data?.provider_post_id, live_url: result.data?.live_url, social_post_id: result.data?.social_post_id, error: result.error?.message }, { status: result.ok ? 200 : 422 });
  } catch (error) { return routeErrorResponse(error); }
}
