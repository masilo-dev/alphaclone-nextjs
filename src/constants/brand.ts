/**
 * Alphaclone Systems — complete brand & semantic design tokens.
 * Source of truth for colours, module identities, typography, spacing, and motion.
 * Keep in sync with CSS variables in `src/app/globals.css`.
 */

export const BRAND_BLUE = {
  50: '#F1F8F9',
  100: '#DDEEF0',
  200: '#BEDDE1',
  300: '#91C4CA',
  400: '#65ABB4',
  500: '#4199A4',
  600: '#388A94',
  700: '#306F78',
  800: '#295A61',
  900: '#234A50',
  950: '#153136',
} as const;

/** Recognisable Alphaclone Systems anchors. */
export const BRAND = {
  navy: '#212446',
  teal: '#4199A4',
  coral: '#FB7268',
  coralHover: '#F56359',
} as const;

export const BRAND_VIOLET = {
  50: '#F5F1FF',
  100: '#ECE5FF',
  200: '#DDD0FF',
  300: '#C4AAFF',
  400: '#A77BFF',
  500: '#8950F5',
  600: '#7434DE',
  700: '#6128B9',
  800: '#512697',
  900: '#45247B',
  950: '#2B1253',
} as const;

export const LIGHT_NEUTRALS = {
  appBackground: '#F6F7F9',
  sidebarBackground: '#212446',
  surfacePrimary: '#FFFFFF',
  surfaceSecondary: '#F9FAFB',
  surfaceTertiary: '#EFF1F4',
  borderSubtle: 'rgba(33, 36, 70, 0.09)',
  borderStrong: 'rgba(33, 36, 70, 0.24)',
  textPrimary: '#171923',
  textSecondary: '#5F6472',
  textMuted: '#747A88',
  textDisabled: '#A0A5B0',
  hover: '#F3F5F7',
  selected: '#EAF3F4',
  overlay: 'rgba(15, 23, 42, 0.42)',
} as const;

export const DARK_NEUTRALS = {
  appBackground: '#0D0F18',
  sidebarBackground: '#15182A',
  surfacePrimary: '#171A26',
  surfaceSecondary: '#1B1E2B',
  surfaceTertiary: '#202432',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  textPrimary: '#F7F8FB',
  textSecondary: '#B9BDCA',
  textMuted: '#9095A5',
  textDisabled: '#656A78',
  hover: '#252936',
  selected: '#23363B',
  overlay: 'rgba(0, 0, 0, 0.68)',
} as const;

export const SEMANTIC = {
  success: {
    50: '#EAFBF3',
    100: '#CCF5E2',
    500: '#16A36A',
    600: '#118557',
    700: '#106A49',
    darkSurface: '#102A22',
    darkBorder: '#1B5543',
    darkText: '#6FE0AD',
  },
  warning: {
    50: '#FFF7E8',
    100: '#FDEBC4',
    500: '#E69222',
    600: '#C87516',
    700: '#A75A15',
    darkSurface: '#302413',
    darkBorder: '#61451B',
    darkText: '#F5C46F',
  },
  error: {
    50: '#FFF0F1',
    100: '#FFDADC',
    500: '#D64545',
    600: '#B93636',
    700: '#972E2E',
    darkSurface: '#32191D',
    darkBorder: '#6A2C32',
    darkText: '#FF9097',
  },
  info: {
    50: '#EBF7FF',
    100: '#D5EEFF',
    500: '#3196E8',
    600: '#217CC7',
    700: '#2165A0',
    darkSurface: '#11283C',
    darkBorder: '#235579',
    darkText: '#77C4FF',
  },
  communication: {
    50: '#FFF0F7',
    100: '#FFDCEC',
    500: '#DE4C7A',
    600: '#C03766',
    700: '#9F2E56',
    darkSurface: '#351725',
    darkBorder: '#703049',
    darkText: '#FF8DB2',
  },
  productivity: {
    50: '#EAFBFA',
    100: '#CDF4F0',
    500: '#0F9F8F',
    600: '#0D8176',
    700: '#11675F',
    darkSurface: '#102B2A',
    darkBorder: '#1E5B56',
    darkText: '#6EDDD0',
  },
} as const;

export type ModuleId =
  | 'dashboard'
  | 'crm'
  | 'leads'
  | 'pipeline'
  | 'email'
  | 'outreach'
  | 'invoicing'
  | 'quotations'
  | 'money'
  | 'projects'
  | 'tasks'
  | 'calendar'
  | 'documents'
  | 'marketing'
  | 'social'
  | 'reports'
  | 'goals'
  | 'nexus'
  | 'bonnie'
  | 'settings';

export const MODULE_IDENTITY: Record<
  ModuleId,
  { primary: string; supporting: string; label: string; meaning: string }
