/** Dependency-free shared startup/runtime consent bridge; serialized into the head. */
export const CONSENT_VERSION = '2026-10-v2';
export const CONSENT_TTL = 365 * 24 * 60 * 60;
export const CONSENT_KEYS = ['ac_cookie_consent', 'ac_cookie_preferences'];
export type ConsentCategory = 'functional' | 'analytics' | 'marketing';
export type ConsentChoices = Record<ConsentCategory, boolean>;
export interface StoredConsent extends ConsentChoices {
  essential: true; timestamp: string; version: string; anonymousId: string;
}
export interface BootstrapConfig {
  version: string; maxAge: number; purposeIds: Partial<Record<ConsentCategory, string>>;
}
// Keep serialized functions self-contained: no module-scope runtime dependencies.
export function validateConsent(raw: string | null, version: string, maxAge: number): StoredConsent | null {
  try {
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || value.essential !== true || value.version !== version) return null;
    if (typeof value.timestamp !== 'string' || typeof value.anonymousId !== 'string' || !value.anonymousId) return null;
    const age = Date.now() - Date.parse(value.timestamp);
    if (!Number.isFinite(age) || age < 0 || age >= maxAge * 1000) return null;
    if (['functional', 'analytics', 'marketing'].some(key => typeof value[key] !== 'boolean')) return null;
    return value;
  } catch { return null; }
}
export function installConsentBridge(config: BootstrapConfig, validate: typeof validateConsent) {
  if (window.acConsentBridge) return window.acConsentBridge;
  const keys = ['ac_cookie_consent', 'ac_cookie_preferences'];
  const denied = { functional: false, analytics: false, marketing: false };
  const read = (): StoredConsent | null => {
    try {
      for (const key of keys) {
        const state = validate(localStorage.getItem(key), config.version, config.maxAge);
        if (state) return state;
      }
    } catch { /* cookie fallback */ }
    try {
      const entry = document.cookie.split('; ').find(c => c.startsWith('ac_cookie_consent='));
      return validate(entry ? decodeURIComponent(entry.slice(18)) : null, config.version, config.maxAge);
    } catch { return null; }
  };
  const google = (choices: ConsentChoices, command: 'default' | 'update') => {
    window.dataLayer = window.dataLayer || [];
    // Google's documented queue uses Arguments objects.
    // eslint-disable-next-line prefer-rest-params
    window.gtag = window.gtag || function () { window.dataLayer!.push(arguments); };
    window.gtag('consent', command, {
      analytics_storage: choices.analytics ? 'granted' : 'denied',
      ad_storage: choices.marketing ? 'granted' : 'denied',
      ad_user_data: choices.marketing ? 'granted' : 'denied',
      ad_personalization: choices.marketing ? 'granted' : 'denied',
    });
    document.querySelectorAll<HTMLScriptElement>('script[src*="googletagmanager.com/gtag/js?id="]').forEach(script => {
      const id = new URL(script.src).searchParams.get('id');
      if (id) (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = !choices.analytics;
    });
    if (!choices.marketing) window.fbq?.('consent', 'revoke');
    else window.fbq?.('consent', 'grant');
  };
  let lastGranted = '';
  const zaraz = (choices: ConsentChoices): boolean => {
    const api = window.zaraz?.consent;
    if (!api?.set || !api.purposes || !api.getAll) return false;
    const preferences: Record<string, boolean> = {};
    const mapped = new Set<string>();
    Object.keys(api.purposes).forEach(id => { preferences[id] = false; });
    for (const category of ['functional', 'analytics', 'marketing'] as const) {
      const explicit = config.purposeIds[category];
      const candidates: string[] = explicit ? [explicit] : Object.keys(api.purposes).filter(id =>
        id === category || String(api.purposes![id].name || '').trim().toLowerCase() === category);
      if (candidates.length !== 1 || !(candidates[0] in api.purposes) || mapped.has(candidates[0])) continue;
      mapped.add(candidates[0]); preferences[candidates[0]] = choices[category];
    }
    try {
      api.set(preferences);
      const actual = api.getAll();
      const synced = mapped.size === 3 && Object.keys(preferences).every(id => actual[id] === preferences[id]);
      const granted = Object.keys(preferences).filter(id => preferences[id] && actual[id]).sort().join(',');
      if (synced && granted && granted !== lastGranted) api.sendQueuedEvents?.();
      lastGranted = granted;
      return synced;
    } catch { return false; }
  };
  let expiryTimer: number | undefined;
  const apply = (choices: ConsentChoices = read() || denied) => {
    if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
    const saved = read();
    if (saved) expiryTimer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('ac:cookie-consent'));
    }, Math.max(1, Math.min(Date.parse(saved.timestamp) + config.maxAge * 1000 - Date.now(), 2147483647)));
    google(choices, 'update');
    return zaraz(choices);
  };
  const bridge = { read, apply, google, zaraz };
  window.acConsentBridge = bridge;
  google(denied, 'default'); apply();
  document.addEventListener('zarazConsentAPIReady', () => apply());
  window.addEventListener('ac:cookie-consent', () => apply());
  window.addEventListener('storage', event => {
    if (event.key === null || keys.includes(event.key)) {
      apply(); window.dispatchEvent(new CustomEvent('ac:cookie-consent'));
    }
  });
  return bridge;
}
export function consentBootstrapConfig(): BootstrapConfig {
  return { version: CONSENT_VERSION, maxAge: CONSENT_TTL, purposeIds: {
    functional: process.env.NEXT_PUBLIC_ZARAZ_FUNCTIONAL_PURPOSE_ID,
    analytics: process.env.NEXT_PUBLIC_ZARAZ_ANALYTICS_PURPOSE_ID,
    marketing: process.env.NEXT_PUBLIC_ZARAZ_MARKETING_PURPOSE_ID,
  } };
}
export function buildConsentBootstrapScript(): string {
  return `(${installConsentBridge.toString()})(${JSON.stringify(consentBootstrapConfig()).replace(/</g, '\\u003c')},${validateConsent.toString()});`;
}
declare global {
  interface Window {
    acConsentBridge?: { read: () => StoredConsent | null; apply: (choices?: ConsentChoices) => boolean;
      google: (choices: ConsentChoices, command: 'default' | 'update') => void; zaraz: (choices: ConsentChoices) => boolean; };
    zaraz?: { consent?: { set: (preferences: Record<string, boolean>) => void;
      get?: (purposeId: string) => boolean | undefined; getAll?: () => Record<string, boolean>;
      purposes?: Record<string, { name?: string }>; sendQueuedEvents?: () => void; };
      set?: (key: string, value: unknown, options?: unknown) => void; };
    dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void;
  }
}
