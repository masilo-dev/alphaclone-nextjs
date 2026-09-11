'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Shield, Settings2, ToggleLeft, ToggleRight, X } from 'lucide-react';

export type CookieConsentState = {
  essential: true;
  functional: boolean;
  analytics: boolean;
  timestamp: string;
};

const STORAGE_KEYS = ['ac_cookie_consent', 'ac_cookie_preferences'] as const;

function parseConsent(raw: string | null): CookieConsentState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CookieConsentState> & {
      necessary?: boolean;
      marketing?: boolean;
    };
    if (!value || (value.essential !== true && value.necessary !== true)) return null;
    return {
      essential: true,
      functional: Boolean(value.functional ?? value.necessary ?? false),
      analytics: Boolean(value.analytics ?? false),
      timestamp: typeof value.timestamp === 'string' ? value.timestamp : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function readConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null;
  for (const key of STORAGE_KEYS) {
    const parsed = parseConsent(window.localStorage.getItem(key));
    if (parsed) return parsed;
  }
  return null;
}

function writeConsent(consent: CookieConsentState) {
  const payload = JSON.stringify(consent);
  window.localStorage.setItem('ac_cookie_consent', payload);
  window.localStorage.setItem('ac_cookie_preferences', payload);
  window.dispatchEvent(new CustomEvent('ac:cookie-consent'));
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsentState | null>(null);

  useEffect(() => {
    setConsent(readConsent());
    const onStorage = () => setConsent(readConsent());
    window.addEventListener('storage', onStorage);
    window.addEventListener('ac:cookie-consent', onStorage as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ac:cookie-consent', onStorage as EventListener);
    };
  }, []);

  return useMemo(() => ({
    consent,
    hasConsent: Boolean(consent),
  }), [consent]);
}

export default function CookieBanner() {
  const pathname = usePathname();
  const { consent } = useCookieConsent();
  const [openPrefs, setOpenPrefs] = useState(false);
  const [functional, setFunctional] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  // Authenticated workspace already has session cookies; banner must not cover workspace.
  const hideOnWorkspace = Boolean(pathname?.startsWith('/dashboard') || pathname?.startsWith('/meet'));

  useEffect(() => {
    if (consent) {
      setFunctional(consent.functional);
      setAnalytics(consent.analytics);
    }
  }, [consent]);

  useEffect(() => {
    const open = () => setOpenPrefs(true);
    window.addEventListener('ac:open-cookie-preferences', open);
    return () => window.removeEventListener('ac:open-cookie-preferences', open);
  }, []);

  if (hideOnWorkspace) return null;

  const saveConsent = (next: { functional: boolean; analytics: boolean }) => {
    writeConsent({
      essential: true,
      functional: next.functional,
      analytics: next.analytics,
      timestamp: new Date().toISOString(),
    });
    setOpenPrefs(false);
  };

  return (
    <>
      {!consent && (
        <div className="fixed inset-x-0 bottom-2 z-[9999] px-2 sm:bottom-4 sm:px-6 pointer-events-none">
          <div className="mx-auto max-w-3xl pointer-events-auto rounded-xl border border-slate-800/90 bg-slate-950/95 p-2.5 sm:p-4 shadow-2xl shadow-black/90 backdrop-blur-xl transition-all">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0 rounded-lg border border-teal-500/30 bg-teal-500/10 p-1.5">
                  <Shield className="h-3.5 w-3.5 text-teal-400 sm:h-4 sm:w-4" />
                </div>
                <div className="pr-1">
                  <h4 className="text-[11.5px] font-bold text-white sm:text-xs">Cookie Preferences</h4>
                  <p className="mt-0.5 text-[11px] text-slate-300 leading-snug max-w-xl">
                    We use essential cookies for platform security, and optional functional & analytics cookies for performance.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 pt-1 sm:pt-0 shrink-0">
                <button
                  type="button"
                  onClick={() => saveConsent({ functional: true, analytics: true })}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 rounded-lg bg-teal-400 hover:bg-teal-300 active:scale-95 px-3 py-1.5 text-[11px] font-extrabold text-slate-950 transition-all shadow-md shadow-teal-500/20 min-h-[34px] sm:min-h-[36px]"
                >
                  <ToggleRight className="h-3.5 w-3.5 shrink-0" />
                  <span>Accept All</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpenPrefs(true)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition-all hover:bg-slate-800 hover:text-white active:scale-95 min-h-[34px] sm:min-h-[36px]"
                >
                  <Settings2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Manage</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openPrefs && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-2xl shadow-black/90 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Privacy & Cookie Preferences</h3>
                <p className="text-xs text-slate-400 mt-0.5">Customize how AlphaClone uses cookies for your session.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenPrefs(false)}
                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-900 hover:text-white"
                aria-label="Close preferences"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 py-4">
              <ToggleRow
                label="Essential Cookies"
                description="Required for secure authentication, workspace session state, and security features."
                checked
                disabled
              />
              <ToggleRow
                label="Functional Cookies"
                description="Saves user layout preferences, dark mode states, and active organization selection."
                checked={functional}
                onToggle={() => setFunctional((value) => !value)}
              />
              <ToggleRow
                label="Analytics & Insights"
                description="Helps us understand platform usage to optimize performance and component reliability."
                checked={analytics}
                onToggle={() => setAnalytics((value) => !value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800/80 pt-4">
              <button
                type="button"
                onClick={() => setOpenPrefs(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveConsent({ functional, analytics })}
                className="rounded-xl bg-teal-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3.5 sm:p-4">
      <div>
        <p className="text-xs font-bold text-white sm:text-sm">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={`mt-0.5 inline-flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
          checked ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:scale-105'}`}
      >
        {checked ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
        {checked ? 'On' : 'Off'}
      </button>
    </div>
  );
}
