'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, Settings2, Shield, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export type CookieConsentState = {
  essential: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version?: string;
};

const STORAGE_KEYS = ['ac_cookie_consent', 'ac_cookie_preferences'] as const;
const CONSENT_COOKIE = 'ac_cookie_consent';
const CONSENT_VERSION = '2026-09';
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function parseConsent(raw: string | null): CookieConsentState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CookieConsentState> & {
      necessary?: boolean;
      marketing?: boolean;
    };
    if (!value || (value.essential !== true && value.necessary !== true)) return null;
    if (value.version && value.version !== CONSENT_VERSION) return null;
    const timestamp = typeof value.timestamp === 'string' ? value.timestamp : new Date().toISOString();
    const consentAge = Date.now() - new Date(timestamp).getTime();
    if (!Number.isFinite(consentAge) || consentAge > CONSENT_MAX_AGE_SECONDS * 1000) return null;
    return {
      essential: true,
      functional: Boolean(value.functional ?? value.necessary ?? false),
      analytics: Boolean(value.analytics ?? false),
      marketing: Boolean(value.marketing ?? false),
      timestamp,
      version: typeof value.version === 'string' ? value.version : CONSENT_VERSION,
    };
  } catch {
    return null;
  }
}

function readConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    for (const key of STORAGE_KEYS) {
      const parsed = parseConsent(window.localStorage.getItem(key));
      if (parsed) return parsed;
    }
  } catch {
    // Some privacy modes block localStorage; the first-party cookie remains available.
  }
  const cookieValue = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
  const parsedCookie = parseConsent(cookieValue ? decodeURIComponent(cookieValue) : null);
  if (parsedCookie) return parsedCookie;
  return null;
}

function writeConsent(consent: CookieConsentState) {
  const payload = JSON.stringify({ ...consent, version: CONSENT_VERSION });
  try {
    window.localStorage.setItem('ac_cookie_consent', payload);
    window.localStorage.setItem('ac_cookie_preferences', payload);
  } catch {
    // Continue with the cookie fallback when localStorage is unavailable.
  }
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(payload)}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
  window.dispatchEvent(new CustomEvent('ac:cookie-consent'));
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsentState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
    const onStorage = () => {
      setConsent(readConsent());
      setReady(true);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('ac:cookie-consent', onStorage as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ac:cookie-consent', onStorage as EventListener);
    };
  }, []);

  return useMemo(() => ({ consent, hasConsent: Boolean(consent), ready }), [consent, ready]);
}

type OptionalChoices = { functional: boolean; analytics: boolean; marketing: boolean };

