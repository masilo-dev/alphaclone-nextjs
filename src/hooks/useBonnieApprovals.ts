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

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

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

export function useBonnieApprovals(tenantId: string | undefined) {
  const [approvals, setApprovals] = useState<BonnieApprovalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const realtimeConnected = useRef(false);

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setApprovals([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/bonnie/approvals?tenantId=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      if (data.success) {
        setApprovals(data.approvals || []);
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Initial fetch + polling fallback
  useEffect(() => {
    void refresh();
    // Reduced polling since Realtime handles most updates; keep as safety net
    const interval = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Supabase Realtime subscription — subscribe to changes in autonomous_runner_approvals
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
        (payload: unknown) => {
          // On any INSERT/UPDATE/DELETE affecting this tenant's approvals, refresh
          void refresh();
        }
      )
      .subscribe((status: string) => {
        realtimeConnected.current = status === 'SUBSCRIBED';
      });

    return () => {
      void supabase.removeChannel(channel);
      realtimeConnected.current = false;
    };
  }, [tenantId, refresh]);

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

  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  return {
    approvals,
    pendingCount,
    loading,
    refresh,
    handleApproval,
    realtimeConnected: realtimeConnected.current,
  };
}
