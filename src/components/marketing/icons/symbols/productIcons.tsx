'use client';

import { useId } from 'react';
import { IconBase } from '../IconBase';
import type { AlphaSvgProps } from '../types';

/** CRM — connected profile forms with relationship node */
export function CrmIcon(props: AlphaSvgProps) {
  const id = useId();
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--crm" {...props}>
      <defs>
        <linearGradient id={`${id}-g`} x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#18C7C8" />
          <stop offset="1" stopColor="#1688D8" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <rect x="7" y="10" width="14" height="18" rx="7" fill={`url(#${id}-g)`} opacity="0.28" />
      <path
        d="M10.5 18.5c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5-2 4.5-4.5 4.5-4.5-2-4.5-4.5Z"
        stroke="#18C7C8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M9 30.5c1.6-3.2 4-4.8 6.5-4.8S20.4 27.3 22 30.5" stroke="#6DE8E2" strokeWidth="2" strokeLinecap="round" />
      <rect x="26" y="12" width="15" height="20" rx="7.5" fill="#0C1E3B" stroke="#1688D8" strokeWidth="1.7" />
      <circle cx="33.5" cy="19" r="3.2" fill="#18C7C8" opacity="0.9" />
      <path d="M28.5 31c1.4-2.6 3.2-3.8 5-3.8s3.6 1.2 5 3.8" stroke="#B8C4D8" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="24" cy="24" r="2.2" fill="#6DE8E2" className="alpha-icon-accent-node" />
      <path d="M21 22.5h-1.5M27.5 25.5H29" stroke="#6DE8E2" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

/** Leads — signal flowing into a qualified contact */
export function LeadsIcon(props: AlphaSvgProps) {
  const id = useId();
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--leads" {...props}>
      <defs>
        <linearGradient id={`${id}-g`} x1="6" y1="24" x2="42" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#18C7C8" />
          <stop offset="1" stopColor="#1688D8" />
        </linearGradient>
      </defs>
      <path d="M8 30c4-8 8-12 14-12" stroke={`url(#${id}-g)`} strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      <path d="M8 24c5-6 10-9 16-9" stroke="#18C7C8" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 18c4-3 8-4.5 12-4.5" stroke="#1688D8" strokeWidth="1.7" strokeLinecap="round" opacity="0.7" />
      <path d="M24 15l4.5 4.5L24 24" stroke="#6DE8E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="35" cy="28" r="7.5" fill="#0C1E3B" stroke="#1688D8" strokeWidth="1.7" />
      <circle cx="35" cy="25.5" r="2.4" fill="#18C7C8" className="alpha-icon-accent-node" />
      <path d="M30.8 33.2c1.1-1.8 2.5-2.6 4.2-2.6s3.1.8 4.2 2.6" stroke="#B8C4D8" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

/** Projects — layered blocks with progress path */
export function ProjectsIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--projects" {...props}>
      <rect x="8" y="10" width="20" height="8" rx="2.5" fill="#1688D8" opacity="0.35" />
      <rect x="12" y="20" width="24" height="8" rx="2.5" fill="#0C1E3B" stroke="#7357E8" strokeWidth="1.7" />
      <rect x="16" y="30" width="22" height="8" rx="2.5" fill="#18C7C8" opacity="0.22" stroke="#18C7C8" strokeWidth="1.5" />
      <path d="M10 14h8M14 24h12M20 34h10" stroke="#6DE8E2" strokeWidth="1.8" strokeLinecap="round" className="alpha-icon-accent-node" />
      <circle cx="36" cy="14" r="2" fill="#7357E8" />
      <circle cx="38" cy="24" r="2" fill="#1688D8" />
      <circle cx="40" cy="34" r="2" fill="#18C7C8" />
      <path d="M36 16v6M38 26v6" stroke="rgba(109,232,226,0.45)" strokeWidth="1.4" strokeLinecap="round" />
    </IconBase>
  );
}

