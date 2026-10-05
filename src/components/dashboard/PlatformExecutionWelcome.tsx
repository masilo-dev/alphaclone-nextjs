'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { canShowPlatformWelcomeBanner } from '@/lib/onboarding/resolveOnboardingGate';

export const PLATFORM_TOUR_EVENT = 'alphaclone:start-product-tour';

export function requestPlatformTour() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PLATFORM_TOUR_EVENT));
}

function dismissKey(userId: string, surface: 'home' | 'projects' | 'platform') {
  return `platform_execution_welcome_${surface}_${userId}`;
}

interface PlatformExecutionWelcomeProps {
  userId: string;
  surface: 'home' | 'projects' | 'platform';
  className?: string;
}

export function PlatformExecutionWelcome({
  userId,
  surface,
  className,
}: PlatformExecutionWelcomeProps) {
  const [visible, setVisible] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;

    const sync = () => {
      const dismissed = localStorage.getItem(dismissKey(userId, surface)) === '1';
      const tourActive = document.documentElement.getAttribute('data-product-tour-active') === 'true';
      setVisible(!dismissed && !tourActive && canShowPlatformWelcomeBanner(userId));
    };

    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('alphaclone:onboarding-updated', sync);
    window.addEventListener('alphaclone:walkthrough-state-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('alphaclone:onboarding-updated', sync);
      window.removeEventListener('alphaclone:walkthrough-state-changed', sync);
    };
  }, [userId, surface]);

  if (!visible) return null;

  const copy =
    surface === 'projects'
      ? {
          title: 'Deliver work on AlphaClone Systems',
          body: 'Track stages, blockers, and tasks in one execution workspace — from kickoff through closure.',
        }
      : surface === 'platform'
        ? {
            title: 'Platform command center',
            body: 'AlphaClone Systems — the platform for execution. Oversee tenants, health, ops, and billing from one desk.',
          }
        : {
            title: 'Welcome to AlphaClone Systems',
            body: 'The platform for execution — run sales, delivery, billing, and operations from one command center.',
          };

  const dismiss = () => {
    localStorage.setItem(dismissKey(userId, surface), '1');
    setVisible(false);
  };

  return (
    <div
      className={cn(
        'ac-welcome-banner relative overflow-hidden rounded-xl sm:rounded-2xl border border-[var(--interactive-secondary,var(--brand-teal))]/30 p-3 sm:p-4 md:p-5',
        className
      )}
      data-tour="platform-welcome"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-[var(--interactive-secondary,var(--brand-teal))]/10 blur-2xl" />
      <div className="relative flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3 pr-6 sm:pr-0">
          <span className="mt-0.5 flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-[var(--interactive-secondary,var(--brand-teal))]/15 ring-1 ring-[var(--interactive-secondary,var(--brand-teal))]/30">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--interactive-secondary,var(--brand-teal))]" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-caps text-[var(--interactive-secondary,var(--brand-teal))]">
              AlphaClone Systems
            </p>
            <h2 className="mt-0.5 sm:mt-1 text-sm sm:text-base font-semibold text-[var(--text-primary)] md:text-lg">{t(copy.title)}</h2>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)]">{t(copy.body)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          <button
            type="button"
            onClick={() => {
              dismiss();
              requestPlatformTour();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--interactive-secondary,var(--brand-teal))] px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[var(--text-inverse)] shadow-sm transition hover:bg-[var(--interactive-secondary-hover)]"
          >
            <Compass className="h-3.5 w-3.5" />
            {t('Take tour')}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs sm:text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          >
            {t('Dismiss')}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('Dismiss welcome banner')}
        className="absolute right-2 top-2 sm:right-3 sm:top-3 rounded-md p-1 text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      >
        <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </button>
    </div>
  );
}
