/**
 * Design System Constants
 * Centralized design tokens for consistent styling across the application.
 *
 * Dashboard normalization note:
 * - `brand.ts` is the canonical Alphaclone OS colour / module identity source.
 * - `WORKSPACE` is the canonical source for dashboard panel chrome, tabs, toolbar, and typography.
 * - `ENTERPRISE` defines dashboard layout density, metric cards, data tables, and drawer structure.
 * - When dashboard styling changes, keep these tokens aligned with global workspace CSS and Tailwind usage.
 * - Prefer extending these objects over introducing one-off dashboard class strings in feature modules.
 */

import {
  BRAND_BLUE,
  BRAND_VIOLET,
  DARK_NEUTRALS,
  LIGHT_NEUTRALS,
  OS_MOTION,
  OS_RADIUS,
  OS_SHADOWS,
  OS_SPACE,
  OS_TYPOGRAPHY,
  SEMANTIC,
} from '@/constants/brand';

export * from '@/constants/brand';

/** @deprecated Prefer BRAND_BLUE / SEMANTIC from brand.ts — kept for legacy teal references. */
export const COLORS = {
  primary: {
    50: BRAND_BLUE[50],
    100: BRAND_BLUE[100],
    200: BRAND_BLUE[200],
    300: BRAND_BLUE[300],
    400: BRAND_BLUE[400],
    500: BRAND_BLUE[500],
    600: BRAND_BLUE[600],
    700: BRAND_BLUE[700],
    800: BRAND_BLUE[800],
    900: BRAND_BLUE[900],
    950: BRAND_BLUE[950],
  },
  secondary: {
    400: BRAND_VIOLET[400],
    500: BRAND_VIOLET[500],
    600: BRAND_VIOLET[600],
  },
  neutral: {
    50: LIGHT_NEUTRALS.surfaceSecondary,
    100: LIGHT_NEUTRALS.surfaceTertiary,
    200: LIGHT_NEUTRALS.borderSubtle,
    300: LIGHT_NEUTRALS.borderStrong,
    400: LIGHT_NEUTRALS.textMuted,
    500: LIGHT_NEUTRALS.textSecondary,
    600: DARK_NEUTRALS.textMuted,
    700: DARK_NEUTRALS.borderStrong,
    800: DARK_NEUTRALS.surfacePrimary,
    850: DARK_NEUTRALS.surfaceSecondary,
    900: DARK_NEUTRALS.appBackground,
    950: DARK_NEUTRALS.sidebarBackground,
  },
  success: {
    400: SEMANTIC.success.darkText,
    500: SEMANTIC.success[500],
    600: SEMANTIC.success[600],
  },
  warning: {
    400: SEMANTIC.warning.darkText,
    500: SEMANTIC.warning[500],
    600: SEMANTIC.warning[600],
  },
  error: {
    400: SEMANTIC.error.darkText,
    500: SEMANTIC.error[500],
    600: SEMANTIC.error[600],
  },
} as const;

export const SPACING = {
  xs: OS_SPACE[2],
  sm: OS_SPACE[4],
  md: OS_SPACE[6],
  lg: OS_SPACE[8],
  xl: OS_SPACE[12],
  '2xl': '64px',
} as const;

export const BORDER_RADIUS = {
  sm: OS_RADIUS.control,
  md: '12px',
  lg: OS_RADIUS.panel,
  xl: OS_RADIUS.modal,
  '2xl': '24px',
  full: OS_RADIUS.pill,
} as const;

export const TYPOGRAPHY = {
  display: 'text-5xl md:text-6xl font-bold tracking-tight',
  h1: 'text-[28px] leading-9 font-bold tracking-tight',
  h2: 'text-[18px] leading-[26px] font-semibold tracking-tight',
  h3: 'text-base font-semibold',
  h4: 'text-sm font-semibold',
  h5: 'text-sm font-medium',
  body: 'text-sm leading-[22px]',
  small: 'text-xs leading-[18px]',
  tiny: 'text-[11px] leading-4',
} as const;

export const SHADOWS = {
  sm: OS_SHADOWS.lightCard,
  md: OS_SHADOWS.lightCardHover,
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  glow: 'none',
} as const;

