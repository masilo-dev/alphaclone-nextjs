import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';
import { linkedInFetch } from '@/lib/linkedin/linkedinClient';
import {
  getLinkedInIntegrationWithToken,
  normalizeLinkedInScopes,
} from '@/services/linkedin/linkedinIntegrationService';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function syncTenantInbox(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string) {
  const { data: integrationRow } = await admin
    .from('linkedin_integrations')
    .select('id, user_id, linkedin_person_urn, scopes, token_expires_at, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!integrationRow?.user_id) {
    return { tenantId, captured: 0, skipped: 'no_integration' };
  }

  const integration = await getLinkedInIntegrationWithToken(admin, {
    tenantId,
    userId: integrationRow.user_id,
  });

  if (!integration?.accessToken) {
    return { tenantId, captured: 0, skipped: 'no_token' };
  }

  const scopes = normalizeLinkedInScopes(integration.scopes);
  const canRead =
    scopes.includes('w_member_social') ||
    scopes.includes('w_organization_social') ||
    scopes.includes('r_organization_social');
  if (!canRead) {
    return { tenantId, captured: 0, skipped: 'missing_scopes' };
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
    const postUrn = String((post as { linkedin_post_urn?: string }).linkedin_post_urn || '').trim();
    if (!postUrn) continue;

    try {
      const url = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments?count=50`;
      const commentRes = await linkedInFetch(url, integration.accessToken, { method: 'GET' }, { retries: 1 });
      const commentJson = await commentRes.json().catch(() => ({}));
      const elements = Array.isArray((commentJson as { elements?: unknown[] })?.elements)
        ? (commentJson as { elements: unknown[] }).elements
        : [];

      for (const element of elements) {
        const el = element as Record<string, unknown>;
        const commentUrn = String(el?.id || el?.urn || '');
        const message = el?.message as Record<string, unknown> | undefined;
        const commentText = String(message?.text || '');
        const actor = String(el?.actor || '');
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
            postId: String((post as { id?: string }).id || ''),
            postCaption: String((post as { caption?: string }).caption || ''),
            linkedinPersonUrn: integration.linkedin_person_urn || null,
          },
        });
        captured++;
      }
    } catch {
      continue;
    }
  }

  return { tenantId, captured };
}

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const admin = createSupabaseAdminClient();
    const tenantIdParam = req.nextUrl.searchParams.get('tenantId');

    if (tenantIdParam) {
      const result = await syncTenantInbox(admin, tenantIdParam);
      return NextResponse.json({ success: true, ...result });
    }

    const { data: integrations } = await admin
      .from('linkedin_integrations')
      .select('tenant_id')
      .eq('is_active', true);

    const tenantIds = [
      ...new Set((integrations || []).map((i: { tenant_id: string }) => i.tenant_id).filter(Boolean)),
    ] as string[];
    const results = [];
    for (const tenantId of tenantIds) {
      results.push(await syncTenantInbox(admin, tenantId));
    }

    return NextResponse.json({
      success: true,
      tenants: results.length,
      results,
      totalCaptured: results.reduce((sum, r) => sum + (r.captured || 0), 0),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to sync LinkedIn inbox' },
      { status: 500 }
    );
  }
}
