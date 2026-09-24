export const WALKTHROUGH_VERSION = '2026.09.24';

export type WalkthroughState = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

export interface WalkthroughRecord {
  state: WalkthroughState;
  version: string;
  stepIndex?: number;
  completedAt?: string;
  dismissedAt?: string;
  updatedAt: string;
}

const STORAGE_PREFIX = 'alphaclone:tour:v2:';
const SESSION_CHECK_PREFIX = 'alphaclone:tour:session_checked:';

export function getWalkthroughRecord(userId: string): WalkthroughRecord {
  const fallback: WalkthroughRecord = {
    state: 'not_started',
    version: WALKTHROUGH_VERSION,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window === 'undefined' || !userId) {
    return fallback;
  }

  try {
    // 1. Check current versioned record
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as WalkthroughRecord;
      if (parsed && typeof parsed.state === 'string') {
        // If version matches, respect state
        if (parsed.version === WALKTHROUGH_VERSION) {
          return parsed;
        }
        // If completed or dismissed in previous version, keep completed/dismissed
        // so returning users are not harassed on ordinary updates
        if (parsed.state === 'completed' || parsed.state === 'dismissed') {
          return {
            ...parsed,
            version: WALKTHROUGH_VERSION,
          };
        }
      }
    }

    // 2. Check legacy localStorage keys
    const legacyCompleted =
      localStorage.getItem(`business_tour_completed_${userId}`) === '1' ||
      localStorage.getItem(`tour_completed_${userId}`) === '1';

    const legacyDismissed = localStorage.getItem(`tour_dismissed_${userId}`) === '1';

    if (legacyCompleted) {
      const record: WalkthroughRecord = {
        state: 'completed',
        version: WALKTHROUGH_VERSION,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(record));
      return record;
    }

    if (legacyDismissed) {
      const record: WalkthroughRecord = {
        state: 'dismissed',
        version: WALKTHROUGH_VERSION,
        dismissedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(record));
      return record;
    }
  } catch (err) {
    console.warn('[WalkthroughService] Failed reading storage record', err);
  }

  return fallback;
}

export function setWalkthroughState(
  userId: string,
  state: WalkthroughState,
  stepIndex?: number
): WalkthroughRecord {
  const now = new Date().toISOString();
  const existing = getWalkthroughRecord(userId);

  const updated: WalkthroughRecord = {
    ...existing,
    state,
    version: WALKTHROUGH_VERSION,
    stepIndex: stepIndex !== undefined ? stepIndex : existing.stepIndex,
    updatedAt: now,
    ...(state === 'completed' ? { completedAt: now } : {}),
    ...(state === 'dismissed' ? { dismissedAt: now } : {}),
  };

  if (typeof window !== 'undefined' && userId) {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(updated));

      // Sync legacy keys for backward compatibility
      if (state === 'completed') {
        localStorage.setItem(`business_tour_completed_${userId}`, '1');
        localStorage.setItem(`tour_completed_${userId}`, '1');
      } else if (state === 'dismissed') {
        localStorage.setItem(`tour_dismissed_${userId}`, '1');
      }

      // Notify window listeners
      window.dispatchEvent(
        new CustomEvent('alphaclone:walkthrough-state-changed', {
          detail: { userId, state, record: updated },
        })
      );
    } catch (err) {
      console.warn('[WalkthroughService] Failed writing storage record', err);
    }

    // If completed, persist to backend profile
    if (state === 'completed' && typeof window !== 'undefined' && window.location?.origin) {
      const endpoint = `${window.location.origin}/api/account/profile`;
      void fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ walkthrough_completed: true }),
      }).catch((err) => console.error('[WalkthroughService] Save profile status failed', err));
    }
  }

  return updated;
}

/**
 * Determines whether the walkthrough should automatically pop open.
 * Strict conditions:
 * - User must be eligible (not_started)
 * - Must NOT have been auto-attempted already in this browser session
 * - Must NOT be an established workspace (existing customers should not be harassed)
 */
export function canAutoStartWalkthrough(userId: string, isEstablishedWorkspace: boolean): boolean {
  if (typeof window === 'undefined' || !userId) return false;

  // Existing workspaces with clients or prior data must never auto-open the tour
  if (isEstablishedWorkspace) return false;

  // Check session guard so it never pops twice in the same browser session
  const sessionChecked = sessionStorage.getItem(`${SESSION_CHECK_PREFIX}${userId}`);
  if (sessionChecked === 'true') return false;

  const record = getWalkthroughRecord(userId);
  return record.state === 'not_started';
}

/**
 * Mark that the auto-start check has been evaluated for this session.
 */
export function markAutoStartEvaluated(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    sessionStorage.setItem(`${SESSION_CHECK_PREFIX}${userId}`, 'true');
  } catch {
    // ignore sessionStorage errors
  }
}
