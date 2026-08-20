/**
 * Facebook / Meta Graph publish helpers with hard verification.
 * Success requires a Graph post id AND a successful GET of that post —
 * HTTP 200 / no error object alone is never enough.
 */

export const FACEBOOK_PUBLISH_SCOPE = 'pages_manage_posts';

export type FacebookPublishTokenHealth = {
  pageId: string;
  hasPageToken: boolean;
  expiresAt: string | null;
  isExpired: boolean;
  grantedScopes: string[];
  pageTasks: string[];
  hasPagesManagePosts: boolean;
};

export type VerifiedFacebookPost = {
  postId: string;
  postUrl: string;
  verified: true;
};

export class FacebookPublishError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'MISSING_POST_ID'
      | 'GRAPH_ERROR'
      | 'VERIFICATION_FAILED'
      | 'TOKEN_EXPIRED'
      | 'MISSING_SCOPE'
  ) {
    super(message);
    this.name = 'FacebookPublishError';
  }
}

export function extractGrantedScopes(metadata: Record<string, unknown> | null | undefined): string[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const raw =
    metadata.granted_scopes ??
    metadata.requested_scopes ??
    metadata.scopes ??
    metadata.permissions ??
    [];
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function extractPageTasks(metadata: Record<string, unknown> | null | undefined): string[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const raw = metadata.page_tasks;
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => String(t)).filter(Boolean);
}

export function inspectFacebookPublishToken(params: {
  pageId: string;
  pageAccessToken: string | null | undefined;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
}): FacebookPublishTokenHealth {
  const grantedScopes = extractGrantedScopes(params.metadata);
  const pageTasks = extractPageTasks(params.metadata);
  const expiresAt = params.expiresAt || null;
  const expMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
  const isExpired = Number.isFinite(expMs) && Date.now() >= expMs - 60_000;
  const hasPagesManagePosts =
    grantedScopes.includes(FACEBOOK_PUBLISH_SCOPE) ||
    pageTasks.includes('MANAGE') ||
    pageTasks.includes('CREATE_CONTENT') ||
    pageTasks.includes('ADVERTISE');

  return {
    pageId: params.pageId,
    hasPageToken: !!params.pageAccessToken,
    expiresAt,
    isExpired,
    grantedScopes,
    pageTasks,
    hasPagesManagePosts,
  };
}

export function logFacebookPublishTokenHealth(health: FacebookPublishTokenHealth): void {
  console.log('[Facebook Publish] Token health', {
    page_id: health.pageId,
    has_page_token: health.hasPageToken,
    expires_at: health.expiresAt,
    is_expired: health.isExpired,
    granted_scopes: health.grantedScopes,
    page_tasks: health.pageTasks,
    has_pages_manage_posts: health.hasPagesManagePosts,
  });
}

/** Build a human-openable Facebook URL from a Graph post id. */
export function buildFacebookPostUrl(postId: string, pageId?: string | null): string {
  const id = String(postId || '').trim();
  if (!id) return '';
  if (id.includes('_')) {
    const [postPageId, ...postIdParts] = id.split('_');
    const postId = postIdParts.join('_');
    if (pageId && postPageId === String(pageId).trim() && postId) {
      return `https://www.facebook.com/${pageId}/posts/${postId}`;
    }
    return `https://www.facebook.com/${id}`;
  }
  if (pageId) {
    return `https://www.facebook.com/${pageId}/posts/${id}`;
  }
  return `https://www.facebook.com/${id}`;
}

export function requireGraphPostId(body: Record<string, unknown> | null | undefined): string {
  const id = body?.id ?? body?.post_id;
  if (typeof id === 'string' && id.trim()) return id.trim();
  if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  throw new FacebookPublishError(
    'Facebook Graph API returned HTTP success without a post id — refusing to report publish success.',
    'MISSING_POST_ID'
  );
}

type FetchLike = typeof fetch;

/**
 * GET /{post-id} and confirm the post exists before calling the publish a success.
 */
export async function verifyFacebookPostExists(params: {
  postId: string;
  pageAccessToken: string;
  pageId?: string | null;
  graphVersion?: string;
  fetchImpl?: FetchLike;
}): Promise<VerifiedFacebookPost> {
  const version = params.graphVersion || 'v19.0';
  const fetchImpl = params.fetchImpl || fetch;
  const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(params.postId)}`);
  // permalink_url is not available on all Facebook post types (video posts, some photo posts)
  // and requesting it causes error #100 which is incorrectly treated as a publish failure.
  // We only request id and created_time (always safe) then build the URL ourselves.
  url.searchParams.set('fields', 'id,created_time');
  url.searchParams.set('access_token', params.pageAccessToken);

  const resp = await fetchImpl(url.toString(), { method: 'GET' });
  const body = (await resp.json().catch(() => ({}))) as Record<string, unknown>;

  if (!resp.ok || body?.error) {
    const errObj = body?.error as { message?: string } | undefined;
    throw new FacebookPublishError(
      errObj?.message ||
        `Facebook post verification failed for id=${params.postId} (HTTP ${resp.status}). Post was not confirmed.`,
      'VERIFICATION_FAILED'
    );
  }

  const verifiedId =
    typeof body.id === 'string' && body.id.trim()
      ? body.id.trim()
      : params.postId;

  // Construct the live URL from the post id — this is reliable for all post types.
  const permalink = buildFacebookPostUrl(verifiedId, params.pageId);

  return {
    postId: verifiedId,
    postUrl: permalink,
    verified: true,
  };
}

/**
 * After a Graph publish response: require id, verify via GET, return URL.
 */
export async function confirmFacebookPublish(params: {
  graphResponse: Record<string, unknown> | null | undefined;
  pageAccessToken: string;
  pageId?: string | null;
  graphVersion?: string;
  fetchImpl?: FetchLike;
}): Promise<VerifiedFacebookPost> {
  const postId = requireGraphPostId(params.graphResponse);
  return verifyFacebookPostExists({
    postId,
    pageAccessToken: params.pageAccessToken,
    pageId: params.pageId,
    graphVersion: params.graphVersion,
    fetchImpl: params.fetchImpl,
  });
}
