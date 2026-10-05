import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isSocialPublishEnabled } from '@/lib/social/publishConfig';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';

type SchedulePayload = {
  tenantId?: string;
  title?: string;
  caption?: string;
  platforms?: string[];
  media_urls?: string[];
  media_types?: string[];
  link_url?: string | null;
  hashtags?: string[];
  scheduled_at?: string | null;
  facebook_page_id?: string | null;
  linkedin_member_id?: string | null;
  linkedin_organization_id?: string | null;
  publish_now?: boolean;
};

function extractCompanyPagesFromMetadata(raw: unknown): Array<{ id: string; name: string | null }> {
  if (!raw || typeof raw !== 'object') return [];
  const maybePages = (raw as { company_pages?: unknown }).company_pages;
  if (!Array.isArray(maybePages)) return [];
  return maybePages
    .map((page) => {
      if (!page || typeof page !== 'object') return null;
      const obj = page as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id : '';
      if (!id) return null;
      return {
        id,
        name: typeof obj.name === 'string' ? obj.name : null,
      };
    })
    .filter((page): page is { id: string; name: string | null } => !!page);
}

function getMissingColumnName(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const maybeError = error as { code?: string; message?: string };
  if (maybeError.code !== '42703' || !maybeError.message) return null;
  const match = maybeError.message.match(/column "([^"]+)"/i);
  return match?.[1] || null;
}

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

