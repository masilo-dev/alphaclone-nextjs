'use client';

import React from 'react';
import { AlphacloneIconRoot, type AlphacloneIconProps, iconStroke } from './IconBase';

type Props = AlphacloneIconProps & { color?: string };

function useIconParts(variant: AlphacloneIconProps['variant'] = 'outline', color?: string) {
  const stroke = variant === 'filled' ? 0 : iconStroke[variant ?? 'outline'];
  const fill = variant === 'outline' ? 'none' : 'currentColor';
  const fillOpacity = variant === 'duotone' ? 0.22 : variant === 'filled' ? 1 : 0;
  const strokeColor = color || 'currentColor';
  return { stroke, fill, fillOpacity, strokeColor, variant };
}

/** Dashboard — four connected operating areas */
export function IconDashboard({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <path d="M10.5 6.75h3M6.75 10.5v3M17.25 10.5v3M10.5 17.25h3" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
    </AlphacloneIconRoot>
  );
}

/** CRM — two relationship nodes through a central profile */
export function IconCrm({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <circle cx="12" cy="10" r="3.2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <path d="M7.5 18.5c.8-2.4 2.5-3.6 4.5-3.6s3.7 1.2 4.5 3.6" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" fill="none" />
      <circle cx="4.5" cy="8.5" r="2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity * 0.8} />
      <circle cx="19.5" cy="8.5" r="2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity * 0.8} />
      <path d="M6.4 9.4 8.8 10.2M17.6 9.4l-2.4.8" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
    </AlphacloneIconRoot>
  );
}

/** Leads — incoming signal into qualified pathway */
export function IconLeads({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <path d="M4 12h7" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
      <path d="M4 8.5 7 12l-3 3.5" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7.5h5.5a2.5 2.5 0 0 1 0 5H12" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" fill={strokeColor} fillOpacity={fillOpacity} />
      <circle cx="19" cy="10" r="2.2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={Math.max(fillOpacity, 0.35)} />
      <path d="M12 16.5h4" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
    </AlphacloneIconRoot>
  );
}

/** Pipeline — staged directional path */
export function IconPipeline({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <path d="M3.5 8h4.2l2 4-2 4H3.5l2-4-2-4Z" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinejoin="round" fill={strokeColor} fillOpacity={fillOpacity} />
      <path d="M9.5 8h4.2l2 4-2 4H9.5l2-4-2-4Z" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinejoin="round" fill={strokeColor} fillOpacity={fillOpacity * 1.2} />
      <path d="M15.5 8H20l1.5 4L20 16h-4.5l2-4-2-4Z" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinejoin="round" fill={strokeColor} fillOpacity={Math.max(fillOpacity, 0.4)} />
    </AlphacloneIconRoot>
  );
}

/** Email — message with relationship node */
export function IconEmail({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <rect x="3" y="6" width="14" height="11" rx="2.2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <path d="M3.8 7.2 10 12.2l6.2-5" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="19.5" cy="16.5" r="2.4" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={Math.max(fillOpacity, 0.35)} />
    </AlphacloneIconRoot>
  );
}

/** Outreach — broadcast arc with target response */
export function IconOutreach({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <circle cx="7" cy="12" r="2.4" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <path d="M11 8.2a7 7 0 0 1 0 7.6M14.2 6a10 10 0 0 1 0 12" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
      <circle cx="19" cy="12" r="2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={Math.max(fillOpacity, 0.4)} />
    </AlphacloneIconRoot>
  );
}

/** Invoicing — structured document with payment marker */
export function IconInvoicing({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <path d="M7 3.5h7.5L19 8v12.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <path d="M14.5 3.8V8H19" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinejoin="round" />
      <path d="M8.5 12h5M8.5 15.5h3.5" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
      <circle cx="16.5" cy="16.5" r="2.2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={Math.max(fillOpacity, 0.4)} />
    </AlphacloneIconRoot>
  );
}

