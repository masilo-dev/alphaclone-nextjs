'use client';

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WORKSPACE_FOCUS } from '@/constants/design';

interface HelpDisclosureProps {
  title?: string;
  children: React.ReactNode;
  /** Whether the panel is open by default. Default is false (progressive disclosure). */
  defaultOpen?: boolean;
  /** Button label. Default: 'How this works' */
  label?: string;
  variant?: 'inline' | 'drawer' | 'button-only';
  className?: string;
}

/**
 * Universal Progressive Disclosure component for educational/guidance content.
 * Keeps explanatory text, instructions, and workflow guides behind a 1-click disclosure
 * so operational data remains strictly above the fold.
 */
export function HelpDisclosure({
  title = 'How this works',
  children,
  defaultOpen = false,
  label = 'Help',
  className,
}: HelpDisclosureProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn('relative inline-flex flex-col', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={`${label}: ${title}`}
        className={WORKSPACE_FOCUS.help.triggerButton}
      >
        <HelpCircle className="w-3.5 h-3.5 text-[var(--brand-blue-400)] shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
        {isOpen ? (
          <ChevronUp className="w-3 h-3 text-[var(--ws-text-muted)]" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-3 h-3 text-[var(--ws-text-muted)]" aria-hidden="true" />
        )}
      </button>

      {isOpen ? (
        <div
          role="region"
          aria-label={title}
          className={cn(
            WORKSPACE_FOCUS.help.panel,
            'mt-2 w-full max-w-xl self-start text-sm z-20'
          )}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--ws-border)]">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[var(--brand-blue-400)]" aria-hidden="true" />
              <h4 className="font-semibold text-[var(--ws-text-primary)] text-sm">{title}</h4>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)]"
              aria-label="Close help"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="text-[var(--ws-text-secondary)] text-xs md:text-sm leading-relaxed space-y-2">
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default HelpDisclosure;
