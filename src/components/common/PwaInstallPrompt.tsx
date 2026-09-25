'use client';

import React, { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { usePWA } from '@/contexts/PWAContext';
import { useLanguage } from '@/contexts/LanguageContext';

const DISMISS_KEY = 'ac_pwa_install_dismissed_until';
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_SHOWN_KEY = 'ac_pwa_install_shown_session';

function isDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  const until = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
  if (until && Date.now() < until) return true;
  return false;
}

export default function PwaInstallPrompt() {
  const pathname = usePathname();
  const { isPWA, isLoading, canInstall, isInstalled, isIOS, hasNativePrompt, promptInstall } = usePWA();
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (typeof window === 'undefined' || isLoading || isPWA || isInstalled || isDismissed()) {
      setVisible(false);
      return;
    }

    if (sessionStorage.getItem(SESSION_SHOWN_KEY) === '1') {
      return;
    }

    // Do not pop up on sensitive auth/checkout pages
    if (pathname?.startsWith('/auth') || pathname?.startsWith('/authorize') || pathname?.startsWith('/login')) {
      return;
    }

    if (canInstall) {
      const timer = window.setTimeout(() => {
        if (!isDismissed() && !isInstalled) {
          setVisible(true);
          sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
        }
      }, 1500);

      return () => window.clearTimeout(timer);
    }
  }, [isLoading, isPWA, pathname]);

  useEffect(() => {
    if (canInstall && !visible && !isInstalled && !isPWA && !isDismissed()) {
      if (sessionStorage.getItem(SESSION_SHOWN_KEY) !== '1') {
        const timer = window.setTimeout(() => {
          if (!isDismissed() && !isInstalled) {
            setVisible(true);
            sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
          }
        }, 1500);
        return () => window.clearTimeout(timer);
      }
    }
  }, [canInstall, visible, isInstalled, isPWA]);

  if (!visible || isInstalled || isPWA) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!hasNativePrompt) {
      dismiss();
      return;
    }
    setInstalling(true);
    const { success } = await promptInstall();
    setInstalling(false);
    if (success) {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
      sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
      setVisible(false);
    }
  };

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-[130] pointer-events-none md:bottom-6 md:left-auto md:right-6 md:max-w-md">
      <div className="ac-v3-floating pointer-events-auto p-4 sm:p-5 border border-[var(--border-default)] bg-[var(--surface-elevated)] backdrop-blur-md rounded-2xl shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="ac-v3-intelligence flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--interactive-secondary,#4199A4)]/15 text-[var(--interactive-secondary,#4199A4)]">
            {isIOS ? <Share2 className="h-5 w-5" aria-hidden="true" /> : <Download className="h-5 w-5" aria-hidden="true" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="type-card-description font-semibold text-[var(--text-primary)]">{t('Install AlphaClone')}</p>
            <p className="mt-1 type-caption leading-relaxed text-[var(--text-secondary)]">
              {hasNativePrompt
                ? t('Access your business from anywhere. AlphaClone opens like an app with the mobile Companion experience.')
                : (isIOS
                    ? t('On iPhone or iPad, open Share and choose Add to Home Screen to install AlphaClone.')
                    : t('Add AlphaClone to your phone or computer from your browser menu for a focused app experience.'))}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {hasNativePrompt ? (
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={installing}
                  className="min-h-11 rounded-[12px] bg-[var(--ac-accent,#356AF4)] px-4 type-caption font-semibold text-white active:scale-[0.98] disabled:opacity-60"
                >
                  {installing ? t('Installing…') : t('Install AlphaClone')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={dismiss}
                className="min-h-11 rounded-[12px] border border-[var(--border-default)] px-4 type-caption font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              >
                {hasNativePrompt ? t('Not now') : t('Got it')}
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
