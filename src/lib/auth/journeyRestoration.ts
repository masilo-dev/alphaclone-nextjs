/**
 * Safe Journey Restoration & Session Diagnosis for AlphaClone Systems.
 *
 * Guarantees:
 * 1. Only relative same-origin paths are stored/restored (no open redirects).
 * 2. Pending mutations or saves are NEVER automatically replayed upon login.
 * 3. Clear diagnosis between expired sessions, network dropouts, and manual logouts.
 */

export type SessionDiagnosisType =
  | 'expired'
  | 'refresh_failed'
  | 'revoked'
  | 'network_error'
  | 'app_error'
  | 'deliberate_logout';

export interface SessionDiagnosis {
  type: SessionDiagnosisType;
  message: string;
  timestamp: number;
  returnPath?: string;
}

const JOURNEY_KEY = 'alphaclone_journey_return_path';
const DIAGNOSIS_KEY = 'alphaclone_session_diagnosis';

/**
 * Validates that a path is a safe, relative, same-origin route.
 * Rejects external URLs, protocol-relative '//', javascript:, and data: schemes.
 */
export function isValidSameOriginPath(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  // Must start with a single slash and not double slash
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return false;
  // Disallow javascript/data schemes or control characters
  if (/[\\{}<>\r\n]/.test(trimmed)) return false;
  if (/^\/(api|_next|static|favicon\.ico)/.test(trimmed)) return false;
  return true;
}

const memoryStore = new Map<string, string>();

function getStorage(): {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
} {
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    return window.sessionStorage;
  }
  return {
    getItem: (k) => memoryStore.get(k) ?? null,
    setItem: (k, v) => { memoryStore.set(k, v); },
    removeItem: (k) => { memoryStore.delete(k); },
  };
}

/**
 * Saves the current location for restoration after authentication.
 */
export function saveJourneyReturnPath(path: string): void {
  if (!isValidSameOriginPath(path)) return;
  try {
    getStorage().setItem(JOURNEY_KEY, path);
  } catch {
    // Ignore storage quota or access errors
  }
}

/**
 * Retrieves the verified same-origin path to restore.
 */
export function getJourneyReturnPath(): string | null {
  try {
    const stored = getStorage().getItem(JOURNEY_KEY);
    if (stored && isValidSameOriginPath(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

/**
 * Clears the stored journey path once restored.
 */
export function clearJourneyReturnPath(): void {
  try {
    getStorage().removeItem(JOURNEY_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Records session diagnosis so the login screen can provide an informative explanation.
 */
export function recordSessionDiagnosis(diagnosis: {
  type: SessionDiagnosisType;
  message: string;
  returnPath?: string;
}): void {
  try {
    const payload: SessionDiagnosis = {
      ...diagnosis,
      timestamp: Date.now(),
    };
    getStorage().setItem(DIAGNOSIS_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Consumes and clears the current session diagnosis.
 */
export function consumeSessionDiagnosis(): SessionDiagnosis | null {
  try {
    const raw = getStorage().getItem(DIAGNOSIS_KEY);
    if (!raw) return null;
    getStorage().removeItem(DIAGNOSIS_KEY);
    const parsed = JSON.parse(raw) as SessionDiagnosis;
    // Discard diagnoses older than 15 minutes
    if (Date.now() - parsed.timestamp > 15 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Explicit guard: Restored sessions must NEVER automatically trigger submissions.
 */
export function canAutoSubmitOnJourneyRestore(): false {
  return false;
}
