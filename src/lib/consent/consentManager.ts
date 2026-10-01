/**
 * Canonical Cloudflare Zaraz, Google Consent Mode v2, and First-Party Consent Bridge
 * AlphaClone Systems
 */

export interface UserConsentState {
  essential: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: string;
  anonymousId: string;
}

export type OptionalConsentChoices = {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
};

export const CURRENT_CONSENT_VERSION = '2026-10';
export const STORAGE_KEYS = ['ac_cookie_consent', 'ac_cookie_preferences'] as const;
export const CONSENT_COOKIE = 'ac_cookie_consent';
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year
export const CONSENT_CHANGE_EVENT = 'ac:cookie-consent';
export const OPEN_PREFERENCES_EVENT = 'ac:open-cookie-preferences';

declare global {
  interface Window {
    zaraz?: {
      consent?: {
        set: (preferences: Record<string, boolean>) => void;
        get?: (purposeId: string) => boolean;
        getAll?: () => Record<string, boolean>;
      };
      set?: (key: string, value: unknown, options?: unknown) => void;
    };
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Generates or retrieves a persistent anonymous ID for audit tracking without PII.
 */
export function getOrCreateAnonymousId(): string {
  if (typeof window === 'undefined') return '';
  const KEY = 'ac_anon_compliance_id';
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = 'anon_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'anon_session_' + Date.now().toString(36);
  }
}

/**
 * Validates and parses raw consent string from storage or cookie.
 */
export function parseStoredConsent(raw: string | null): UserConsentState | null {
  if (!raw) return null;
  try {
    const val = JSON.parse(raw);
    if (!val || typeof val !== 'object') return null;
    if (val.essential !== true && val.necessary !== true) return null;

    const timestamp = typeof val.timestamp === 'string' ? val.timestamp : new Date().toISOString();
    const age = Date.now() - new Date(timestamp).getTime();
    if (!Number.isFinite(age) || age > CONSENT_MAX_AGE_SECONDS * 1000) return null;

    return {
      essential: true,
      functional: Boolean(val.functional ?? false),
      analytics: Boolean(val.analytics ?? false),
      marketing: Boolean(val.marketing ?? false),
      timestamp,
      version: typeof val.version === 'string' ? val.version : CURRENT_CONSENT_VERSION,
      anonymousId: typeof val.anonymousId === 'string' ? val.anonymousId : getOrCreateAnonymousId(),
    };
  } catch {
    return null;
  }
}

/**
 * Reads user consent from local storage or first-party cookie.
 */
export function readConsentState(): UserConsentState | null {
  if (typeof window === 'undefined') return null;

  try {
    for (const key of STORAGE_KEYS) {
      const parsed = parseStoredConsent(window.localStorage.getItem(key));
      if (parsed) return parsed;
    }
  } catch {
    // LocalStorage blocked, fall back to cookie
  }

  try {
    const cookieEntry = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${CONSENT_COOKIE}=`))
      ?.slice(CONSENT_COOKIE.length + 1);
    const parsedCookie = parseStoredConsent(cookieEntry ? decodeURIComponent(cookieEntry) : null);
    if (parsedCookie) return parsedCookie;
  } catch {
    // Cookie reading error
  }

  return null;
}

/**
 * Broadcasts consent to Cloudflare Zaraz if present.
 */
export function syncZarazConsent(choices: { functional: boolean; analytics: boolean; marketing: boolean }): boolean {
  if (typeof window === 'undefined') return false;

  const zarazPreferences: Record<string, boolean> = {
    functional: choices.functional,
    analytics: choices.analytics,
    marketing: choices.marketing,
    // Common aliases used in Zaraz dashboards
    'analytics_id': choices.analytics,
    'marketing_id': choices.marketing,
    'functional_id': choices.functional,
  };

  if (window.zaraz?.consent?.set) {
    try {
      window.zaraz.consent.set(zarazPreferences);
      return true;
    } catch (err) {
      console.warn('[ConsentManager] Zaraz consent update error:', err);
    }
  } else {
    // Listen for Zaraz consent ready event if Zaraz is still loading
    const onZarazReady = () => {
      try {
        window.zaraz?.consent?.set?.(zarazPreferences);
      } catch (e) {
        console.warn('[ConsentManager] Deferred Zaraz set failed:', e);
      }
    };
    window.document.addEventListener('zarazConsentAPIReady', onZarazReady, { once: true });
  }

  return false;
}

/**
 * Emits Google Consent Mode v2 updates to dataLayer/gtag.
 */
export function syncGoogleConsentMode(choices: { analytics: boolean; marketing: boolean }): void {
  if (typeof window === 'undefined') return;

  try {
    window.dataLayer = window.dataLayer || [];
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    }
    if (!window.gtag) {
      window.gtag = gtag as never;
    }

    const consentSignals = {
      analytics_storage: choices.analytics ? 'granted' : 'denied',
      ad_storage: choices.marketing ? 'granted' : 'denied',
      ad_user_data: choices.marketing ? 'granted' : 'denied',
      ad_personalization: choices.marketing ? 'granted' : 'denied',
    };

    window.gtag('consent', 'update', consentSignals);
  } catch (err) {
    console.warn('[ConsentManager] Google Consent Mode error:', err);
  }
}

/**
 * Initializes default denied consent mode prior to any tag fire.
 */
export function initGoogleConsentModeDefaults(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dataLayer = window.dataLayer || [];
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    }
    if (!window.gtag) {
      window.gtag = gtag as never;
    }

    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500,
    });
  } catch (err) {
    console.warn('[ConsentManager] Failed to set Google Consent Mode defaults:', err);
  }
}

/**
 * Writes consent choices to Storage, Cookie, Zaraz, Google Consent Mode, and asynchronously logs audit record.
 */
export function saveConsentState(choices: OptionalConsentChoices): UserConsentState {
  const anonymousId = getOrCreateAnonymousId();
  const state: UserConsentState = {
    essential: true,
    functional: Boolean(choices.functional),
    analytics: Boolean(choices.analytics),
    marketing: Boolean(choices.marketing),
    timestamp: new Date().toISOString(),
    version: CURRENT_CONSENT_VERSION,
    anonymousId,
  };

  const payload = JSON.stringify(state);

  // 1. Local storage
  try {
    for (const key of STORAGE_KEYS) {
      window.localStorage.setItem(key, payload);
    }
  } catch {
    // Continue with cookie fallback
  }

  // 2. First-party Cookie
  try {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(payload)}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${isHttps ? '; Secure' : ''}`;
  } catch {
    // Non-blocking
  }

  // 3. Cloudflare Zaraz
  const zarazSynced = syncZarazConsent(state);

  // 4. Google Consent Mode v2
  syncGoogleConsentMode({ analytics: state.analytics, marketing: state.marketing });

  // 5. Dispatch Custom Event for in-page subscribers
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: state }));
  }

  // 6. Asynchronous Server-side Audit Logging
  try {
    if (typeof fetch === 'function') {
      fetch('/api/legal/consent-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          anonymousId: state.anonymousId,
          essential: state.essential,
          functional: state.functional,
          analytics: state.analytics,
          marketing: state.marketing,
          consentVersion: state.version,
          zarazSynced,
        }),
      }).catch(() => {
        // Logging should be non-blocking
      });
    }
  } catch {
    // Ignore network logging errors in background
  }

  return state;
}

/**
 * Revokes all optional consents (resets to essential only).
 */
export function revokeOptionalConsents(): UserConsentState {
  return saveConsentState({
    functional: false,
    analytics: false,
    marketing: false,
  });
}