export const TRANSITIONS = {
  fast: OS_MOTION.control,
  normal: OS_MOTION.drawer,
  slow: OS_MOTION.page,
  slower: '500ms',
} as const;

export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const Z_INDEX = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  bonnieDrawer: 1120,
  commandPalette: 1200,
} as const;

/**
 * Enterprise structural patterns — Alphaclone OS brand.
 * Layout, spacing, and component anatomy.
 */
export const ENTERPRISE = {
  spacing: {
    xs: OS_SPACE[1],
    sm: OS_SPACE[2],
    md: OS_SPACE[4],
    lg: OS_SPACE[6],
    xl: OS_SPACE[8],
  },
  breakpoints: {
    mobile: '575px',
    tablet: '767px',
    desktop: '1023px',
    wide: '1439px',
  },
  metricCard: {
    valueSize: 'text-[28px] leading-[34px]',
    labelSize: 'text-sm',
    trendSize: 'text-xs',
    comparisonSize: 'text-[12px]',
    minHeight: 'min-h-[112px]',
    defaultComparison: 'versus previous 30 days',
  },
  moduleLayout: {
    summaryGrid:
      'grid grid-cols-1 min-[576px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4',
    sectionGap: 'space-y-5 md:space-y-6',
    stickyHeader:
      'sticky top-0 z-20 bg-[var(--ws-toolbar)] backdrop-blur-none border-b border-[var(--ws-border)]',
  },
  dataTable: {
    cellPadding: 'px-3 py-3',
    stickyHeader: 'sticky top-0 z-[1] bg-[var(--ws-panel)]',
    rowHover: 'hover:bg-[var(--ws-hover)]',
    rowAlt: 'even:bg-[var(--ws-surface-secondary)]',
    rowHeight: 'h-[48px]',
  },
  touchTarget: 'min-h-11 min-w-11',
  drawer: {
    mobileMaxHeight: 'max-h-[85vh]',
    desktopWidth: 'w-[min(100vw,28rem)]',
    overlayZ: 'z-[1100]',
    panelZ: 'z-[1110]',
  },
  typography: OS_TYPOGRAPHY,
  radius: OS_RADIUS,
  motion: OS_MOTION,
} as const;

/**
 * Alphaclone OS workspace chrome — navy sidebar, blue primary, violet Bonnie.
 */
export const WORKSPACE = {
  sidebar: {
    widthExpanded: 'w-[240px]',
    widthCollapsed: 'md:w-12',
    logoHeight: 'h-14',
  },
  toolbar: {
    height: 'h-14',
    padding: 'px-4 md:px-6',
  },
  canvas: {
    maxWidth: 'max-w-[1440px]',
    padding: 'p-4 md:p-6',
    gap: 'gap-4 md:gap-5',
  },
  panel: {
    base: 'ac-workspace-panel',
    radius: 'rounded-[14px]',
    padding: 'p-4 md:p-5',
  },
  action: {
    primary: 'ac-workspace-action-btn ac-workspace-action-btn--primary',
    secondary: 'ac-workspace-action-btn ac-workspace-action-btn--secondary',
    bonnie: 'ac-workspace-action-btn ac-workspace-action-btn--bonnie',
  },
  nav: {
    item: 'ac-workspace-nav-item',
    itemActive: 'ac-workspace-nav-item--active',
    subItem: 'ac-workspace-nav-subitem',
    subItemActive: 'ac-workspace-nav-subitem--active',
  },
  tab: {
    base: 'ac-workspace-tab',
    active: 'ac-workspace-tab--active',
  },
  typography: {
    pageTitle: 'text-[28px] leading-9 font-bold text-[var(--ws-text-primary)] tracking-tight',
    sectionLabel: 'text-[12px] font-medium text-[var(--ws-text-muted)]',
    panelTitle: 'text-[14px] font-semibold text-[var(--ws-text-primary)]',
    panelSubtitle: 'text-[12px] text-[var(--ws-text-muted)]',
    sectionTitle: 'text-[18px] leading-[26px] font-semibold text-[var(--ws-text-primary)]',
  },
} as const;
