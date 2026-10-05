/**
 * Runtime-safe CSS variable references for inline styles, charts, and SVG.
 * Hex literals belong only in brand.ts / theme CSS — components import from here.
 */

export const cssVar = {
  brand50: 'var(--brand-blue-50)',
  brand100: 'var(--brand-blue-100)',
  brand200: 'var(--brand-blue-200)',
  brand300: 'var(--brand-blue-300)',
  brand400: 'var(--brand-blue-400)',
  brand500: 'var(--brand-blue-500)',
  brand600: 'var(--brand-blue-600)',
  brand700: 'var(--brand-blue-700)',
  brand800: 'var(--brand-blue-800)',
  brand900: 'var(--brand-blue-900)',

  intelligence500: 'var(--brand-violet-500)',
  intelligence600: 'var(--brand-violet-600)',

  navy: 'var(--brand-navy)',
  teal: 'var(--brand-teal)',
  coral: 'var(--brand-coral)',

  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textTertiary: 'var(--color-text-tertiary)',
  textMuted: 'var(--ws-text-muted, var(--text-muted))',

  bgPrimary: 'var(--color-bg-primary)',
  bgSecondary: 'var(--color-bg-secondary)',
  borderPrimary: 'var(--color-border-primary)',

  success500: 'var(--success-500)',
  warning500: 'var(--warning-500)',
  error500: 'var(--error-500)',
  info500: 'var(--info-500)',

  accent: 'var(--ac-accent)',
  accentHover: 'var(--ac-accent-hover)',
  accentDeep: 'var(--ac-accent-deep)',

  marketingInk: 'var(--marketing-ink)',
  marketingMuted: 'var(--marketing-muted)',
  marketingLink: 'var(--marketing-link)',
  marketingLinkHover: 'var(--marketing-link-hover)',
  marketingSurface: 'var(--marketing-surface)',
  marketingBorder: 'var(--marketing-border)',
} as const;

/** Recharts / canvas APIs need resolved hex in SSR — use brand.ts scales instead of literals in UI. */
export { BRAND_BLUE as chartBrand, BRAND, SEMANTIC, MODULE_IDENTITY } from '@/constants/brand';
