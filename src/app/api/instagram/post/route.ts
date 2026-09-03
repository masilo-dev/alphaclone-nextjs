import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { isSocialPublishEnabled } from '@/lib/social/publishConfig';
import { ingestMediaInput } from '@/lib/media/ingestMedia';

const schema = z.object({
  tenantId: z.string().uuid(),
  caption: z.string().trim().min(1).max(2200),
  imageUrl: z.string().url(),
  instagramAccountId: z.string().trim().min(1).max(300).optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!isSocialPublishEnabled()) {
      return NextResponse.json({ error: 'Publishing disabled' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'tenantId, caption, and imageUrl are required' }, { status: 400 });
    }

    const { user } = await requireTenantRole(
      parsed.data.tenantId,
      ['owner', 'admin', 'tenant_admin', 'super_admin', 'member'],
      req
    );

    const asset = await ingestMediaInput({
      tenantId: parsed.data.tenantId,
      userId: user.id,
      media: { type: 'url', url: parsed.data.imageUrl },
    });

    if (!asset.mime_type.startsWith('image/')) {
      return NextResponse.json({ error: 'Instagram photo posts require an image URL' }, { status: 400 });
    }

    const { publishInstagramAssets } = await import('@/lib/social/providerAssetPublishers');
    const result = await publishInstagramAssets({
      tenantId: parsed.data.tenantId,
      userId: user.id,
      assetIds: [asset.id],
      caption: parsed.data.caption,
      mode: 'photo',
      instagramAccountId: parsed.data.instagramAccountId,
    });

    return NextResponse.json({
      success: true,
      provider_post_id: result.provider_post_id,
      live_url: result.live_url,
      verified: result.verified,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Instagram post failed';
    return routeErrorResponse(error, message, req);
  }
}