export default function CookieBanner() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const { consent, ready } = useCookieConsent();
  const [openPrefs, setOpenPrefs] = useState(false);
  const [functional, setFunctional] = useState(true);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const preferencesDialogRef = useRef<HTMLDialogElement>(null);

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

  useEffect(() => {
    const dialog = preferencesDialogRef.current;
    if (openPrefs && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [openPrefs]);

  if (hideOnWorkspace) return null;

  const saveConsent = (next: OptionalChoices) => {
    writeConsent({ ...next, essential: true, timestamp: new Date().toISOString() });
    setOpenPrefs(false);
  };

  return (
    <>
      {ready && !consent && (
        <div className="fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-[9999] px-3 sm:bottom-5 sm:px-6 pointer-events-none">
          <div className="mx-auto max-w-4xl pointer-events-auto rounded-2xl border border-[var(--border-default)] bg-[rgba(7,14,28,0.97)] p-3 sm:p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 hidden shrink-0 rounded-xl border border-[var(--brand-primary)]/30 bg-[var(--brand-primary)]/10 p-2 sm:block">
                  <Shield className="h-4 w-4 text-[var(--brand-cyan-soft)]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h4 className="type-card-title font-bold text-white sm:text-sm">{t('Your privacy choices')}</h4>
                  <p className="mt-1 max-w-2xl type-card-description leading-relaxed text-slate-300 sm:text-sm">
                    {t('We use essential cookies to keep AlphaClone secure. You can allow optional functional, analytics, and marketing cookies, or choose essential only.')}
                  </p>
                  <Link href="/cookie-policy" className="mt-1 inline-flex type-ui font-semibold text-[var(--brand-cyan-soft)] hover:text-white hover:underline sm:mt-1.5 sm:text-sm">
                    {t('Read the Cookie Policy')}
                  </Link>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <button type="button" onClick={() => saveConsent({ functional: false, analytics: false, marketing: false })} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 type-ui font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white sm:flex-none">
                  {t('Essential only')}
                </button>
                <button type="button" onClick={() => setOpenPrefs(true)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 type-ui font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white sm:flex-none">
                  <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t('Manage')}
                </button>
                <button type="button" onClick={() => saveConsent({ functional: true, analytics: true, marketing: true })} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-3 py-2 type-ui font-bold text-white shadow-lg shadow-blue-950/40 transition-colors hover:bg-[var(--brand-primary-hover)] sm:flex-none sm:px-4">
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t('Accept all')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openPrefs && (
        <dialog ref={preferencesDialogRef} onClose={() => setOpenPrefs(false)} aria-labelledby="cookie-preferences-title" className="cookie-preferences-dialog fixed inset-0 z-[10000] m-auto w-[calc(100%-1.5rem)] max-w-xl max-h-[90dvh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 p-5 text-white shadow-2xl shadow-black/90 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 id="cookie-preferences-title" className="text-base font-bold text-white">{t('Privacy & Cookie Preferences')}</h3>
                <p className="mt-0.5 type-card-description text-slate-400">{t('Choose which optional cookies AlphaClone may use.')}</p>
              </div>
              <button type="button" onClick={() => setOpenPrefs(false)} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-900 hover:text-white" aria-label={t('Close preferences')}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3 py-4">
              <ToggleRow label={t('Essential Cookies')} description={t('Required for secure authentication, workspace session state, and security features.')} checked disabled />
              <ToggleRow label={t('Functional Cookies')} description={t('Saves layout preferences, theme settings, and language.')} checked={functional} onToggle={() => setFunctional((value) => !value)} />
              <ToggleRow label={t('Analytics & Insights')} description={t('Helps us understand platform usage to improve performance and reliability.')} checked={analytics} onToggle={() => setAnalytics((value) => !value)} />
              <ToggleRow label={t('Marketing Cookies')} description={t('Allows campaign measurement and relevant advertising where enabled.')} checked={marketing} onToggle={() => setMarketing((value) => !value)} />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800/80 pt-4">
              <button type="button" onClick={() => setOpenPrefs(false)} className="rounded-xl px-4 py-2.5 type-ui font-semibold text-slate-400 transition-colors hover:text-white">{t('Cancel')}</button>
              <button type="button" onClick={() => saveConsent({ functional, analytics, marketing })} className="rounded-xl bg-[var(--brand-primary)] px-5 py-2.5 type-ui font-bold text-white transition-colors hover:bg-[var(--brand-primary-hover)]">{t('Save preferences')}</button>
            </div>
        </dialog>
      )}
    </>
  );
}

function ToggleRow({ label, description, checked, disabled, onToggle }: { label: string; description: string; checked: boolean; disabled?: boolean; onToggle?: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3.5 sm:p-4">
      <div>
        <p className="type-card-description font-bold text-white sm:text-sm">{label}</p>
        <p className="mt-1 type-card-description leading-relaxed text-slate-400">{description}</p>
      </div>
      <button type="button" onClick={disabled ? undefined : onToggle} disabled={disabled} aria-label={label} aria-pressed={checked} className={`mt-0.5 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 py-1 type-ui font-bold transition-all ${checked ? 'border border-teal-500/30 bg-teal-500/20 text-teal-300' : 'border border-slate-700 bg-slate-800 text-slate-400'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
        {checked ? <ToggleRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ToggleLeft className="h-3.5 w-3.5" aria-hidden="true" />}
        {checked ? t('On') : t('Off')}
      </button>
    </div>
  );
}
