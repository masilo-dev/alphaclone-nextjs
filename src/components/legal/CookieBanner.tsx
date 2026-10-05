'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, Settings2, Shield, X, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  readConsentState,
  saveConsentState,
  revokeOptionalConsents,
  UserConsentState,
  OptionalConsentChoices,
  CONSENT_CHANGE_EVENT,
  OPEN_PREFERENCES_EVENT,
} from '@/lib/consent/consentManager';

export type { UserConsentState, OptionalConsentChoices };

export function useCookieConsent() {
  const [consent, setConsent] = useState<UserConsentState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readConsentState());
    setReady(true);

    const onConsentChanged = () => {
      setConsent(readConsentState());
      setReady(true);
    };

    window.addEventListener('storage', onConsentChanged);
    window.addEventListener(CONSENT_CHANGE_EVENT, onConsentChanged as EventListener);

    return () => {
      window.removeEventListener('storage', onConsentChanged);
      window.removeEventListener(CONSENT_CHANGE_EVENT, onConsentChanged as EventListener);
    };
  }, []);

  return useMemo(() => ({ consent, hasConsent: Boolean(consent), ready }), [consent, ready]);
}

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
    window.addEventListener(OPEN_PREFERENCES_EVENT, open);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, open);
  }, []);

  useEffect(() => {
    const dialog = preferencesDialogRef.current;
    if (openPrefs && dialog && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // Fallback for browsers with restricted dialog support
      }
    }
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [openPrefs]);

  if (hideOnWorkspace) return null;

  const handleSave = (next: OptionalConsentChoices) => {
    saveConsentState(next);
    setOpenPrefs(false);
  };

  const handleRevoke = () => {
    revokeOptionalConsents();
    setFunctional(false);
    setAnalytics(false);
    setMarketing(false);
    setOpenPrefs(false);
  };

  return (
    <>
      {ready && !consent && (
        <aside
          role="region"
          aria-label={t('Cookie consent banner')}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] w-[calc(100%-2rem)] max-w-md pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
        >
          <div className="pointer-events-auto rounded-2xl border border-slate-200 dark:border-[var(--ws-border)] bg-white dark:bg-[var(--ws-panel)] p-5 shadow-xl shadow-slate-900/10 dark:shadow-black/50 backdrop-blur-xl">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Shield className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('Your privacy choices')}
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-[var(--ws-text-muted)]">
                  {t(
                    'We use essential cookies to keep AlphaClone secure. You can allow optional functional, analytics, and marketing cookies, or choose essential only.'
                  )}
                </p>
                <div className="mt-1.5">
                  <Link
                    href="/legal/cookies"
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2"
                  >
                    {t('Read the Cookie Policy')}
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-[var(--ws-border)]">
              <button
                type="button"
                onClick={() => setOpenPrefs(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-[var(--ws-text-muted)] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[var(--ws-surface-secondary)] transition-colors"
              >
                <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t('Manage')}
              </button>
              <button
                type="button"
                onClick={() => handleSave({ functional: false, analytics: false, marketing: false })}
                className="rounded-lg border border-slate-200 dark:border-[var(--ws-border)] bg-white dark:bg-[var(--ws-surface-secondary)] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-[var(--ws-text-secondary)] hover:bg-slate-50 dark:hover:bg-[var(--ws-surface-tertiary)] transition-colors shadow-sm"
              >
                {t('Essential only')}
              </button>
              <button
                type="button"
                onClick={() => handleSave({ functional: true, analytics: true, marketing: true })}
                className="rounded-lg bg-[var(--ws-panel)] dark:bg-white text-white dark:text-slate-950 px-3.5 py-1.5 text-xs font-semibold hover:bg-[var(--ws-surface-secondary)] dark:hover:bg-slate-100 transition-colors shadow-sm"
              >
                {t('Accept all')}
              </button>
            </div>
          </div>
        </aside>
      )}

      {openPrefs && (
        <dialog
          ref={preferencesDialogRef}
          onClose={() => setOpenPrefs(false)}
          aria-labelledby="cookie-preferences-title"
          className="cookie-preferences-dialog z-[10000] w-[calc(100%-2rem)] max-w-lg max-h-[88dvh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-[var(--ws-border)] bg-white dark:bg-[var(--ws-panel)] p-5 sm:p-6 text-slate-900 dark:text-white shadow-2xl shadow-slate-900/20 dark:shadow-black/80 open:flex open:flex-col backdrop:bg-[var(--ws-canvas)]/55 backdrop:backdrop-blur-sm"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[var(--ws-border)] pb-4">
            <div>
              <h3 id="cookie-preferences-title" className="text-base font-bold text-slate-900 dark:text-white">
                {t('Privacy & Cookie Preferences')}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--ws-text-muted)] dark:text-[var(--ws-text-muted)]">
                {t('Choose which optional cookies and trackers AlphaClone and Cloudflare Zaraz may activate.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenPrefs(false)}
              className="rounded-lg p-1.5 text-[var(--ws-text-muted)] hover:text-slate-600 dark:hover:text-[var(--ws-text-secondary)] hover:bg-slate-100 dark:hover:bg-[var(--ws-surface-secondary)] transition-colors"
              aria-label={t('Close preferences')}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-3 py-4">
            <ToggleRow
              label={t('Essential Cookies & Security')}
              description={t(
                'Required for secure authentication, Cloudflare Turnstile bot verification, session state, and CSRF protection. Cannot be disabled.'
              )}
              checked
              disabled
            />
            <ToggleRow
              label={t('Functional Cookies')}
              description={t('Saves user workspace layout preferences, theme settings, and language localization choices.')}
              checked={functional}
              onToggle={() => setFunctional((value) => !value)}
            />
            <ToggleRow
              label={t('Analytics & Platform Insights')}
              description={t(
                'Helps us understand platform usage to improve performance and reliability. Governed via Google Consent Mode v2.'
              )}
              checked={analytics}
              onToggle={() => setAnalytics((value) => !value)}
            />
            <ToggleRow
              label={t('Marketing & Conversion Measurement')}
              description={t('Allows anonymous campaign conversion measurement and advertising attribution where enabled.')}
              checked={marketing}
              onToggle={() => setMarketing((value) => !value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-[var(--ws-border)] pt-4">
            <button
              type="button"
              onClick={handleRevoke}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[var(--ws-border)] bg-transparent px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('Reset to Essential Only')}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpenPrefs(false)}
                className="rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-[var(--ws-text-muted)] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[var(--ws-surface-secondary)] transition-colors"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleSave({ functional, analytics, marketing })}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold transition-colors shadow-sm"
              >
                {t('Save preferences')}
              </button>
            </div>
          </div>
        </dialog>
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
  const { t } = useLanguage();
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-[var(--ws-border)]/80 bg-slate-50/50 dark:bg-[var(--ws-panel)]/40 p-3.5">
      <div className="min-w-0 flex-1 pr-2">
        <p className="text-xs font-bold text-slate-900 dark:text-white">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--ws-text-muted)] dark:text-[var(--ws-text-muted)]">{description}</p>
      </div>
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        aria-label={label}
        aria-pressed={checked}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
          checked ? 'bg-blue-600' : 'bg-slate-200 dark:bg-[var(--ws-surface-tertiary)]'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <span className="sr-only">{checked ? t('On') : t('Off')}</span>
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
