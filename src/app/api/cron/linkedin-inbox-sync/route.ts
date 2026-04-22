import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';

export const dynamic = 'force-dynamic';

function normalizeScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .flatMap((value) => String(value).split(/[,\s]+/))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,\s]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Missing tenantId' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: integration } = await admin
      .from('linkedin_integrations')
      .select('access_token, scopes, linkedin_person_urn')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!integration?.access_token) {
      return NextResponse.json({ success: false, error: 'LinkedIn integration not configured' }, { status: 400 });
    }

    const scopes = normalizeScopes(integration.scopes);
    if (!scopes.includes('w_member_social')) {
      return NextResponse.json({ success: false, error: 'Missing LinkedIn scope: w_member_social' }, { status: 400 });
    }

    const { data: posts } = await admin
      .from('social_posts')
      .select('id, caption, linkedin_post_urn, created_at')
      .eq('tenant_id', tenantId)
      .contains('platforms', ['linkedin'])
      .not('linkedin_post_urn', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);

    let captured = 0;
    for (const post of posts || []) {
      const postUrn = String((post as any).linkedin_post_urn || '').trim();
      if (!postUrn) continue;

      const url = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments?count=50`;
      const commentRes = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });
      if (!commentRes.ok) continue;
      const commentJson = await commentRes.json().catch(() => ({}));
      const elements = Array.isArray((commentJson as any)?.elements) ? (commentJson as any).elements : [];

      for (const element of elements) {
        const commentUrn = String(element?.id || element?.urn || '');
        const commentText = String(element?.message?.text || '');
        const actor = String(element?.actor || '');
        if (!commentUrn || !commentText) continue;

        await captureUnifiedMessageFromWebhook({
          supabase: admin as any,
          tenantId,
          source: 'linkedin',
          channel: 'chat',
          direction: 'inbound',
          externalId: commentUrn,
          threadId: postUrn,
          from: actor || 'linkedin_actor',
          to: postUrn,
          subject: null,
          text: commentText,
          html: null,
          receivedAt: new Date().toISOString(),
          metadata: {
            postId: String((post as any).id || ''),
            postCaption: String((post as any).caption || ''),
            linkedinPersonUrn: integration.linkedin_person_urn || null,
          },
        });
        captured++;
      }
    }

    return NextResponse.json({ success: true, tenantId, captured });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to sync LinkedIn inbox' },
      { status: 500 }
    );
  }
}

