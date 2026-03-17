/**
 * Design System Constants
 * Centralized design tokens for consistent styling across the application
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
