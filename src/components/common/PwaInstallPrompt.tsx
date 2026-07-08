'use client';

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { usePWA } from '@/contexts/PWAContext';
import { pwaService } from '@/services/pwaService';
import { Button } from '@/components/ui/UIComponents';

const DISMISS_KEY = 'ac_pwa_install_dismissed';
const DISMISS_DAYS = 7;

/**
 * Global install banner — works on laptop (Chrome/Edge) via beforeinstallprompt
 * and shows manual steps when the browser has no native prompt (Safari, Firefox).
 */
export default function PwaInstallPrompt() {
  const pathname = usePathname();
  const { isPWA, isLoading } = usePWA();
  const [visible, setVisible] = useState(false);
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || isLoading || isPWA) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const days = (Date.now() - new Date(dismissed).getTime()) / (1000 * 60 * 60 * 24);
      if (days < DISMISS_DAYS) return;
    }

    void pwaService.registerServiceWorker();

    void pwaService.getInstallPrompt().then(({ prompt }) => {
      setCanNativeInstall(Boolean(prompt));
      setVisible(true);
    });

    const timer = window.setTimeout(() => {
      setVisible((prev) => prev || pwaService.isInstallable());
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [isLoading, isPWA, pathname]);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setVisible(false);
  };

  const handleInstall = async () => {
    setInstalling(true);
    const { success } = await pwaService.promptInstall();
    setInstalling(false);
    if (success) {
      setVisible(false);
      return;
    }
    dismiss();
  };

  const isAuth = pathname?.startsWith('/auth');
  const isMarketing = !pathname?.startsWith('/dashboard');

  return (
    <div
      className={`fixed z-[130] pointer-events-none ${
        isAuth
          ? 'bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm'
          : isMarketing
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
            <p className="text-sm font-bold text-white">Install AlphaClone on this device</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {canNativeInstall
                ? 'Add the app to your laptop or phone — opens in its own window, no browser toolbar.'
                : 'Use your browser menu: Install app (Chrome/Edge) or Add to Dock (Safari). Works on laptop and mobile.'}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {canNativeInstall ? (
                <Button
                  onClick={handleInstall}
                  disabled={installing}
                  size="sm"
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  {installing ? 'Installing…' : 'Install now'}
                </Button>
              ) : null}
              <button
                type="button"
                onClick={dismiss}
                className="text-xs font-semibold px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                {canNativeInstall ? 'Not now' : 'Got it'}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 shrink-0"
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
