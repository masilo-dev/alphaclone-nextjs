import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildValidatedPublicUrl } from '@/lib/urls/publicUrlGuard';

const PORTAL_TOKEN_RE = /^[a-zA-Z0-9_-]{12,128}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sanitizeProjectPortalRef(value: string) {
  const trimmed = String(value || '').trim();
  if (PORTAL_TOKEN_RE.test(trimmed) || UUID_RE.test(trimmed)) return trimmed;
  return '';
}

export function buildCanonicalProjectPortalUrl(portalToken: string) {
  const safeToken = sanitizeProjectPortalRef(portalToken);
  if (!safeToken || UUID_RE.test(safeToken)) {
    throw new Error('Cannot build portal URL without a valid portal token');
  }
  return buildValidatedPublicUrl(`/p/${encodeURIComponent(safeToken)}`);
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

  const isUuid = UUID_RE.test(safeRef);
  query = isUuid ? query.eq('id', safeRef) : query.eq('portal_token', safeRef);

  const { data } = await query.maybeSingle();
  if (!data?.portal_token) return null;
  if (data.portal_expires_at && new Date(data.portal_expires_at).getTime() < Date.now()) return null;
  return String(data.portal_token);
}
