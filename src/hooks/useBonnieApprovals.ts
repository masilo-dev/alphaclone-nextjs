'use client';

/**
 * useBonnieApprovals
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages Bonnie's pending approval queue with:
 *  • Initial REST fetch on mount
 *  • Supabase Realtime subscription for instant updates when DB rows change
 *  • Fallback polling (every 30s) if Realtime is unavailable
 *  • Inline arg editing: passes editedArgs directly to the approve route
 *  • Role-aware error surface for high-risk rejections (403 INSUFFICIENT_ROLE)
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import {
  fetchBonnieApprovalsShared,
  getBonnieApprovalsSnapshot,
  subscribeBonnieApprovals,
  type BonnieApprovalItem,
} from '@/lib/client/bonnieApprovalsStore';

export type { BonnieApprovalItem };

export function useBonnieApprovals(tenantId: string | undefined) {
  const snapshot = useSyncExternalStore(
    subscribeBonnieApprovals,
    getBonnieApprovalsSnapshot,
    getBonnieApprovalsSnapshot
  );
  const realtimeConnected = useRef(false);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    await fetchBonnieApprovalsShared(tenantId, { force: true });
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    void fetchBonnieApprovalsShared(tenantId);
    const interval = setInterval(() => {
      void fetchBonnieApprovalsShared(tenantId);
    }, 60_000);
    return () => clearInterval(interval);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`bonnie-approvals-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'autonomous_runner_approvals',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          void fetchBonnieApprovalsShared(tenantId, { force: true });
        }
      )
      .subscribe((status: string) => {
        realtimeConnected.current = status === 'SUBSCRIBED';
      });

    return () => {
      void supabase.removeChannel(channel);
      realtimeConnected.current = false;
    };
  }, [tenantId]);

  const handleApproval = useCallback(
    async (
      approvalId: string,
      status: 'approved' | 'rejected',
      editedArgs?: Record<string, unknown>
    ) => {
      if (!tenantId) return { success: false, error: 'No tenant' };

      const toastId = toast.loading(status === 'approved' ? 'Approving action…' : 'Cancelling action…');
      try {
        // Send editedArgs directly to the approve route (it handles the merge + history internally)
        const res = await fetch('/api/autonomous/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            approvalId,
            status,
            editedArgs: editedArgs && Object.keys(editedArgs).length > 0 ? editedArgs : undefined,
          }),
        });
        const data = await res.json();

        // Handle the high-risk role gate (403 INSUFFICIENT_ROLE)
        if (res.status === 403 && data.code === 'INSUFFICIENT_ROLE') {
          toast.error(
            `High-risk approval requires a workspace admin. Your role: ${data.userRole || 'member'}.`,
            { id: toastId, duration: 6000 }
          );
          return { success: false, error: data.error, code: 'INSUFFICIENT_ROLE' };
        }

        if (!data.success) throw new Error(data.error || 'Approval update failed');

        const execMsg =
          status === 'approved' && data.execution?.success
            ? `Approved and executed: ${data.execution?.result?.summary || 'done'}`
            : status === 'approved' && data.execution?.error
              ? `Approved but execution failed: ${data.execution.error}`
              : status === 'approved'
                ? 'Action approved.'
                : 'Action cancelled.';

        toast.success(execMsg, { id: toastId });
        // Realtime will refresh automatically, but trigger a manual refresh too
        await refresh();
        return {
          success: true,
          execution: data.execution,
          continuation: data.continuation || null,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update approval';
        toast.error(message, { id: toastId });
        return { success: false, error: message };
      }
    },
    [tenantId, refresh]
  );

  const pendingCount = snapshot.tenantId === tenantId
    ? snapshot.approvals.filter((a) => a.status === 'pending').length
    : 0;

  return {
    approvals: snapshot.tenantId === tenantId ? snapshot.approvals : [],
    pendingCount,
    loading: snapshot.tenantId === tenantId ? snapshot.loading : false,
    error: snapshot.tenantId === tenantId ? snapshot.error : null,
    refresh,
    handleApproval,
    realtimeConnected: realtimeConnected.current,
  };
}
