/**
 * Canonical Cloudflare Zaraz, Google Consent Mode v2, and First-Party Consent Bridge
 * AlphaClone Systems
 */

import { CONSENT_VERSION, CONSENT_TTL, CONSENT_KEYS, validateConsent, installConsentBridge, consentBootstrapConfig, type StoredConsent } from './consentBootstrap';
export type UserConsentState = StoredConsent;
export type OptionalConsentChoices = Pick<StoredConsent, 'functional' | 'analytics' | 'marketing'>;
export const CURRENT_CONSENT_VERSION = CONSENT_VERSION;
export const STORAGE_KEYS = CONSENT_KEYS;
export const CONSENT_COOKIE = 'ac_cookie_consent';
export const CONSENT_MAX_AGE_SECONDS = CONSENT_TTL;
export const CONSENT_CHANGE_EVENT = 'ac:cookie-consent';
export const OPEN_PREFERENCES_EVENT = 'ac:open-cookie-preferences';
function bridge() { return installConsentBridge(consentBootstrapConfig(), validateConsent); }

/**
 * Generates or retrieves a persistent anonymous ID for audit tracking without PII.
 */
export function getOrCreateAnonymousId(): string {
  if (typeof window === 'undefined') return '';
  const KEY = 'ac_anon_compliance_id';
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = 'anon_' + crypto.randomUUID();
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
  return validateConsent(raw, CURRENT_CONSENT_VERSION, CONSENT_MAX_AGE_SECONDS);
}
export function readConsentState(): UserConsentState | null {
  return typeof window === 'undefined' ? null : bridge().read();
}
export function syncZarazConsent(choices: OptionalConsentChoices): boolean {
  return typeof window !== 'undefined' && bridge().zaraz(choices);
}
export function syncGoogleConsentMode(choices: { analytics: boolean; marketing: boolean }): void {
  if (typeof window !== 'undefined') bridge().google({ functional: false, ...choices }, 'update');
}
export function initGoogleConsentModeDefaults(): void {
  if (typeof window !== 'undefined') bridge();
}
const AUDIT_QUEUE_KEY = 'ac_pending_consent_records';
let flushing = false;
let pendingRecords: Record<string, unknown>[] = [];
let auditListenersInstalled = false;
function readQueue() {
  try {
    const stored = JSON.parse(localStorage.getItem(AUDIT_QUEUE_KEY) || '[]');
    if (Array.isArray(stored)) pendingRecords = stored;
  } catch { /* retain in-memory queue */ }
}
export async function flushConsentAuditQueue(): Promise<void> {
  if (typeof window === 'undefined' || flushing) return;
  flushing = true;
  try {
    readQueue();
    while (pendingRecords.length) {
      const record = pendingRecords[0];
      const response = await fetch('/api/legal/consent-record', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify(record), signal: AbortSignal.timeout(10000),
      });
      const receipt = await response.json().catch(() => null);
      if (!response.ok || receipt?.success !== true) break;
      readQueue();
      pendingRecords = pendingRecords.filter(item => item.recordId !== record.recordId);
      try { localStorage.setItem(AUDIT_QUEUE_KEY, JSON.stringify(pendingRecords)); } catch { /* use memory */ }
    }
  } catch { /* retry on next change, online event or page visit */ }
  finally { flushing = false; }
}
export function initializeConsentAudit(): void {
  if (typeof window === 'undefined') return;
  if (!auditListenersInstalled) {
    window.addEventListener('online', () => { void flushConsentAuditQueue(); });
    auditListenersInstalled = true;
  }
  void flushConsentAuditQueue();
}
function queueConsentAudit(state: UserConsentState, zarazSynced: boolean) {
  readQueue();
  pendingRecords.push({ recordId: crypto.randomUUID(), anonymousId: state.anonymousId,
    essential: true, functional: state.functional, analytics: state.analytics, marketing: state.marketing,
    consentVersion: state.version, collectedAt: state.timestamp, zarazSynced });
  pendingRecords = pendingRecords.slice(-100);
  try { localStorage.setItem(AUDIT_QUEUE_KEY, JSON.stringify(pendingRecords)); } catch { /* use memory */ }
  initializeConsentAudit();
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

  queueConsentAudit(state, zarazSynced);

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