/** Invoicing — document + payment status marker */
export function InvoicingIcon(props: AlphaSvgProps) {
  const id = useId();
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--invoicing" {...props}>
      <defs>
        <linearGradient id={`${id}-g`} x1="12" y1="8" x2="34" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#18C7C8" />
          <stop offset="1" stopColor="#1688D8" />
        </linearGradient>
      </defs>
      <path
        d="M14 8.5h14l8 8V38a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V11.5a3 3 0 0 1 3-3Z"
        fill="#0C1E3B"
        stroke={`url(#${id}-g)`}
        strokeWidth="1.8"
      />
      <path d="M28 8.5v7h7" stroke="#1688D8" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M17 22h12M17 27h9" stroke="#B8C4D8" strokeWidth="1.7" strokeLinecap="round" opacity="0.75" />
      <circle cx="33" cy="33" r="7" fill="#18C7C8" opacity="0.2" />
      <circle cx="33" cy="33" r="5.5" stroke="#18C7C8" strokeWidth="1.8" />
      <path d="M30.5 33.2l1.8 1.8 3.4-3.8" stroke="#6DE8E2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="alpha-icon-accent-node" />
    </IconBase>
  );
}

/** Documents — layered pages with verification node */
export function DocumentsIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--documents" {...props}>
      <rect x="10" y="12" width="20" height="26" rx="3" fill="#1688D8" opacity="0.2" />
      <path
        d="M16 8.5h14l7 7V36a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3V11.5a3 3 0 0 1 3-3Z"
        fill="#0C1E3B"
        stroke="#18C7C8"
        strokeWidth="1.8"
      />
      <path d="M30 8.5v6.5h6.5" stroke="#6DE8E2" strokeWidth="1.7" strokeLinejoin="round" className="alpha-icon-accent-node" />
      <path d="M19 22h12M19 27h9M19 32h7" stroke="#B8C4D8" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <circle cx="35" cy="34" r="5" fill="#18C7C8" opacity="0.25" stroke="#1688D8" strokeWidth="1.5" />
      <path d="M33 34.2l1.4 1.4 2.8-3" stroke="#6DE8E2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

/** Calendar — frame with meeting connection */
export function CalendarIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--calendar" {...props}>
      <rect x="9" y="12" width="30" height="27" rx="4" fill="#0C1E3B" stroke="#18C7C8" strokeWidth="1.8" />
      <path d="M9 20h30" stroke="#1688D8" strokeWidth="1.7" />
      <path d="M17 9v6M31 9v6" stroke="#6DE8E2" strokeWidth="2" strokeLinecap="round" className="alpha-icon-accent-node" />
      <circle cx="18" cy="28" r="2" fill="#18C7C8" />
      <circle cx="30" cy="28" r="2" fill="#1688D8" />
      <path d="M20 28h8" stroke="rgba(109,232,226,0.55)" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="23" y="32" width="8" height="3.5" rx="1.2" fill="#18C7C8" opacity="0.55" />
    </IconBase>
  );
}

/** Marketing — broadcast shape with audience nodes */
export function MarketingIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--marketing" {...props}>
      <path
        d="M12 20v8l8 3V17l-8 3Z"
        fill="#7357E8"
        opacity="0.35"
        stroke="#7357E8"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M20 17l12-5v24l-12-5" fill="#0C1E3B" stroke="#18C7C8" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M34 18c2.5 1.8 4 4.2 4 6.5s-1.5 4.7-4 6.5" stroke="#F1B84B" strokeWidth="1.7" strokeLinecap="round" opacity="0.85" />
      <path d="M37 15c3.5 2.4 5.5 5.8 5.5 9.5S40.5 31.6 37 34" stroke="#7357E8" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
      <circle cx="14" cy="34" r="2.2" fill="#18C7C8" className="alpha-icon-accent-node" />
      <circle cx="22" cy="37" r="1.8" fill="#1688D8" />
      <path d="M16 34.5l4.5 2" stroke="rgba(109,232,226,0.5)" strokeWidth="1.4" />
    </IconBase>
  );
}

/** Reports — bars + trend path */
export function ReportsIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--reports" {...props}>
      <rect x="10" y="26" width="6" height="12" rx="1.5" fill="#1688D8" opacity="0.55" />
      <rect x="20" y="18" width="6" height="20" rx="1.5" fill="#18C7C8" opacity="0.45" />
      <rect x="30" y="12" width="6" height="26" rx="1.5" fill="#0C1E3B" stroke="#1688D8" strokeWidth="1.5" />
      <path
        d="M11 24c5-2 8-8 12-8s7 7 12 4"
        stroke="#6DE8E2"
        strokeWidth="2"
        strokeLinecap="round"
        className="alpha-icon-accent-node"
      />
      <circle cx="35" cy="20" r="2.2" fill="#18C7C8" />
      <path d="M9 40h30" stroke="#B8C4D8" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
    </IconBase>
  );
}