async function ensureTenantMembership(userId: string, tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

async function insertSocialPostWithFallback(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  payload: Record<string, unknown>
) {
  const mutablePayload: Record<string, unknown> = { ...payload };
  const maxAttempts = 10;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    const insertRes = await supabase
      .from('social_posts')
      .insert(mutablePayload)
      .select('*')
      .single();

    if (!insertRes.error) {
      return insertRes;
    }

    const missingColumn = getMissingColumnName(insertRes.error);
    if (!missingColumn || !(missingColumn in mutablePayload)) {
      return insertRes;
    }

    delete mutablePayload[missingColumn];
  }

  return await supabase
    .from('social_posts')
    .insert(mutablePayload)
    .select('*')
    .single();
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as SchedulePayload;
    const tenantId = body.tenantId?.trim();

    if (!tenantId || !body.caption?.trim()) {
      return NextResponse.json({ error: 'tenantId and caption are required' }, { status: 400 });
    }

    const isMember = await ensureTenantMembership(user.id, tenantId);
    if (!isMember) {
      return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 });
    }

    const requestedOrganizationId = body.linkedin_organization_id?.trim() || null;
    const platforms = body.platforms?.length ? body.platforms : ['facebook'];
    const unsupportedPlatforms = platforms.filter((platform) => !['facebook', 'linkedin', 'platform'].includes(platform));
    if (unsupportedPlatforms.length > 0) {
      return NextResponse.json({
        error: `${unsupportedPlatforms.join(', ')} publishing is not available in this workspace yet. Remove that channel and try again.`,
      }, { status: 400 });
    }

    if (platforms.includes('facebook')) {
      const pageId = body.facebook_page_id?.trim();
      if (!pageId) {
        return NextResponse.json({ error: 'Select a connected Facebook Page before scheduling or publishing.' }, { status: 400 });
      }
      const { data: facebookPage, error: facebookPageError } = await supabase
        .from('facebook_integrations')
        .select('page_id')
        .eq('user_id', user.id)
        .eq('page_id', pageId)
        .eq('is_active', true)
        .maybeSingle();
      if (facebookPageError || !facebookPage) {
        return NextResponse.json({ error: 'The selected Facebook Page is not connected to this account. Reconnect Facebook or choose another Page.' }, { status: 400 });
      }
    }

    if (platforms.includes('linkedin')) {
      const { data: liIntegration, error: liError } = await supabase
        .from('linkedin_integrations')
        .select('metadata, scopes')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (liError || !liIntegration) {
        return NextResponse.json({ error: 'LinkedIn integration is not connected for this workspace.' }, { status: 400 });
      }

      const scopes = normalizeScopes(liIntegration.scopes);
      if (requestedOrganizationId) {
        const companyPages = extractCompanyPagesFromMetadata(liIntegration.metadata);
        const hasCompany = companyPages.some((company) => company.id === requestedOrganizationId);
        if (!hasCompany) {
          return NextResponse.json(
            { error: 'Selected LinkedIn company page does not belong to this connected account.' },
            { status: 400 }
          );
        }
        if (!scopes.includes('w_organization_social')) {
          return NextResponse.json(
            {
              error:
                'LinkedIn is missing company page write permissions. Reconnect LinkedIn and approve organization access.',
            },
            { status: 400 }
          );
        }
      } else if (!scopes.includes('w_member_social')) {
        return NextResponse.json(
          {
            error: 'LinkedIn is missing personal post permissions. Reconnect LinkedIn and approve post access.',
          },
          { status: 400 }
        );
      }
    } else if (requestedOrganizationId) {
      const { data: liIntegration, error: liError } = await supabase
        .from('linkedin_integrations')
        .select('metadata')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (liError || !liIntegration) {
        return NextResponse.json({ error: 'LinkedIn integration is not connected for this workspace.' }, { status: 400 });
      }
      const companyPages = extractCompanyPagesFromMetadata(liIntegration.metadata);
      const hasCompany = companyPages.some((company) => company.id === requestedOrganizationId);
      if (!hasCompany) {
        return NextResponse.json({ error: 'Selected LinkedIn company page does not belong to this connected account.' }, { status: 400 });
      }
    }

    const parsedScheduledAt = body.scheduled_at ? new Date(body.scheduled_at) : null;
    if (parsedScheduledAt && Number.isNaN(parsedScheduledAt.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduled_at date value' }, { status: 400 });
    }
    const scheduledAt = parsedScheduledAt ? parsedScheduledAt.toISOString() : null;
    const shouldPublishNow = body.publish_now === true;
    const publishEnabled = isSocialPublishEnabled();
    const headerKey = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key');

    // Prefer domain command + SocialPublishingService for facebook/linkedin (canonical path).
    const publishPlatforms = platforms.filter((p) => p === 'facebook' || p === 'linkedin') as Array<
      'facebook' | 'linkedin'
    >;
    if (publishPlatforms.length > 0 && (shouldPublishNow || scheduledAt)) {
      if (shouldPublishNow && !publishEnabled) {
        return NextResponse.json({ success: true, publishBlocked: true }, { status: 202 });
      }
      const { executeSocialPublishCommand } = await import('@/lib/execution/commands/socialPublishCommand');
      const results = [];
      for (const platform of publishPlatforms) {
        const identityType =
          platform === 'facebook'
            ? 'facebook_page'
            : requestedOrganizationId
              ? 'linkedin_organization'
              : 'linkedin_person';
        const identityId =
          platform === 'facebook'
            ? body.facebook_page_id?.trim() || ''
            : requestedOrganizationId || body.linkedin_member_id?.trim() || '';
        if (!identityId) {
          return NextResponse.json(
            { error: `Missing destination identity for ${platform}` },
            { status: 400 }
          );
        }
        const execution = await executeSocialPublishCommand({
          tenantId,
          userId: user.id,
          executionSource: 'ui',
          idempotencyKey:
            headerKey ||
            `ui-social:${tenantId}:${platform}:${identityId}:${createHash('sha256').update(body.caption.trim()).digest('hex').slice(0, 16)}`,
          create: {
            platform,
            identityType,
            identityId,
            caption: body.caption.trim(),
            mediaUrls: body.media_urls || [],
            linkUrl: body.link_url || null,
            publishNow: shouldPublishNow,
            scheduledAt: shouldPublishNow ? null : scheduledAt,
            aiClient: 'ui',
          },
        });
        results.push(execution);
      }
      const failed = results.find((r) => !r.ok);
      if (failed) {
        return NextResponse.json(
          {
            success: false,
            error: failed.error?.message || 'Social publish blocked or failed',
            code: failed.failure_code,
            execution_truth: {
              status: failed.status,
              verification_state: failed.verification_state,
              may_claim_completed: false,
              execution_id: failed.execution_id,
              idempotency_key: failed.idempotency_key,
            },
          },
          { status: failed.failure_code === 'APPROVAL_REQUIRED' ? 202 : 422 }
        );
      }
      const primary = results[0];
      return NextResponse.json({
        success: true,
        post: primary.result?.data || null,
        execution_id: primary.execution_id,
        idempotency_key: primary.idempotency_key,
        execution_truth: {
          status: primary.status,
          verification_state: primary.verification_state,
          may_claim_completed: primary.verification_state === 'VERIFIED',
        },
      });
    }

    // Legacy path: platform-only / unsupported channel inserts (no external provider write).
    const status = 'scheduled';

    const insertPayload = {
      tenant_id: tenantId,
      user_id: user.id,
      title: body.title?.trim() || null,
      caption: body.caption.trim(),
      platforms: platforms,
      media_urls: body.media_urls || [],
      media_types: body.media_types || [],
      link_url: body.link_url || null,
      hashtags: body.hashtags || [],
      status,
      scheduled_at: shouldPublishNow ? null : scheduledAt,
      facebook_page_id: body.facebook_page_id || null,
      linkedin_member_id: body.linkedin_member_id || null,
      linkedin_organization_id: requestedOrganizationId,
    };

    const { data: post, error } = await insertSocialPostWithFallback(supabase, insertPayload);

    if (error) return clientErrorResponse(error, { request: req, scope: 'social/schedule.POST' });

    if (shouldPublishNow && platforms.includes('platform')) {
      await createSupabaseAdminClient()
        .from('social_posts')
        .update({ status: 'published', published_at: new Date().toISOString(), error_message: null })
        .eq('id', post.id)
        .eq('tenant_id', tenantId);
      const { data: published } = await supabase.from('social_posts').select('*').eq('id', post.id).eq('tenant_id', tenantId).single();
      return NextResponse.json({ success: true, post: published });
    }

    return NextResponse.json({ success: true, post });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'social/schedule.POST' });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId')?.trim();
    const pageId = searchParams.get('pageId')?.trim();

    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const isMember = await ensureTenantMembership(user.id, tenantId);
    if (!isMember) {
      return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 });
    }

    let query = supabase
      .from('social_posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (pageId) query = query.eq('facebook_page_id', pageId);

    const { data, error } = await query;
    if (error) return clientErrorResponse(error, { request: req, scope: 'social/schedule.GET' });

    return NextResponse.json({ posts: data || [] });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'social/schedule.GET' });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as {
      postId?: string;
      tenantId?: string;
      action?: 'publish_now' | 'cancel';
    };

    if (!body.postId || !body.tenantId || !body.action) {
      return NextResponse.json({ error: 'postId, tenantId, action are required' }, { status: 400 });
    }

    const isMember = await ensureTenantMembership(user.id, body.tenantId);
    if (!isMember) {
      return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 });
    }

    if (body.action === 'cancel') {
      const { error } = await supabase
        .from('social_posts')
        .update({ status: 'cancelled' })
        .eq('id', body.postId)
        .eq('tenant_id', body.tenantId);
      if (error) return clientErrorResponse(error, { request: req, scope: 'social/schedule.PATCH' });
      return NextResponse.json({ success: true });
    }

    if (!isSocialPublishEnabled()) {
      return NextResponse.json({ error: 'Publishing disabled' }, { status: 403 });
    }

    const { executeSocialPublishCommand } = await import('@/lib/execution/commands/socialPublishCommand');
    const execution = await executeSocialPublishCommand({
      tenantId: body.tenantId,
      userId: user.id,
      executionSource: 'ui',
      existingPostId: body.postId,
      idempotencyKey: req.headers.get('idempotency-key') || `ui-publish-existing:${body.tenantId}:${body.postId}`,
      skipPolicyEvaluation: false,
    });

    if (!execution.ok) {
      return NextResponse.json(
        {
          success: false,
          error: execution.error?.message || 'Publish failed',
          code: execution.failure_code,
          execution_truth: {
            status: execution.status,
            verification_state: execution.verification_state,
            may_claim_completed: false,
          },
        },
        { status: 422 }
      );
    }

    const { data: published, error: readError } = await supabase
      .from('social_posts')
      .select('status, platforms, facebook_post_id, linkedin_post_urn, live_url, error_message')
      .eq('id', body.postId)
      .eq('tenant_id', body.tenantId)
      .single();
    if (readError) return clientErrorResponse(readError, { request: req, scope: 'social/schedule.PATCH' });
    const platforms = Array.isArray(published.platforms) ? published.platforms : [];
    const facebookVerified = !platforms.includes('facebook') || Boolean(published.facebook_post_id && published.live_url);
    const linkedinVerified = !platforms.includes('linkedin') || Boolean(published.linkedin_post_urn);
    const success =
      execution.verification_state === 'VERIFIED' ||
      (published.status === 'published' && facebookVerified && linkedinVerified);
    return NextResponse.json(
      {
        success,
        post: published,
        execution_id: execution.execution_id,
        idempotency_key: execution.idempotency_key,
        error: success ? undefined : published.error_message || 'Publishing could not be verified',
      },
      { status: success ? 200 : 422 }
    );
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'social/schedule.PATCH' });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '';
    const postId = req.nextUrl.searchParams.get('postId') || '';
    if (!z.string().uuid().safeParse(tenantId).success || !z.string().uuid().safeParse(postId).success) {
      return NextResponse.json({ error: 'Valid tenantId and postId required' }, { status: 400 });
    }
    const { admin } = await requireTenantAccess(tenantId, req);
    const { data, error } = await admin.from('social_posts').delete().eq('tenant_id', tenantId).eq('id', postId).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Social post could not be deleted', req);
  }
}
