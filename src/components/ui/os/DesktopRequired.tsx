'use client';

import React from 'react';
import { MonitorUp, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DesktopRequiredProps {
  title?: string;
  description?: string;
  desktopHref?: string;
  onRemindLater?: () => void;
  className?: string;
}

export function DesktopRequired({
  title = 'Advanced controls are available on desktop.',
  description = "You're viewing the AlphaClone mobile companion. Open AlphaClone on desktop for the complete workspace.",
  desktopHref,
  onRemindLater,
  className,
}: DesktopRequiredProps) {
  const openDesktop = () => {
    if (desktopHref) {
      window.location.assign(desktopHref);
      return;
    }
    window.location.assign('/dashboard?experience=desktop');
  };

  return (
    <section
      className={cn('ac-v3-content rounded-[18px] border border-[var(--border-default)] p-4', className)}
      aria-labelledby="desktop-required-title"
    >
      <div className="flex items-start gap-3">
        <span className="ac-v3-intelligence inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
          <MonitorUp className="h-5 w-5 text-[var(--ac-bonnie)]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="desktop-required-title" className="text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">{description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openDesktop}
              className="min-h-11 rounded-[12px] bg-[var(--ac-accent)] px-4 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
            >
              Open desktop version
            </button>
            {onRemindLater ? (
              <button
                type="button"
                onClick={onRemindLater}
                className="min-h-11 rounded-[12px] border border-[var(--border-default)] px-4 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              >
                <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" aria-hidden /> Remind me later</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default DesktopRequired;
