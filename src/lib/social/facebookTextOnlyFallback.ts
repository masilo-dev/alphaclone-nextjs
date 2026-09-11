/**
 * Detect Facebook Graph failures caused by unreachable/invalid media URLs
 * and publish caption-only feed posts instead.
 */

import {
  parseFacebookGraphError,
  type FacebookGraphErrorDetails,
} from '@/lib/facebook/parseFacebookGraphError';

export type FacebookTextOnlyFallbackMeta = {
  applied: true;
  reason: string;
  original_error: string;
  original_error_code: number | null;
};

const MEDIA_ERROR_PATTERNS = [
  /fetch/i,
  /download/i,
  /file from url/i,
  /could not retrieve/i,
  /invalid (image|photo|media|url)/i,
  /unsupported (image|format|file)/i,
  /photo\s.*\burl\b/i,
  /media/i,
];

export function isFacebookMediaAttachmentError(
  httpStatus: number,
  body: unknown
): boolean {
  const parsed = parseFacebookGraphError(httpStatus, body);
  return shouldFallbackFacebookPublishToTextOnly(parsed);
}

export function shouldFallbackFacebookPublishToTextOnly(
  details: FacebookGraphErrorDetails
): boolean {
  const message = `${details.message} ${details.user_message || ''}`.toLowerCase();

  // Permission/token errors must not trigger text-only fallback.
  if (details.error_code === 190 || details.error_code === 200) return false;
  if (message.includes('pages_manage_posts') || message.includes('permission')) return false;
  if (message.includes('access token') || message.includes('oauth')) return false;

  if (details.error_subcode === 1366046) return true; // photo URL fetch failure (common)

  return MEDIA_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function buildFacebookTextOnlyFallbackMeta(params: {
  httpStatus: number;
  body: unknown;
}): FacebookTextOnlyFallbackMeta {
  const parsed = parseFacebookGraphError(params.httpStatus, params.body);
  return {
    applied: true,
    reason: 'facebook_media_attachment_failed',
    original_error: parsed.message,
    original_error_code: parsed.error_code,
  };
}

export async function publishFacebookFeedTextOnly(params: {
  pageId: string;
  pageAccessToken: string;
  caption: string;
  linkUrl?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; status: number; body: Record<string, unknown> }> {
  const fetchFn = params.fetchImpl || fetch;
  const fbBody: Record<string, string> = {
    message: params.caption,
    access_token: params.pageAccessToken,
  };
  if (params.linkUrl) fbBody.link = params.linkUrl;

  const res = await fetchFn(`https://graph.facebook.com/v21.0/${params.pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fbBody),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok || body?.error) {
    return { ok: false, status: res.status, body };
  }
  return { ok: true, body };
}
