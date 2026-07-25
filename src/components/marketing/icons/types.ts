import type { SVGProps } from 'react';

export type AlphaIconName =
  | 'crm'
  | 'leads'
  | 'projects'
  | 'invoicing'
  | 'documents'
  | 'calendar'
  | 'marketing'
  | 'reports'
  | 'bonnie'
  | 'integrations'
  | 'automation'
  | 'security'
  | 'connected'
  | 'growth'
  | 'setup'
  | 'organisation'
  | 'workflow'
  | 'trust-card'
  | 'trust-clock'
  | 'trust-cancel'
  | 'trust-secure'
  | 'check';

export type AlphaIconVariant = 'nav' | 'feature' | 'display' | 'trust' | 'metric';
export type AlphaIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'display';
export type AlphaIconState = 'default' | 'hover' | 'active';
export type AlphaIconAccent =
  | 'teal'
  | 'cyan-blue'
  | 'blue-violet'
  | 'teal-blue'
  | 'violet-amber'
  | 'blue-teal'
  | 'cyan-navy'
  | 'multi'
  | 'security';

export type AlphaSvgProps = SVGProps<SVGSVGElement> & {
  title?: string;
  decorative?: boolean;
};

export const ICON_SIZE_MAP: Record<AlphaIconSize, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
  display: 64,
};

export const VARIANT_VIEWBOX: Record<AlphaIconVariant, string> = {
  nav: '0 0 24 24',
  feature: '0 0 48 48',
  display: '0 0 64 64',
  trust: '0 0 24 24',
  metric: '0 0 48 48',
};

export const ICON_ACCENT: Partial<Record<AlphaIconName, AlphaIconAccent>> = {
  crm: 'teal',
  leads: 'cyan-blue',
  projects: 'blue-violet',
  invoicing: 'cyan-blue',
  documents: 'teal-blue',
  calendar: 'cyan-navy',
  marketing: 'violet-amber',
  reports: 'blue-teal',
  bonnie: 'multi',
  integrations: 'blue-violet',
  automation: 'teal',
  security: 'security',
  connected: 'multi',
  growth: 'teal',
  setup: 'cyan-navy',
  organisation: 'blue-violet',
  workflow: 'teal',
};