/** Quotations — proposal with approval path */
export function IconQuotations({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <path d="M6.5 3.5h8L18.5 7.5v13a1.8 1.8 0 0 1-1.8 1.8H6.5A1.8 1.8 0 0 1 4.7 20.5V5.3a1.8 1.8 0 0 1 1.8-1.8Z" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <path d="M14.5 3.8V7.5h3.8" stroke={strokeColor} strokeWidth={stroke || 1.75} />
      <path d="M8 12h6M8 15h4" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
      <path d="M15.2 15.2 16.5 16.5l2.3-2.4" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" strokeLinejoin="round" />
    </AlphacloneIconRoot>
  );
}

/** Money Hub — inflow / outflow pathways */
export function IconMoney({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <circle cx="12" cy="12" r="8" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <path d="M12 7.5v9M9.5 9.2c.7-1 2.7-1.4 3.8-.4s.6 2.4-.8 2.9c-1.5.5-2.2 1.2-2.2 2.3 0 1.3 1.4 2.1 3.2 1.7" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
      <path d="M4.5 8.5 7 6.5M19.5 15.5 17 17.5" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
    </AlphacloneIconRoot>
  );
}

/** Projects — delivery blocks to milestone */
export function IconProjects({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <rect x="3.5" y="5" width="6" height="5" rx="1.4" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <rect x="3.5" y="13" width="6" height="5" rx="1.4" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <rect x="11.5" y="5" width="6" height="5" rx="1.4" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <path d="M14.5 10v3.5h3" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
      <circle cx="18.5" cy="16.5" r="2.3" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={Math.max(fillOpacity, 0.4)} />
    </AlphacloneIconRoot>
  );
}

/** Tasks — completion path with priority */
export function IconTasks({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <path d="M8 12.2 10.6 14.8 16.2 9" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.5" cy="6.5" r="1.6" fill={strokeColor} />
    </AlphacloneIconRoot>
  );
}

/** Calendar — date surface with event signal */
export function IconCalendar({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.4" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
      <circle cx="15.5" cy="14.5" r="2.1" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={Math.max(fillOpacity, 0.45)} />
    </AlphacloneIconRoot>
  );
}

/** Documents — stacked records with version marker */
export function IconDocuments({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <path d="M7 6.5h8.5A1.8 1.8 0 0 1 17.3 8.3v10.2A1.8 1.8 0 0 1 15.5 20.3H7A1.8 1.8 0 0 1 5.2 18.5V8.3A1.8 1.8 0 0 1 7 6.5Z" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <path d="M8.5 4.2h8.2A1.8 1.8 0 0 1 18.5 6v1.2" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
      <circle cx="15.8" cy="15.8" r="2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={Math.max(fillOpacity, 0.4)} />
    </AlphacloneIconRoot>
  );
}

/** Marketing — audience signal growing into result */
export function IconMarketing({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <path d="M4 16.5c2.2-1.2 3.6-3.8 3.6-6.5 0-2.7 1.4-5.3 3.6-6.5" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
      <path d="M8.5 18c2-1 3.3-3.2 3.3-5.5S13.5 8 15.5 7" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
      <circle cx="18.2" cy="15.5" r="2.6" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={Math.max(fillOpacity, 0.4)} />
      <path d="M17.2 15.5h2M18.2 14.5v2" stroke={strokeColor} strokeWidth={stroke || 1.5} strokeLinecap="round" />
    </AlphacloneIconRoot>
  );
}

/** Social — connected publishing nodes */
export function IconSocial({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <circle cx="6.5" cy="7" r="2.3" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <circle cx="17.5" cy="7.5" r="2.3" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <circle cx="12" cy="17" r="2.5" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={Math.max(fillOpacity, 0.4)} />
      <path d="M8.4 8.4 10.8 15.2M15.6 8.8l-2.2 6.2" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
    </AlphacloneIconRoot>
  );
}

/** Reports — layered analysis bars with insight */
export function IconReports({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <path d="M5 18V11.5M10 18V7M15 18v-5" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
      <rect x="4" y="11" width="2" height="7" rx="1" fill={strokeColor} fillOpacity={fillOpacity || 0.35} />
      <rect x="9" y="7" width="2" height="11" rx="1" fill={strokeColor} fillOpacity={fillOpacity || 0.45} />
      <rect x="14" y="13" width="2" height="5" rx="1" fill={strokeColor} fillOpacity={fillOpacity || 0.3} />
      <circle cx="19" cy="7.5" r="2.2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={Math.max(fillOpacity, 0.4)} />
    </AlphacloneIconRoot>
  );
}

