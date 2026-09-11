'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronUp, Shield, Settings2, ToggleLeft, ToggleRight } from 'lucide-react';

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
  const { consent } = useCookieConsent();
  const [openPrefs, setOpenPrefs] = useState(false);
  const [functional, setFunctional] = useState(true);
  const [analytics, setAnalytics] = useState(false);

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
        <div className="fixed inset-x-0 bottom-0 z-[9999]">
          <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
            <div className="rounded-t-2xl border border-slate-800 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl border border-teal-500/20 bg-teal-500/10 p-2">
                    <Shield className="h-5 w-5 text-teal-300" />
                  </div>
                  <div className="max-w-3xl">
                    <p className="text-sm font-semibold text-white">Cookie preferences</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      We use essential cookies to keep the platform working. Functional cookies save your preferences, and analytics cookies help us understand what is useful.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => saveConsent({ functional: true, analytics: true })}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-400"
                  >
                    <ToggleRight className="h-4 w-4" />
                    Accept All
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenPrefs(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800"
                  >
                    <Settings2 className="h-4 w-4" />
                    Manage Preferences
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {openPrefs && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-sm">
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl rounded-t-3xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4 sm:px-6">
              <div>
                <p className="text-sm font-semibold text-white">Manage preferences</p>
                <p className="text-xs text-slate-500">Essential cookies stay on. Functional and analytics are optional.</p>
              </div>
              <button type="button" onClick={() => setOpenPrefs(false)} className="text-slate-400 hover:text-white">
                <ChevronUp className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-4 py-5 sm:px-6">
              <ToggleRow
                label="Essential"
                description="Required for authentication, security, and core platform features."
                checked
                disabled
              />
              <ToggleRow
                label="Functional"
                description="Saves layout and preference settings."
                checked={functional}
                onToggle={() => setFunctional((value) => !value)}
              />
              <ToggleRow
                label="Analytics"
                description="Helps us measure feature use and performance."
                checked={analytics}
                onToggle={() => setAnalytics((value) => !value)}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => saveConsent({ functional, analytics })}
                className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400"
              >
                Save preferences
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
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-4">
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={`mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
          checked ? 'bg-teal-500/15 text-teal-300' : 'bg-slate-800 text-slate-400'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        {checked ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
        {checked ? 'On' : 'Off'}
      </button>
    </div>
  );
}
