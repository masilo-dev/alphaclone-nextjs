/**
 * User & Tenant Scoped Form Draft Persistence for AlphaClone Systems.
 *
 * Guarantees:
 * 1. Strict isolation: draft keys include tenantId and userId.
 * 2. Restored drafts are strictly marked `unsaved` and require explicit user action to submit.
 * 3. Never leaks drafts between different accounts or workspaces.
 */

export interface ScopedDraft<T = Record<string, unknown>> {
  tenantId: string;
  userId: string;
  entityType: string;
  entityId: string;
  data: T;
  updatedAt: number;
  label: 'Unsaved Draft';
}

function buildDraftKey(tenantId: string, userId: string, entityType: string, entityId: string): string {
  return `ac_draft_${tenantId.trim()}_${userId.trim()}_${entityType.trim()}_${entityId.trim()}`;
}

const memoryDraftStore = new Map<string, string>();

function getDraftStorage(): {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
} {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }
  return {
    getItem: (k) => memoryDraftStore.get(k) ?? null,
    setItem: (k, v) => { memoryDraftStore.set(k, v); },
    removeItem: (k) => { memoryDraftStore.delete(k); },
  };
}

/**
 * Saves a non-sensitive form draft scoped to tenant, user, and entity.
 */
export function saveScopedDraft<T extends Record<string, unknown>>(params: {
  tenantId: string;
  userId: string;
  entityType: string;
  entityId: string;
  data: T;
}): void {
  const { tenantId, userId, entityType, entityId, data } = params;
  if (!tenantId || !userId || !entityType || !entityId) return;

  try {
    const draft: ScopedDraft<T> = {
      tenantId,
      userId,
      entityType,
      entityId,
      data,
      updatedAt: Date.now(),
      label: 'Unsaved Draft',
    };
    const key = buildDraftKey(tenantId, userId, entityType, entityId);
    getDraftStorage().setItem(key, JSON.stringify(draft));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Retrieves a scoped draft, strictly verifying current tenant and user ownership.
 */
export function getScopedDraft<T extends Record<string, unknown>>(params: {
  tenantId: string;
  userId: string;
  entityType: string;
  entityId: string;
}): ScopedDraft<T> | null {
  const { tenantId, userId, entityType, entityId } = params;
  if (!tenantId || !userId || !entityType || !entityId) return null;

  try {
    const key = buildDraftKey(tenantId, userId, entityType, entityId);
    const raw = getDraftStorage().getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ScopedDraft<T>;
    // Strict tenant and user isolation check
    if (parsed.tenantId !== tenantId || parsed.userId !== userId) {
      console.warn('[DraftPersistence] Scoped draft tenant or user mismatch. Discarding to prevent leak.');
      return null;
    }

    // Discard drafts older than 7 days
    if (Date.now() - parsed.updatedAt > 7 * 24 * 60 * 60 * 1000) {
      getDraftStorage().removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clears a scoped draft once persisted or deliberately discarded.
 */
export function clearScopedDraft(params: {
  tenantId: string;
  userId: string;
  entityType: string;
  entityId: string;
}): void {
  const { tenantId, userId, entityType, entityId } = params;
  try {
    const key = buildDraftKey(tenantId, userId, entityType, entityId);
    getDraftStorage().removeItem(key);
  } catch {
    // Ignore
  }
}
