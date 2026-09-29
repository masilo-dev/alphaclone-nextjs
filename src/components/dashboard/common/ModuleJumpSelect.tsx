'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface JumpNavOption {
  label: string;
  href: string;
}

interface ModuleJumpSelectProps {
  options: JumpNavOption[];
  currentHref?: string;
  label?: string;
  onNavigate: (href: string) => void;
  className?: string;
}

/**
 * Apple-style compact module switcher for mobile — use on dense pages
 * where horizontal tab strips are hard to discover or tap.
 */
export default function ModuleJumpSelect({
  options,
  currentHref,
  label = 'Jump to section',
  onNavigate,
  className = '',
}: ModuleJumpSelectProps) {
  if (options.length < 2) return null;

  return (
    <div className={`md:hidden ${className}`}>
      <label className="sr-only" htmlFor="module-jump-select">
        {label}
      </label>
      <div className="relative">
        <select
          id="module-jump-select"
          value={currentHref && options.some((o) => o.href === currentHref) ? currentHref : ''}
          onChange={(e) => {
            const href = e.target.value;
            if (href) onNavigate(href);
          }}
          className="w-full appearance-none rounded-xl bg-[var(--ws-panel)] border border-[var(--ws-border)] type-ui font-semibold text-[var(--ws-text-primary)] pl-3 pr-9 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--info-text)]"
        >
          <option value="" disabled>
            {label}
          </option>
          {options.map((opt) => (
            <option key={opt.href} value={opt.href}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ws-text-muted)]" />
      </div>
    </div>
  );
}
