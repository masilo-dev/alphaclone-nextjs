import type { SupabaseClient } from '@supabase/supabase-js';

/** Collapse whitespace for duplicate caption detection. */
export function normalizeCaptionForDedupe(caption: string): string {
  return caption.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Parse LinkedIn ugcPosts response URN from Rest.li header or JSON body.
 */
export function parseLinkedInUgcPostUrn(res: Response, rawBody: string): string | null {
  const headerId = res.headers.get('x-restli-id');
  if (headerId) {
    const trimmed = headerId.trim();
    if (trimmed.startsWith('urn:')) return trimmed;
    return `urn:li:ugcPost:${trimmed}`;
  }
  try {
    const j = JSON.parse(rawBody) as { id?: string };
    const id = typeof j?.id === 'string' ? j.id.trim() : '';
    if (!id) return null;
    if (id.startsWith('urn:')) return id;
    return `urn:li:ugcPost:${id}`;
  } catch {
    return null;
  }
}

export async function findRecentDuplicateLinkedInCaption(
  admin: SupabaseClient,
  tenantId: string,
  userId: string,
  caption: string,
  days = 7
): Promise<{ id: string } | null> {
  const normalized = normalizeCaptionForDedupe(caption);
  if (normalized.length < 8) return null;

  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data, error } = await admin
    .from('social_posts')
    .select('id, caption, linkedin_post_urn')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .contains('platforms', ['linkedin'])
    .not('linkedin_post_urn', 'is', null)
    .gte('created_at', since)
    .limit(40);

  if (error || !data?.length) return null;

  for (const row of data) {
    if (normalizeCaptionForDedupe(String(row.caption || '')) === normalized) {
      return { id: row.id };
    }
  }
  return null;
}

type AdminClient = SupabaseClient;

const MAX_UPDATE_ATTEMPTS = 5;

export async function updateSocialPostLinkedInUrnWithRetry(
  admin: AdminClient,
  postId: string,
  patch: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  let lastErr = '';
  for (let attempt = 1; attempt <= MAX_UPDATE_ATTEMPTS; attempt++) {
    const { error } = await admin.from('social_posts').update(patch).eq('id', postId);
    if (!error) return { ok: true };
    lastErr = error.message || 'update failed';
    await new Promise((r) => setTimeout(r, 120 * attempt));
  }
  return { ok: false, error: lastErr };
}

export async function enqueueSocialPostSync(
  admin: AdminClient,
  params: {
    socialPostId: string;
    tenantId: string;
    platform: 'linkedin' | 'facebook';
    externalId: string | null;
    payload?: Record<string, unknown>;
    lastError?: string;
  }
): Promise<void> {
  const { error } = await admin.from('social_post_sync_queue').insert({
    social_post_id: params.socialPostId,
    tenant_id: params.tenantId,
    platform: params.platform,
    external_id: params.externalId,
    payload: params.payload ?? {},
    last_error: params.lastError ?? null,
    attempts: 0,
  });
  if (error) {
    console.error('[enqueueSocialPostSync]', error.message, params);
  }
}
