/**
 * Quote is the canonical commercial proposal object.
 * Route proposal-facing callers toward quotes; do not expand parallel `proposals` table usage.
 */

export const CANONICAL_COMMERCIAL_OBJECT = 'quotes' as const;

export const PROPOSAL_COMPAT_NOTE =
  'AlphaClone uses quotes as the canonical proposal/commercial offer. Prefer create_quote / send_quote and the quotes module. Legacy proposal records remain readable for history only.';

export function resolveCommercialObjectType(requested: string | undefined | null): 'quotes' {
  const r = String(requested || '').toLowerCase();
  if (r === 'proposal' || r === 'proposals') {
    return 'quotes';
  }
  return 'quotes';
}
