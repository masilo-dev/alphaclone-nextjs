'use client';

import { useId } from 'react';
import { IconBase } from '../IconBase';
import type { AlphaSvgProps } from '../types';

/** Display — workspace setup moment */
export function SetupDisplayIcon(props: AlphaSvgProps) {
  const id = useId();
  return (
    <IconBase viewBox="0 0 64 64" className="alpha-icon--display alpha-icon--setup-display" {...props}>
      <defs>
        <linearGradient id={`${id}-g`} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-blue-400)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--info-500)" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect x="10" y="12" width="44" height="40" rx="10" fill={`url(#${id}-g)`} />
      <rect x="16" y="20" width="32" height="6" rx="3" fill="var(--brand-violet-900)" stroke="var(--brand-blue-400)" strokeWidth="1.6" />
      <circle cx="24" cy="23" r="2.8" fill="var(--brand-blue-300)" className="alpha-icon-accent-node" />
      <rect x="16" y="30" width="32" height="6" rx="3" fill="var(--brand-violet-900)" stroke="var(--info-500)" strokeWidth="1.6" />
      <circle cx="38" cy="33" r="2.8" fill="var(--info-500)" />
      <rect x="16" y="40" width="32" height="6" rx="3" fill="var(--brand-violet-900)" stroke="var(--brand-violet-500)" strokeWidth="1.6" />
      <circle cx="28" cy="43" r="2.8" fill="var(--brand-blue-400)" opacity="0.9" />
    </IconBase>
  );
}

/** Display — bring work together */
export function OrganisationDisplayIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 64 64" className="alpha-icon--display alpha-icon--org-display" {...props}>
      <rect x="24" y="10" width="16" height="12" rx="3" fill="var(--brand-violet-900)" stroke="var(--brand-blue-400)" strokeWidth="1.7" />
      <path d="M32 22v8M16 38V30h32v8" stroke="rgba(109,232,226,0.45)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="10" y="38" width="14" height="14" rx="3" fill="var(--info-500)" opacity="0.28" stroke="var(--info-500)" strokeWidth="1.5" />
      <rect x="25" y="38" width="14" height="14" rx="3" fill="var(--brand-blue-400)" opacity="0.25" stroke="var(--brand-blue-400)" strokeWidth="1.5" />
      <rect x="40" y="38" width="14" height="14" rx="3" fill="var(--brand-violet-500)" opacity="0.25" stroke="var(--brand-violet-500)" strokeWidth="1.5" />
      <circle cx="32" cy="30" r="2.4" fill="var(--brand-blue-300)" className="alpha-icon-accent-node" />
    </IconBase>
  );
}

/** Display — run and grow */
export function GrowthDisplayIcon(props: AlphaSvgProps) {
  const id = useId();
  return (
    <IconBase viewBox="0 0 64 64" className="alpha-icon--display alpha-icon--growth-display" {...props}>
      <defs>
        <linearGradient id={`${id}-g`} x1="12" y1="48" x2="52" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-blue-400)" />
          <stop offset="1" stopColor="var(--brand-violet-500)" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="22" fill={`url(#${id}-g)`} opacity="0.12" />
      <path d="M14 44c8-3 12-14 18-16s12 3 18-8" stroke={`url(#${id}-g)`} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M42 16h10v10" stroke="var(--brand-blue-300)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="alpha-icon-accent-node" />
      <circle cx="18" cy="42" r="2.6" fill="var(--info-500)" />
      <circle cx="32" cy="28" r="2.6" fill="var(--brand-blue-400)" />
      <circle cx="46" cy="22" r="2.8" fill="var(--brand-violet-500)" />
    </IconBase>
  );
}