/** Bonnie AI — operational intelligence spark with context nodes */
export function BonnieIcon(props: AlphaSvgProps) {
  const id = useId();
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--bonnie" {...props}>
      <defs>
        <linearGradient id={`${id}-g`} x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#18C7C8" />
          <stop offset="0.55" stopColor="#1688D8" />
          <stop offset="1" stopColor="#7357E8" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="9" fill={`url(#${id}-g)`} opacity="0.22" />
      <circle cx="24" cy="24" r="6.5" fill="#0C1E3B" stroke={`url(#${id}-g)`} strokeWidth="1.8" />
      <path d="M24 19.5v9M19.5 24h9" stroke="#6DE8E2" strokeWidth="1.8" strokeLinecap="round" className="alpha-icon-accent-node" />
      <circle cx="10" cy="16" r="2.3" fill="#18C7C8" opacity="0.85" />
      <circle cx="38" cy="14" r="2.1" fill="#1688D8" />
      <circle cx="39" cy="32" r="2.3" fill="#7357E8" opacity="0.9" />
      <circle cx="12" cy="34" r="2" fill="#18C7C8" opacity="0.65" />
      <path d="M12 17.2l7.2 4.2M36.2 15.5l-6.4 4.2M36.8 30.5l-6.5-3.2M13.5 32.5l6.2-4" stroke="rgba(109,232,226,0.4)" strokeWidth="1.4" strokeLinecap="round" />
    </IconBase>
  );
}

/** Integrations — modular connectors joining at a shared point */
export function IntegrationsIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--integrations" {...props}>
      <rect x="7" y="18" width="12" height="12" rx="3" fill="#0C1E3B" stroke="#1688D8" strokeWidth="1.7" />
      <rect x="29" y="8" width="12" height="12" rx="3" fill="#0C1E3B" stroke="#7357E8" strokeWidth="1.7" />
      <rect x="29" y="28" width="12" height="12" rx="3" fill="#0C1E3B" stroke="#18C7C8" strokeWidth="1.7" />
      <circle cx="24" cy="24" r="3.2" fill="#6DE8E2" className="alpha-icon-accent-node" />
      <path d="M19 24h2M26 24h-1.2M26.8 21.2l1.8-4.2M26.5 26.8l2 4.5" stroke="rgba(109,232,226,0.55)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="13" cy="24" r="1.6" fill="#1688D8" />
      <circle cx="35" cy="14" r="1.6" fill="#7357E8" />
      <circle cx="35" cy="34" r="1.6" fill="#18C7C8" />
    </IconBase>
  );
}

/** Automation — workflow loop with decision nodes */
export function AutomationIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--automation" {...props}>
      <path
        d="M16 16c3-4 8-6 13-5 7 1.2 12 7 12 14s-5.5 13-12.5 14c-5 .7-10-1-13.5-4.5"
        stroke="#18C7C8"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M14 12v6h6" stroke="#6DE8E2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="alpha-icon-accent-node" />
      <circle cx="16" cy="30" r="3" fill="#0C1E3B" stroke="#1688D8" strokeWidth="1.6" />
      <circle cx="28" cy="14" r="2.5" fill="#18C7C8" opacity="0.85" />
      <rect x="30" y="28" width="8" height="8" rx="2" transform="rotate(45 34 32)" fill="#0C1E3B" stroke="#7357E8" strokeWidth="1.5" />
    </IconBase>
  );
}

/** Security — shield with access/data layers */
export function SecurityIcon(props: AlphaSvgProps) {
  const id = useId();
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--security" {...props}>
      <defs>
        <linearGradient id={`${id}-g`} x1="24" y1="6" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#18C7C8" />
          <stop offset="1" stopColor="#1688D8" />
        </linearGradient>
      </defs>
      <path
        d="M24 7.5l14 5.5v11c0 8.5-5.8 14.8-14 17.5C15.8 38.8 10 32.5 10 24V13l14-5.5Z"
        fill="#0C1E3B"
        stroke={`url(#${id}-g)`}
        strokeWidth="1.8"
      />
      <rect x="19" y="20" width="10" height="11" rx="2.5" stroke="#6DE8E2" strokeWidth="1.7" className="alpha-icon-accent-node" />
      <path d="M22 20v-2.2a2 2 0 0 1 4 0V20" stroke="#1688D8" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="24" cy="26" r="1.4" fill="#18C7C8" />
      <path d="M15 18h4M29 18h4" stroke="rgba(109,232,226,0.35)" strokeWidth="1.4" strokeLinecap="round" />
    </IconBase>
  );
}

