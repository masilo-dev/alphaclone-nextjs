'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, Settings2, Shield, ToggleLeft, ToggleRight, X } from 'lucide-react';

export type CookieConsentState = {
  essential: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
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
      marketing: Boolean(value.marketing ?? false),
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

  return useMemo(() => ({ consent, hasConsent: Boolean(consent) }), [consent]);
}

type OptionalChoices = { functional: boolean; analytics: boolean; marketing: boolean };

export default function CookieBanner() {
  const pathname = usePathname();
  const { consent } = useCookieConsent();
  const [openPrefs, setOpenPrefs] = useState(false);
  const [functional, setFunctional] = useState(true);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const hideOnWorkspace = Boolean(pathname?.startsWith('/dashboard') || pathname?.startsWith('/meet'));

  useEffect(() => {
    if (consent) {
      setFunctional(consent.functional);
      setAnalytics(consent.analytics);
      setMarketing(consent.marketing);
    }
  }, [consent]);

  useEffect(() => {
    const open = () => setOpenPrefs(true);
    window.addEventListener('ac:open-cookie-preferences', open);
    return () => window.removeEventListener('ac:open-cookie-preferences', open);
  }, []);

  if (hideOnWorkspace) return null;

  const saveConsent = (next: OptionalChoices) => {
    writeConsent({ ...next, essential: true, timestamp: new Date().toISOString() });
    setOpenPrefs(false);
  };

  return (
    <>
      {!consent && (
        <div className="fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-[9999] px-3 sm:bottom-5 sm:px-6 pointer-events-none">
          <div className="mx-auto max-w-4xl pointer-events-auto rounded-2xl border border-[var(--border-default)] bg-[rgba(7,14,28,0.97)] p-3 sm:p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 hidden shrink-0 rounded-xl border border-[var(--brand-primary)]/30 bg-[var(--brand-primary)]/10 p-2 sm:block">
                  <Shield className="h-4 w-4 text-[var(--brand-cyan-soft)]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white sm:text-sm">Your privacy choices</h4>
                  <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-300 sm:text-xs">
                    We use essential cookies to keep AlphaClone secure. You can allow optional functional, analytics, and marketing cookies, or choose essential only.
                  </p>
                  <Link href="/cookie-policy" className="mt-1 inline-flex text-[10px] font-semibold text-[var(--brand-cyan-soft)] hover:text-white hover:underline sm:mt-1.5 sm:text-[11px]">
                    Read the Cookie Policy
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-3 items-center gap-1.5 sm:flex sm:shrink-0 sm:gap-2">
                <button type="button" onClick={() => saveConsent({ functional: false, analytics: false, marketing: false })} className="inline-flex min-w-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-1.5 py-2 text-[10px] font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white sm:px-3 sm:py-2.5 sm:text-xs">
                  Essential only
                </button>
                <button type="button" onClick={() => setOpenPrefs(true)} className="inline-flex min-w-0 items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900/80 px-1.5 py-2 text-[10px] font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white sm:gap-1.5 sm:px-3 sm:py-2.5 sm:text-xs">
                  <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Manage
                </button>
                <button type="button" onClick={() => saveConsent({ functional: true, analytics: true, marketing: true })} className="inline-flex min-w-0 items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-1.5 py-2 text-[10px] font-bold text-white shadow-lg shadow-blue-950/40 transition-colors hover:bg-[var(--brand-primary-hover)] sm:gap-1.5 sm:px-4 sm:py-2.5 sm:text-xs">
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Accept all
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openPrefs && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-md animate-in fade-in duration-200 sm:items-center sm:p-4" role="presentation">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--border-default)] bg-[var(--background-root)] p-5 shadow-2xl shadow-black/90 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="cookie-preferences-title">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 id="cookie-preferences-title" className="text-base font-bold text-white">Privacy & Cookie Preferences</h3>
                <p className="mt-0.5 text-xs text-slate-400">Choose which optional cookies AlphaClone may use.</p>
              </div>
              <button type="button" onClick={() => setOpenPrefs(false)} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-900 hover:text-white" aria-label="Close preferences">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3 py-4">
              <ToggleRow label="Essential Cookies" description="Required for secure authentication, workspace session state, and security features." checked disabled />
              <ToggleRow label="Functional Cookies" description="Saves layout preferences, theme settings, language, and active organization selection." checked={functional} onToggle={() => setFunctional((value) => !value)} />
              <ToggleRow label="Analytics & Insights" description="Helps us understand platform usage to improve performance and reliability." checked={analytics} onToggle={() => setAnalytics((value) => !value)} />
              <ToggleRow label="Marketing Cookies" description="Allows campaign measurement and relevant advertising where enabled." checked={marketing} onToggle={() => setMarketing((value) => !value)} />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800/80 pt-4">
              <button type="button" onClick={() => setOpenPrefs(false)} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:text-white">Cancel</button>
              <button type="button" onClick={() => saveConsent({ functional, analytics, marketing })} className="rounded-xl bg-[var(--brand-primary)] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[var(--brand-primary-hover)]">Save preferences</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ToggleRow({ label, description, checked, disabled, onToggle }: { label: string; description: string; checked: boolean; disabled?: boolean; onToggle?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3.5 sm:p-4">
      <div>
        <p className="text-xs font-bold text-white sm:text-sm">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{description}</p>
      </div>
      <button type="button" onClick={disabled ? undefined : onToggle} disabled={disabled} aria-pressed={checked} className={`mt-0.5 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-all ${checked ? 'border border-teal-500/30 bg-teal-500/20 text-teal-300' : 'border border-slate-700 bg-slate-800 text-slate-400'} ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:scale-105'}`}>
        {checked ? <ToggleRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ToggleLeft className="h-3.5 w-3.5" aria-hidden="true" />}
        {checked ? 'On' : 'Off'}
      </button>
    </div>
  );
}