> = {
  dashboard: { primary: '#212446', supporting: '#4199A4', label: 'Dashboard', meaning: 'Whole-business intelligence' },
  crm: { primary: '#16A36A', supporting: '#0F9F8F', label: 'CRM', meaning: 'Relationships and customer health' },
  leads: { primary: '#3196E8', supporting: '#356AF4', label: 'Leads', meaning: 'New business opportunities' },
  pipeline: { primary: '#E69222', supporting: '#DE6A28', label: 'Sales Pipeline', meaning: 'Deal movement and conversion' },
  email: { primary: '#DE4C7A', supporting: '#8950F5', label: 'Email', meaning: 'Communication and engagement' },
  outreach: { primary: '#DE4C7A', supporting: '#8950F5', label: 'Outreach', meaning: 'Communication and engagement' },
  invoicing: { primary: '#149C86', supporting: '#16A36A', label: 'Invoicing', meaning: 'Billing and cash collection' },
  quotations: { primary: '#B77818', supporting: '#E69222', label: 'Quotations', meaning: 'Commercial proposals' },
  money: { primary: '#168C5C', supporting: '#3196E8', label: 'Money Hub', meaning: 'Financial movement' },
  projects: { primary: '#356AF4', supporting: '#5653D9', label: 'Projects', meaning: 'Delivery and execution' },
  tasks: { primary: '#0F9F8F', supporting: '#16A36A', label: 'Tasks', meaning: 'Productivity and completion' },
  calendar: { primary: '#8950F5', supporting: '#6D4AFF', label: 'Calendar', meaning: 'Time and scheduling' },
  documents: { primary: '#C98219', supporting: '#E69222', label: 'Documents', meaning: 'Business knowledge and files' },
  marketing: { primary: '#0D91A6', supporting: '#3196E8', label: 'Marketing Hub', meaning: 'Campaign performance' },
  social: { primary: '#D74673', supporting: '#8950F5', label: 'Social Media', meaning: 'Publishing and engagement' },
  reports: { primary: '#5653D9', supporting: '#356AF4', label: 'Reports', meaning: 'Analysis and insight' },
  goals: { primary: '#7D56D9', supporting: '#16A36A', label: 'Goals', meaning: 'Progress and outcomes' },
  nexus: { primary: '#6D4AFF', supporting: '#0F9F8F', label: 'Nexus', meaning: 'Connected workflows' },
  bonnie: { primary: '#4199A4', supporting: '#212446', label: 'Bonnie AI', meaning: 'Assistance and intelligence' },
  settings: { primary: '#64748B', supporting: '#4199A4', label: 'Settings', meaning: 'Administration and control' },
};

export const CHART_COLORS = {
  revenue: { primary: BRAND_BLUE[500], comparison: '#8491A6', positive: SEMANTIC.success[500], negative: SEMANTIC.error[500] },
  pipeline: {
    new: BRAND_BLUE[500],
    contacted: SEMANTIC.info[500],
    qualified: SEMANTIC.productivity[500],
    proposal: SEMANTIC.warning[500],
    negotiation: '#DE6A28',
    won: SEMANTIC.success[500],
    lost: '#972E2E',
  },
  invoice: {
    draft: '#8491A6',
    sent: BRAND_BLUE[500],
    viewed: BRAND_VIOLET[500],
    partial: SEMANTIC.warning[500],
    paid: SEMANTIC.success[500],
    overdue: SEMANTIC.error[500],
    void: '#59667A',
  },
  projectHealth: {
    onTrack: SEMANTIC.success[500],
    needsAttention: SEMANTIC.warning[500],
    atRisk: SEMANTIC.error[500],
    paused: '#8491A6',
    completed: BRAND_BLUE[500],
  },
  task: {
    notStarted: '#8491A6',
    inProgress: BRAND_BLUE[500],
    blocked: SEMANTIC.error[500],
    waiting: SEMANTIC.warning[500],
    completed: SEMANTIC.success[500],
  },
} as const;

export const OS_TYPOGRAPHY = {
  pageTitle: { size: '28px', lineHeight: '36px', weight: 700 },
  sectionTitle: { size: '18px', lineHeight: '26px', weight: 650 },
  cardTitle: { size: '14px', lineHeight: '20px', weight: 600 },
  body: { size: '14px', lineHeight: '22px', weight: 400 },
  bodyStrong: { size: '14px', lineHeight: '22px', weight: 600 },
  caption: { size: '12px', lineHeight: '18px', weight: 500 },
  kpiLarge: { size: '28px', lineHeight: '34px', weight: 700 },
  kpiMedium: { size: '22px', lineHeight: '28px', weight: 700 },
  table: { size: '13px', lineHeight: '20px', weight: 400 },
} as const;

export const OS_SPACE = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
} as const;

export const OS_RADIUS = {
  control: '8px',
  card: '14px',
  panel: '16px',
  modal: '18px',
  pill: '999px',
} as const;

export const OS_MOTION = {
  control: '150ms',
  drawer: '220ms',
  page: '240ms',
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

export const OS_SHADOWS = {
  lightCard: '0 1px 2px rgba(16, 24, 40, 0.04)',
  lightCardHover: '0 6px 18px rgba(16, 24, 40, 0.07)',
  darkCard: '0 1px 2px rgba(0, 0, 0, 0.22)',
  darkCardHover: '0 8px 22px rgba(0, 0, 0, 0.28)',
} as const;

export const OS_BREAKPOINTS = {
  mobileXs: '320px',
  mobile: '375px',
  mobileLg: '430px',
  tablet: '768px',
  laptop: '1024px',
  desktop: '1280px',
  desktopLg: '1440px',
  desktopXl: '1600px',
  wide: '1920px',
} as const;
