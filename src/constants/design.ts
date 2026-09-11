/**
 * Design System Constants
 * Centralized design tokens for consistent styling across the application.
 *
 * Dashboard normalization note:
 * - `WORKSPACE` is the canonical source for dashboard panel chrome, tabs, toolbar, and typography.
 * - `ENTERPRISE` defines dashboard layout density, metric cards, data tables, and drawer structure.
 * - When dashboard styling changes, keep these tokens aligned with global workspace CSS and Tailwind usage.
 * - Prefer extending these objects over introducing one-off dashboard class strings in feature modules.
 */

export const COLORS = {
    primary: {
        50: '#f0fdfa',
        100: '#ccfbf1',
        200: '#99f6e4',
        300: '#5eead4',
        400: '#2dd4bf',  // Main brand color
        500: '#14b8a6',
        600: '#0d9488',
        700: '#0f766e',
        800: '#115e59',
        900: '#134e4a',
        950: '#042f2e',
    },
    secondary: {
        400: '#a78bfa',
        500: '#8b5cf6',  // Violet
        600: '#7c3aed',
    },
    neutral: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',  // Body text
        500: '#64748b',  // Muted text
        600: '#475569',
        700: '#334155',  // Borders
        800: '#1e293b',  // Cards
        850: '#1a2332',
        900: '#0f172a',  // Panels
        950: '#020617',  // Background
    },
    success: {
        400: '#4ade80',
        500: '#22c55e',
        600: '#16a34a',
    },
    warning: {
        400: '#fbbf24',
        500: '#f59e0b',
        600: '#d97706',
    },
    error: {
        400: '#f87171',
        500: '#ef4444',
        600: '#dc2626',
    },
} as const;

export const SPACING = {
    xs: '0.5rem',   // 8px
    sm: '1rem',     // 16px
    md: '1.5rem',   // 24px
    lg: '2rem',     // 32px
    xl: '3rem',     // 48px
    '2xl': '4rem',  // 64px
} as const;

export const BORDER_RADIUS = {
    sm: '0.5rem',   // 8px
    md: '0.75rem',  // 12px
    lg: '1rem',     // 16px
    xl: '1.5rem',   // 24px
    '2xl': '2rem',  // 32px
    full: '9999px',
} as const;

export const TYPOGRAPHY = {
    display: 'text-5xl md:text-6xl font-black tracking-tight',
    h1: 'text-4xl md:text-5xl font-bold tracking-tight',
    h2: 'text-3xl md:text-4xl font-bold tracking-tight',
    h3: 'text-2xl md:text-3xl font-semibold',
    h4: 'text-xl md:text-2xl font-semibold',
    h5: 'text-lg md:text-xl font-medium',
    body: 'text-base',
    small: 'text-sm',
    tiny: 'text-xs',
} as const;

export const SHADOWS = {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    glow: '0 0 20px 5px rgba(45, 212, 191, 0.2)',
} as const;

export const TRANSITIONS = {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
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
} as const;

/**
 * Enterprise structural patterns (AlphaClone brand colors preserved).
 * Layout, spacing, and component anatomy — not the Office-style palette.
 */
export const ENTERPRISE = {
    spacing: {
        xs: '0.25rem',  // 4px
        sm: '0.5rem',   // 8px
        md: '1rem',     // 16px
        lg: '1.5rem',   // 24px
        xl: '2rem',     // 32px
    },
    breakpoints: {
        mobile: '575px',
        tablet: '767px',
        desktop: '1023px',
        wide: '1439px',
    },
    metricCard: {
        valueSize: 'text-[32px]',
        labelSize: 'text-sm',
        trendSize: 'text-xs',
        comparisonSize: 'text-[11px]',
        minHeight: 'min-h-[96px]',
        defaultComparison: 'vs last 30 days',
    },
    moduleLayout: {
        summaryGrid: 'grid grid-cols-1 min-[576px]:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4',
        sectionGap: 'space-y-4 md:space-y-5',
        stickyHeader: 'sticky top-0 z-20 bg-[var(--ws-toolbar)] backdrop-blur-none border-b border-[var(--ws-border)]',
    },
    dataTable: {
        cellPadding: 'px-2 py-3',
        stickyHeader: 'sticky top-0 z-[1] bg-slate-900/95 backdrop-blur-sm',
        rowHover: 'hover:bg-slate-800/60',
        rowAlt: 'even:bg-slate-800/30',
    },
    touchTarget: 'min-h-11 min-w-11',
    drawer: {
        mobileMaxHeight: 'max-h-[85vh]',
        desktopWidth: 'w-[min(100vw,28rem)]',
        /** Overlay + panel z-index — keep above sticky hub headers (z-20) and bottom nav (z-50) */
        overlayZ: 'z-[1100]',
        panelZ: 'z-[1110]',
    },
} as const;

/**
 * Figma-inspired workspace chrome — structure and density, AlphaClone teal accent.
 */
export const WORKSPACE = {
    sidebar: {
        widthExpanded: 'w-[240px]',
        widthCollapsed: 'md:w-12',
        logoHeight: 'h-12',
    },
    toolbar: {
        height: 'h-12',
        padding: 'px-4 md:px-6',
    },
    canvas: {
        maxWidth: 'max-w-[1440px]',
        padding: 'p-4 md:p-6',
        gap: 'gap-4 md:gap-5',
    },
    panel: {
        base: 'ac-workspace-panel',
        radius: 'rounded-lg',
        padding: 'p-4 md:p-5',
    },
    action: {
        primary: 'ac-workspace-action-btn ac-workspace-action-btn--primary',
        secondary: 'ac-workspace-action-btn ac-workspace-action-btn--secondary',
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
        pageTitle: 'text-[15px] font-semibold text-white tracking-tight',
        sectionLabel: 'text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500',
        panelTitle: 'text-[13px] font-semibold text-slate-100',
        panelSubtitle: 'text-[11px] text-slate-500',
    },
} as const;
