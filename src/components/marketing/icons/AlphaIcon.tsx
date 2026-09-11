'use client';

import type { ComponentType } from 'react';
import {
  AutomationIcon,
  BonnieIcon,
  CalendarIcon,
  ConnectedIcon,
  CrmIcon,
  DocumentsIcon,
  GrowthIcon,
  IntegrationsIcon,
  InvoicingIcon,
  LeadsIcon,
  MarketingIcon,
  OrganisationIcon,
  ProjectsIcon,
  ReportsIcon,
  SecurityIcon,
  SetupIcon,
  WorkflowIcon,
} from './symbols/productIcons';
import {
  GrowthDisplayIcon,
  OrganisationDisplayIcon,
  SetupDisplayIcon,
} from './symbols/displayIcons';
import {
  CheckIcon,
  TrustCancelIcon,
  TrustCardIcon,
  TrustClockIcon,
  TrustSecureIcon,
} from './symbols/trustIcons';
import {
  ICON_ACCENT,
  ICON_SIZE_MAP,
  VARIANT_VIEWBOX,
  type AlphaIconName,
  type AlphaIconSize,
  type AlphaIconState,
  type AlphaIconVariant,
  type AlphaSvgProps,
} from './types';

const ICONS: Record<AlphaIconName, ComponentType<AlphaSvgProps>> = {
  crm: CrmIcon,
  leads: LeadsIcon,
  projects: ProjectsIcon,
  invoicing: InvoicingIcon,
  documents: DocumentsIcon,
  calendar: CalendarIcon,
  marketing: MarketingIcon,
  reports: ReportsIcon,
  bonnie: BonnieIcon,
  integrations: IntegrationsIcon,
  automation: AutomationIcon,
  security: SecurityIcon,
  connected: ConnectedIcon,
  growth: GrowthIcon,
  setup: SetupIcon,
  organisation: OrganisationIcon,
  workflow: WorkflowIcon,
  'trust-card': TrustCardIcon,
  'trust-clock': TrustClockIcon,
  'trust-cancel': TrustCancelIcon,
  'trust-secure': TrustSecureIcon,
  check: CheckIcon,
};

const DISPLAY_OVERRIDES: Partial<Record<AlphaIconName, ComponentType<AlphaSvgProps>>> = {
  setup: SetupDisplayIcon,
  organisation: OrganisationDisplayIcon,
  growth: GrowthDisplayIcon,
};

export type AlphaIconProps = {
  name: AlphaIconName;
  size?: AlphaIconSize | number;
  variant?: AlphaIconVariant;
  state?: AlphaIconState;
  className?: string;
  title?: string;
  decorative?: boolean;
};

export default function AlphaIcon({
  name,
  size = 'md',
  variant = 'feature',
  state = 'default',
  className = '',
  title,
  decorative = true,
}: AlphaIconProps) {
  const Comp =
    variant === 'display' && DISPLAY_OVERRIDES[name] ? DISPLAY_OVERRIDES[name]! : ICONS[name];
  const px = typeof size === 'number' ? size : ICON_SIZE_MAP[size];
  const accent = ICON_ACCENT[name];
  const viewBox =
    variant === 'display'
      ? '0 0 64 64'
      : variant === 'feature' || variant === 'metric'
        ? '0 0 48 48'
        : VARIANT_VIEWBOX[variant];

  return (
    <Comp
      title={title}
      decorative={decorative}
      viewBox={viewBox}
      width={px}
      height={px}
      className={[
        `alpha-icon--${variant}`,
        `alpha-icon--state-${state}`,
        accent ? `alpha-icon--accent-${accent}` : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width: px, height: px }}
    />
  );
}

export { ICONS as ALPHA_ICON_MAP };