/** Goals — target from progress segments */
export function IconGoals({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <circle cx="12" cy="12" r="8" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity * 0.5} />
      <circle cx="12" cy="12" r="5" stroke={strokeColor} strokeWidth={stroke || 1.75} fill="none" />
      <circle cx="12" cy="12" r="2" fill={strokeColor} fillOpacity={Math.max(fillOpacity, 0.55)} />
      <path d="M12 4v2.2M20 12h-2.2M12 20v-2.2M4 12h2.2" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
    </AlphacloneIconRoot>
  );
}

/** Nexus — modules around automation core */
export function IconNexus({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <circle cx="12" cy="12" r="3" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={Math.max(fillOpacity, 0.45)} />
      <circle cx="12" cy="4.5" r="1.6" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <circle cx="19" cy="9" r="1.6" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <circle cx="19" cy="15" r="1.6" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <circle cx="12" cy="19.5" r="1.6" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <circle cx="5" cy="15" r="1.6" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <circle cx="5" cy="9" r="1.6" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <path d="M12 9V6.2M14.5 10.7l2.5-1.4M14.5 13.3l2.5 1.4M12 15v2.8M9.5 13.3 7 14.7M9.5 10.7 7 9.3" stroke={strokeColor} strokeWidth={stroke || 1.5} strokeLinecap="round" />
    </AlphacloneIconRoot>
  );
}

/** Bonnie — unique assistant mark */
export function IconBonnie({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <path d="M8 8.5c0-2.4 1.8-4.3 4-4.3s4 1.9 4 4.3v5.2c0 2.4-1.8 4.3-4 4.3s-4-1.9-4-4.3V8.5Z" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <circle cx="10.2" cy="10.2" r="0.9" fill={strokeColor} />
      <circle cx="13.8" cy="10.2" r="0.9" fill={strokeColor} />
      <path d="M10.4 13.2c.5.6 1.2.9 1.6.9s1.1-.3 1.6-.9" stroke={strokeColor} strokeWidth={stroke || 1.5} strokeLinecap="round" />
      <path d="M12 4.2V2.8M7 6.5 5.7 5.4M17 6.5l1.3-1.1" stroke={strokeColor} strokeWidth={stroke || 1.5} strokeLinecap="round" />
      <circle cx="18.8" cy="16.8" r="1.8" stroke={strokeColor} strokeWidth={stroke || 1.5} fill={strokeColor} fillOpacity={Math.max(fillOpacity, 0.35)} />
    </AlphacloneIconRoot>
  );
}

/** Settings — modular controls */
export function IconSettings({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <rect x="3.5" y="4" width="7" height="7" rx="2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <rect x="13.5" y="4" width="7" height="4.5" rx="1.6" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <rect x="13.5" y="11" width="7" height="9" rx="2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <rect x="3.5" y="13.5" width="7" height="6.5" rx="2" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
      <circle cx="7" cy="7.5" r="1.2" fill={strokeColor} />
      <circle cx="17" cy="15.5" r="1.2" fill={strokeColor} />
    </AlphacloneIconRoot>
  );
}

/** Theme sun / moon pair helpers */
export function IconSun({ variant = 'outline', color, ...props }: Props) {
  const { stroke, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <circle cx="12" cy="12" r="3.5" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={0.2} />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M5.8 5.8l1.4 1.4M16.8 16.8l1.4 1.4M5.8 18.2l1.4-1.4M16.8 7.2l1.4-1.4" stroke={strokeColor} strokeWidth={stroke || 1.75} strokeLinecap="round" />
    </AlphacloneIconRoot>
  );
}

export function IconMoon({ variant = 'outline', color, ...props }: Props) {
  const { stroke, fillOpacity, strokeColor } = useIconParts(variant, color);
  return (
    <AlphacloneIconRoot variant={variant} {...props}>
      <path d="M16.5 13.8A6.3 6.3 0 0 1 10.2 5.2 6.8 6.8 0 1 0 16.5 13.8Z" stroke={strokeColor} strokeWidth={stroke || 1.75} fill={strokeColor} fillOpacity={fillOpacity} />
    </AlphacloneIconRoot>
  );
}