/** Connected workspace — modules joined */
export function ConnectedIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--connected" {...props}>
      <rect x="8" y="8" width="13" height="13" rx="3.5" fill="#18C7C8" opacity="0.25" stroke="#18C7C8" strokeWidth="1.6" />
      <rect x="27" y="8" width="13" height="13" rx="3.5" fill="#1688D8" opacity="0.25" stroke="#1688D8" strokeWidth="1.6" />
      <rect x="8" y="27" width="13" height="13" rx="3.5" fill="#7357E8" opacity="0.22" stroke="#7357E8" strokeWidth="1.6" />
      <rect x="27" y="27" width="13" height="13" rx="3.5" fill="#0C1E3B" stroke="#18C7C8" strokeWidth="1.7" />
      <circle cx="24" cy="24" r="2.8" fill="#6DE8E2" className="alpha-icon-accent-node" />
      <path d="M21 15.5h6M15.5 21v6M32.5 21v6M21 32.5h6" stroke="rgba(109,232,226,0.45)" strokeWidth="1.5" strokeLinecap="round" />
    </IconBase>
  );
}

/** Growth — ascending connected path */
export function GrowthIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--growth" {...props}>
      <path d="M10 36c6-2 9-10 14-12s9 2 14-6" stroke="#18C7C8" strokeWidth="2.1" strokeLinecap="round" fill="none" />
      <path d="M30 14h8v8" stroke="#6DE8E2" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="alpha-icon-accent-node" />
      <circle cx="14" cy="34" r="2.2" fill="#1688D8" />
      <circle cx="24" cy="24" r="2.2" fill="#18C7C8" />
      <circle cx="34" cy="18" r="2.4" fill="#7357E8" opacity="0.9" />
      <path d="M10 40h28" stroke="#B8C4D8" strokeWidth="1.4" opacity="0.4" strokeLinecap="round" />
    </IconBase>
  );
}

/** Setup — interlocking adjustment controls (not a gear) */
export function SetupIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--setup" {...props}>
      <rect x="9" y="12" width="30" height="6" rx="3" fill="#0C1E3B" stroke="#18C7C8" strokeWidth="1.7" />
      <circle cx="18" cy="15" r="3.2" fill="#6DE8E2" className="alpha-icon-accent-node" />
      <rect x="9" y="22" width="30" height="6" rx="3" fill="#0C1E3B" stroke="#1688D8" strokeWidth="1.7" />
      <circle cx="30" cy="25" r="3.2" fill="#1688D8" />
      <rect x="9" y="32" width="30" height="6" rx="3" fill="#0C1E3B" stroke="#7357E8" strokeWidth="1.7" />
      <circle cx="22" cy="35" r="3.2" fill="#18C7C8" opacity="0.85" />
    </IconBase>
  );
}

/** Organisation — structured hierarchy */
export function OrganisationIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--organisation" {...props}>
      <rect x="18" y="8" width="12" height="10" rx="2.5" fill="#0C1E3B" stroke="#18C7C8" strokeWidth="1.7" />
      <path d="M24 18v6M12 30v-6h24v6" stroke="rgba(109,232,226,0.5)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="7" y="30" width="10" height="10" rx="2.2" fill="#1688D8" opacity="0.3" stroke="#1688D8" strokeWidth="1.5" />
      <rect x="19" y="30" width="10" height="10" rx="2.2" fill="#18C7C8" opacity="0.28" stroke="#18C7C8" strokeWidth="1.5" />
      <rect x="31" y="30" width="10" height="10" rx="2.2" fill="#7357E8" opacity="0.28" stroke="#7357E8" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="2" fill="#6DE8E2" className="alpha-icon-accent-node" />
    </IconBase>
  );
}

/** Workflow — connected process nodes */
export function WorkflowIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 48 48" className="alpha-icon--workflow" {...props}>
      <circle cx="12" cy="24" r="5" fill="#0C1E3B" stroke="#18C7C8" strokeWidth="1.8" />
      <rect x="20" y="19" width="10" height="10" rx="2.5" fill="#0C1E3B" stroke="#1688D8" strokeWidth="1.7" />
      <path d="M36 19l5 5-5 5-5-5 5-5Z" fill="#7357E8" opacity="0.3" stroke="#7357E8" strokeWidth="1.6" />
      <path d="M17 24h3M30 24h2.5" stroke="#6DE8E2" strokeWidth="1.8" strokeLinecap="round" className="alpha-icon-accent-node" />
      <circle cx="12" cy="24" r="1.6" fill="#18C7C8" />
    </IconBase>
  );
}
