type Listener = () => void;

export type BonnieApprovalItem = {
  id: string;
  toolName: string;
  riskLevel: string;
  reason: string;
  status: string;
  createdAt: string;
  preview: { target?: string; draft?: string };
  payload: Record<string, unknown>;
  editHistory?: Array<{ timestamp: string; previous_args?: Record<string, unknown>; new_args?: Record<string, unknown> }>;
  workflowId?: string | null;
  conversationId?: string | null;
};

type StoreSnapshot = {
  tenantId: string | null;
  approvals: BonnieApprovalItem[];
  loading: boolean;
  error: string | null;
};

const listeners = new Set<Listener>();
let inflight: Promise<void> | null = null;

const state: StoreSnapshot & { lastFetchAt: number; backoffUntil: number } = {
  tenantId: null,
  approvals: [],
  loading: false,
  error: null,
  lastFetchAt: 0,
  backoffUntil: 0,
};

/** Cached snapshot — useSyncExternalStore requires stable references between emits. */
let snapshot: StoreSnapshot = {
  tenantId: state.tenantId,
  approvals: state.approvals,
  loading: state.loading,
  error: state.error,
};

function syncSnapshot(): void {
  snapshot = {
    tenantId: state.tenantId,
    approvals: state.approvals,
    loading: state.loading,
    error: state.error,
  };
}

function emit() {
  syncSnapshot();
  listeners.forEach((listener) => listener());
}

export function subscribeBonnieApprovals(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBonnieApprovalsSnapshot(): StoreSnapshot {
  return snapshot;
}

export async function fetchBonnieApprovalsShared(
  tenantId: string,
  options?: { force?: boolean }
): Promise<void> {
  const now = Date.now();
  if (now < state.backoffUntil) return;
  if (
    !options?.force &&
    state.tenantId === tenantId &&
    now - state.lastFetchAt < 15_000
  ) {
    return;
  }
  if (inflight) return inflight;

  state.tenantId = tenantId;
  if (!state.loading) {
    state.loading = true;
    emit();
  } else {
    state.loading = true;
  }

  inflight = (async () => {
    try {
      const res = await fetch(
        `/api/bonnie/approvals?tenantId=${encodeURIComponent(tenantId)}`,
        { credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        state.error = data.error || `Could not load approvals (${res.status})`;
        if (res.status >= 500 || res.status === 503) {
          state.backoffUntil = Date.now() + 60_000;
        }
        return;
      }

      state.approvals = data.approvals || [];
      state.error = null;
      state.backoffUntil = 0;
    } catch {
      state.error = 'Network error while loading approvals';
      state.backoffUntil = Date.now() + 30_000;
    } finally {
      state.loading = false;
      state.lastFetchAt = Date.now();
      inflight = null;
      emit();
    }
  })();

  return inflight;
}
