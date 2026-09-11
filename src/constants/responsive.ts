/**
 * Responsive shell tokens for the authenticated dashboard.
 * Breakpoints align with the screen-by-screen implementation prompt.
 */

export const RESPONSIVE_BREAKPOINTS = {
  /** Minimum supported width */
  min: 320,
  phone: 767,
  tablet: 1023,
  laptop: 1279,
  desktop: 1280,
  wide: 1600,
  ultra: 1920,
} as const;

/** Tailwind-oriented shell classes keyed by viewport role */
export const SHELL = {
  /** Persistent sidebar from tablet landscape / laptop up */
  sidebarVisible: 'md:flex',
  /** Icon rail when collapsed — laptop+ */
  sidebarRail: 'md:w-12 xl:w-[240px]',
  /** Bottom nav only on phone */
  bottomNav: 'md:hidden',
  /** Hub tabs: scrollable strip below desktop; jump select on phone */
  hubTabs: 'overflow-x-auto',
  /** Controlled reading width for forms */
  formMax: 'max-w-3xl',
  /** Data-heavy pages use full canvas */
  dataFull: 'max-w-none',
  /** Page gutters that shrink before text */
  gutter: 'px-3 sm:px-4 md:px-5 xl:px-6',
  /** Safe area for sticky CTAs above bottom nav */
  stickyBottomPad: 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-6',
} as const;

/** Module accent markers — identifiers only, not full themes */
export const MODULE_ACCENT = {
  sales: 'teal',
  money: 'green',
  marketing: 'violet',
  documents: 'blue',
  channels: 'cyan',
  schedule: 'amber',
  workspace: 'slate',
  insights: 'indigo',
} as const;

export type ModuleAccent = (typeof MODULE_ACCENT)[keyof typeof MODULE_ACCENT];

/** Shared app colour roles (mirrored as CSS vars in globals) */
export const APP_COLOR_ROLES = [
  '--app-bg',
  '--app-surface',
  '--app-surface-raised',
  '--app-sidebar',
  '--app-border',
  '--app-border-strong',
  '--app-text',
  '--app-text-secondary',
  '--app-text-muted',
  '--app-primary',
  '--app-primary-hover',
  '--app-focus',
  '--app-success',
  '--app-warning',
  '--app-danger',
  '--app-info',
] as const;
