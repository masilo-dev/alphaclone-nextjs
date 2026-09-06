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
      setVisible(!dismissed && canShowPlatformWelcomeBanner(userId));
    };

    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('alphaclone:onboarding-updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('alphaclone:onboarding-updated', sync);
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
        'relative overflow-hidden rounded-2xl border border-teal-500/25 bg-gradient-to-br from-teal-500/10 via-slate-900/80 to-slate-950/90 p-4 sm:p-5',
        className
      )}
      data-tour="platform-welcome"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal-400/10 blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 ring-1 ring-teal-500/30">
            <Sparkles className="h-5 w-5 text-teal-300" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-300/90">
              AlphaClone Systems
            </p>
            <h2 className="mt-1 text-base font-semibold text-white sm:text-lg">{t(copy.title)}</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-300">{t(copy.body)}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <button
            type="button"
            onClick={() => {
              requestPlatformTour();
              dismiss();
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-teal-400"
          >
            <Compass className="h-3.5 w-3.5" />
            {t('Take a quick tour')}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 transition hover:text-white"
          >
            {t('Dismiss')}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('Dismiss welcome banner')}
        className="absolute right-3 top-3 rounded-md p-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
