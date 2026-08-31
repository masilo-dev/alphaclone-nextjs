import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildValidatedPublicUrl } from '@/lib/urls/publicUrlGuard';

const PORTAL_TOKEN_RE = /^[a-zA-Z0-9_-]{12,128}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPAQUE_HEX_RE = /^[a-f0-9]{32}$/i;

export function sanitizeProjectPortalRef(value: string) {
  const trimmed = String(value || '').trim();
  if (PORTAL_TOKEN_RE.test(trimmed) || UUID_RE.test(trimmed) || OPAQUE_HEX_RE.test(trimmed)) {
    return trimmed;
  }
  return '';
}

/** Strip dashes so UUID DB tokens become opaque /p/{token} path segments. */
export function toOpaquePortalToken(portalToken: string): string {
  const safe = sanitizeProjectPortalRef(portalToken);
  if (!safe) return '';
  return safe.replace(/-/g, '').toLowerCase();
}

/** Values that may appear in projects.portal_token for a URL ref (UUID or opaque hex). */
export function portalTokenLookupValues(ref: string): string[] {
  const safeRef = sanitizeProjectPortalRef(ref);
  if (!safeRef) return [];

  const values = new Set<string>([safeRef]);
  if (UUID_RE.test(safeRef)) {
    values.add(toOpaquePortalToken(safeRef));
  } else if (OPAQUE_HEX_RE.test(safeRef)) {
    values.add(
      `${safeRef.slice(0, 8)}-${safeRef.slice(8, 12)}-${safeRef.slice(12, 16)}-${safeRef.slice(16, 20)}-${safeRef.slice(20)}`.toLowerCase()
    );
  }
  return [...values];
}

export function buildCanonicalProjectPortalUrl(portalToken: string) {
  const opaque = toOpaquePortalToken(portalToken);
  if (!opaque || opaque.length < 12) {
    throw new Error('Cannot build portal URL without a valid portal token');
  }
  return buildValidatedPublicUrl(`/p/${encodeURIComponent(opaque)}`);
}

export async function resolveCanonicalProjectPortalToken(
  admin: SupabaseClient,
  tokenOrProjectId: string,
  tenantId?: string
) {
  const safeRef = sanitizeProjectPortalRef(tokenOrProjectId);
  if (!safeRef) return null;

  let query = admin
    .from('projects')
    .select('id, portal_token, portal_enabled, is_public, portal_expires_at')
    .eq('portal_enabled', true)
    .eq('is_public', true);

  if (tenantId) query = query.eq('tenant_id', tenantId);

  if (UUID_RE.test(safeRef)) {
    query = query.eq('id', safeRef);
  } else {
    const tokenValues = portalTokenLookupValues(safeRef);
    query = tokenValues.length === 1
      ? query.eq('portal_token', tokenValues[0])
      : query.in('portal_token', tokenValues);
  }

  const { data } = await query.maybeSingle();
  if (!data?.portal_token) return null;
  if (data.portal_expires_at && new Date(data.portal_expires_at).getTime() < Date.now()) return null;
  return toOpaquePortalToken(String(data.portal_token));
}
