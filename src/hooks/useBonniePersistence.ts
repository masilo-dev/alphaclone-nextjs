'use client';

/**
 * useBonniePersistence
 * ─────────────────────────────────────────────────────────────────────────────
 * Hybrid persistence: primary source is the server-side database (via
 * /api/bonnie/conversations), with localStorage as an immediate local cache
 * so the UI is never blank on mount.
 *
 * Strategy:
 *  1. On mount → read from localStorage instantly (no flash).
 *  2. In background → fetch from /api/bonnie/conversations.
 *  3. If DB returns messages → replace localStorage copy and render from DB.
 *  4. On every message change → write to localStorage (debounced 400ms)
 *     and fire-and-forget a POST to /api/bonnie/conversations.
 *
 * Key format: `bonnie_chat_{tenantId}_{userId}` (fallback: `bonnie_chat_anon`)
 * Max messages persisted: 60 (to cap storage usage)
 * Serialisation errors are swallowed gracefully.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const MAX_PERSISTED = 60;
const DB_WRITE_DEBOUNCE_MS = 1500;

/** Base shape — callers can extend this via the generic parameter */
export type PersistedMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  executionStatus?: 'executed' | 'queued_for_approval' | 'read_only_answer' | 'planning_failed' | 'provider_blocked';
  tools?: Array<{
    tool: string;
    success: boolean;
    summary: string;
    approvalRequired?: boolean;
    approvalId?: string;
    riskClass?: string;
    preview?: { target?: string; draft?: string };
  }>;
  approval?: {
    approvalId: string;
    tool: string;
    riskClass?: string;
    summary?: string;
    preview?: { target?: string; draft?: string };
  };
};

// ── localStorage helpers ───────────────────────────────────────────────────────

function buildKey(tenantId?: string, userId?: string): string {
  const t = tenantId?.slice(0, 12) || 'anon';
  const u = userId?.slice(0, 12) || 'anon';
  return `bonnie_chat_${t}_${u}`;
}

function safeRead<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite<T>(key: string, messages: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    const slice = messages.slice(-MAX_PERSISTED);
    localStorage.setItem(key, JSON.stringify(slice));
  } catch {
    // storage quota or private mode — degrade silently
  }
}

function safeClear(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ── DB sync helpers ────────────────────────────────────────────────────────────

async function loadFromDB(tenantId: string): Promise<PersistedMessage[] | null> {
  try {
    const res = await fetch(`/api/bonnie/conversations?tenantId=${encodeURIComponent(tenantId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !Array.isArray(data.messages)) return null;
    return data.messages as PersistedMessage[];
  } catch {
    return null;
  }
}

async function saveToDBBatch(tenantId: string, messages: PersistedMessage[]): Promise<void> {
  if (!tenantId || !messages.length) return;
  try {
    await fetch('/api/bonnie/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, messages }),
    });
  } catch {
    // fire-and-forget, non-critical
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export type UseBonniePersistenceOptions<T extends PersistedMessage> = {
  tenantId?: string;
  userId?: string;
  introMessage?: string;
  /** Optional factory for the intro message object */
  introFactory?: () => T;
};

export type UseBonniePersistenceReturn<T extends PersistedMessage> = {
  messages: T[];
  setMessages: React.Dispatch<React.SetStateAction<T[]>>;
  clearHistory: () => void;
  /** true once initial read (from localStorage) is done */
  hydrated: boolean;
  /** true once DB fetch has completed (may differ from hydrated) */
  dbSynced: boolean;
};

export function useBonniePersistence<T extends PersistedMessage = PersistedMessage>({
  tenantId,
  userId,
  introMessage,
  introFactory,
}: UseBonniePersistenceOptions<T>): UseBonniePersistenceReturn<T> {
  const storageKey = buildKey(tenantId, userId);
  const [hydrated, setHydrated] = useState(false);
  const [dbSynced, setDbSynced] = useState(false);

  const introMessageRef = useRef(introMessage);
  const introFactoryRef = useRef(introFactory);
  introMessageRef.current = introMessage;
  introFactoryRef.current = introFactory;

  const buildIntro = useCallback((): T => {
    if (introFactoryRef.current) return introFactoryRef.current();
    return { id: 'intro', role: 'assistant', text: introMessageRef.current || '' } as T;
  }, []);

  const buildInitial = useCallback(
    (key: string): T[] => {
      const stored = safeRead<T>(key);
      if (stored.length > 0) return stored;
      if (introMessageRef.current || introFactoryRef.current) return [buildIntro()];
      return [];
    },
    [buildIntro]
  );

  const [messages, setMessages] = useState<T[]>([]);

  // Step 1: Hydrate from localStorage immediately on mount (zero-flash)
  const prevKeyRef = useRef<string>('');
  useEffect(() => {
    if (prevKeyRef.current === storageKey) return;
    prevKeyRef.current = storageKey;
    const initial = buildInitial(storageKey);
    setMessages(initial);
    setHydrated(true);
    setDbSynced(false);
  }, [storageKey, buildInitial]);

  // Step 2: After localStorage hydration, fetch from DB in the background
  useEffect(() => {
    if (!hydrated || !tenantId) {
      if (!tenantId) setDbSynced(true); // nothing to sync
      return;
    }

    let cancelled = false;
    const fetchDB = async () => {
      const dbMessages = await loadFromDB(tenantId);
      if (cancelled) return;

      if (dbMessages && dbMessages.length > 0) {
        setMessages((prev) => {
          const pendingApprovals = prev.filter((m) => m.approval);
          const dbIds = new Set(dbMessages.map((m) => m.id));
          const localOnlyApprovals = pendingApprovals.filter((m) => !dbIds.has(m.id));

          const merged: T[] = [
            ...(dbMessages.some((m) => m.id === 'intro') ? [] : [buildIntro()]),
            ...(dbMessages as T[]),
            ...localOnlyApprovals,
          ];
          if (
            merged.length === prev.length &&
            merged.every((msg, index) => msg.id === prev[index]?.id && msg.text === prev[index]?.text)
          ) {
            return prev;
          }
          safeWrite<T>(storageKey, merged);
          return merged;
        });
      } else if (dbMessages && dbMessages.length === 0) {
        setMessages((prev) => {
          if (prev.length === 0) return [buildIntro()];
          return prev;
        });
      }
      // If dbMessages is null (network error), keep localStorage version
      setDbSynced(true);
    };

    void fetchDB();
    return () => { cancelled = true; };
  }, [hydrated, tenantId, storageKey, buildIntro]);

  // Step 3: Persist to localStorage on every change (debounced)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Separate ref for DB write debounce
  const dbDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hydrated) return;

    // localStorage write (fast)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      safeWrite<T>(storageKey, messages);
    }, 400);

    // DB write (slower, fire-and-forget)
    if (tenantId && dbSynced) {
      if (dbDebounceRef.current) clearTimeout(dbDebounceRef.current);
      dbDebounceRef.current = setTimeout(() => {
        void saveToDBBatch(tenantId, messages.filter((m) => m.id !== 'intro'));
      }, DB_WRITE_DEBOUNCE_MS);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (dbDebounceRef.current) clearTimeout(dbDebounceRef.current);
    };
  }, [messages, storageKey, hydrated, tenantId, dbSynced]);

  const clearHistory = useCallback(() => {
    safeClear(storageKey);
    const fresh: T[] = introFactory
      ? [introFactory()]
      : introMessage
        ? [{ id: 'intro', role: 'assistant', text: introMessage } as T]
        : [];
    setMessages(fresh);
  }, [storageKey, introMessage, introFactory]);

  return { messages, setMessages, clearHistory, hydrated, dbSynced };
}
