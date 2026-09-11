'use client';

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { usePWA } from '@/contexts/PWAContext';
import { pwaService } from '@/services/pwaService';
import { useLanguage } from '@/contexts/LanguageContext';

const DISMISS_KEY = 'ac_pwa_install_dismissed_until';
const DISMISS_MS = 90 * 24 * 60 * 60 * 1000;
const SESSION_SHOWN_KEY = 'ac_pwa_install_shown_session';
const ENGAGEMENT_KEY = 'ac_pwa_engaged_sessions';

function isDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  const until = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
  if (until && Date.now() < until) return true;
  const legacy = localStorage.getItem('ac_pwa_install_dismissed');
  if (legacy) {
    const days = (Date.now() - new Date(legacy).getTime()) / (1000 * 60 * 60 * 24);
    if (days < 90) return true;
  }
  return false;
}

/** Value-first install prompt. Never interrupts the first marketing visit. */
export default function PwaInstallPrompt() {
  const pathname = usePathname();
  const { isPWA, isLoading } = usePWA();
  const [visible, setVisible] = useState(false);
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const [installing, setInstalling] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (typeof window === 'undefined' || isLoading || isPWA) return;
    if (window.matchMedia('(display-mode: standalone)').matches || isDismissed()) return;
    if (sessionStorage.getItem(SESSION_SHOWN_KEY) === '1') return;
    if (pathname?.startsWith('/auth') || pathname?.startsWith('/authorize') || pathname?.startsWith('/login')) return;
    if (!pathname?.startsWith('/dashboard')) return;

    const engagedSessions = Math.min(3, Number(localStorage.getItem(ENGAGEMENT_KEY) || '0') + 1);
    localStorage.setItem(ENGAGEMENT_KEY, String(engagedSessions));
    if (engagedSessions < 2) return;

    let cancelled = false;
    void pwaService.registerServiceWorker();

    const show = (native: boolean) => {
      if (cancelled || isDismissed()) return;
      sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
      setCanNativeInstall(native);
      setVisible(true);
    };

    void pwaService.getInstallPrompt().then(({ prompt }) => show(Boolean(prompt)));
    const timer = window.setTimeout(() => {
      if (!cancelled) show(pwaService.isInstallable());
    }, 30000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isLoading, isPWA]);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
    setVisible(false);
  };

  const handleInstall = async () => {
    setInstalling(true);
    const { success } = await pwaService.promptInstall();
    setInstalling(false);
    if (success) {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
      sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
      setVisible(false);
      return;
    }
    dismiss();
  };

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[130] pointer-events-none md:bottom-6 md:left-auto md:right-6 md:max-w-md">
      <div className="ac-v3-floating pointer-events-auto p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="ac-v3-intelligence flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
            <Download className="h-5 w-5 text-[var(--ac-accent)]" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t('Install AlphaClone')}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              {canNativeInstall
                ? t('Access your business from anywhere. AlphaClone opens like an app with the mobile Companion experience.')
                : t('Add AlphaClone to your phone or computer from your browser menu for a focused app experience.')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {canNativeInstall ? (
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={installing}
                  className="min-h-11 rounded-[12px] bg-[var(--ac-accent)] px-4 text-xs font-semibold text-white active:scale-[0.98] disabled:opacity-60"
                >
                  {installing ? t('Installing…') : t('Install AlphaClone')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={dismiss}
                className="min-h-11 rounded-[12px] border border-[var(--border-default)] px-4 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              >
                {canNativeInstall ? t('Not now') : t('Got it')}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 min-w-11 rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            aria-label={t('Dismiss install prompt')}
          >
            <X className="mx-auto h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
