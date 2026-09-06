'use client';

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { usePWA } from '@/contexts/PWAContext';
import { pwaService } from '@/services/pwaService';
import { Button } from '@/components/ui/UIComponents';
import { useLanguage } from '@/contexts/LanguageContext';

const DISMISS_KEY = 'ac_pwa_install_dismissed_until';
/** How long “Not now / Got it / X” stays dismissed. */
const DISMISS_MS = 90 * 24 * 60 * 60 * 1000;
const SESSION_SHOWN_KEY = 'ac_pwa_install_shown_session';
const ENGAGEMENT_KEY = 'ac_pwa_engaged_sessions';

function isDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  const until = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
  if (until && Date.now() < until) return true;
  // Legacy key from older banner (ISO date string)
  const legacy = localStorage.getItem('ac_pwa_install_dismissed');
  if (legacy) {
    const days = (Date.now() - new Date(legacy).getTime()) / (1000 * 60 * 60 * 24);
    if (days < 90) return true;
  }
  return false;
}

/**
 * Single global install banner.
 * Shows at most once per browser session, and not again for 90 days after dismiss.
 */
export default function PwaInstallPrompt() {
  const pathname = usePathname();
  const { isPWA, isLoading } = usePWA();
  const [visible, setVisible] = useState(false);
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const [installing, setInstalling] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (typeof window === 'undefined' || isLoading || isPWA) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (isDismissed()) return;
    // Already shown (or dismissed) once this tab/session — don't reappear on every route change.
    if (sessionStorage.getItem(SESSION_SHOWN_KEY) === '1') return;
    // Don't interrupt login / OAuth connect popups.
    if (pathname?.startsWith('/auth') || pathname?.startsWith('/authorize') || pathname?.startsWith('/login')) {
      return;
    }
    // Installation is a benefit offered after meaningful product engagement,
    // never an interruption on a first marketing-page visit.
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

    void pwaService.getInstallPrompt().then(({ prompt }) => {
      show(Boolean(prompt));
    });

    const timer = window.setTimeout(() => {
      if (!cancelled) show(pwaService.isInstallable());
    }, 30000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Intentionally omit pathname from deps for re-show — session flag gates repeats.
     
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

  const isMarketing = !pathname?.startsWith('/dashboard');

  return (
    <div
      className={`fixed z-[130] pointer-events-none ${
        isMarketing
          ? 'bottom-4 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:max-w-md'
          : 'bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:max-w-md'
      }`}
    >
      <div className="pointer-events-auto rounded-2xl border border-cyan-500/25 bg-slate-950/95 backdrop-blur-xl shadow-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 shrink-0">
            <Download className="w-5 h-5" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">{t('Install AlphaClone on this device')}</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {canNativeInstall
                ? t('Add the app to your laptop or phone — opens in its own window, no browser toolbar.')
                : t('Use your browser menu: Install app (Chrome/Edge) or Add to Home Screen on mobile.')}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {canNativeInstall ? (
                <Button
                  onClick={handleInstall}
                  disabled={installing}
                  size="sm"
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  {installing ? t('Installing…') : t('Install now')}
                </Button>
              ) : null}
              <button
                type="button"
                onClick={dismiss}
                className="text-xs font-semibold px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                {canNativeInstall ? t('Not now') : t('Got it')}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 shrink-0"
            aria-label={t('Dismiss install prompt')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
