'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

export type BonnieApprovalItem = {
  id: string;
  toolName: string;
  riskLevel: string;
  reason: string;
  status: string;
  createdAt: string;
  preview: { target?: string; draft?: string };
  payload: Record<string, unknown>;
};

export function useBonnieApprovals(tenantId: string | undefined) {
  const [approvals, setApprovals] = useState<BonnieApprovalItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setApprovals([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/bonnie/approvals?tenantId=${tenantId}`);
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

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 20000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleApproval = useCallback(
    async (
      approvalId: string,
      status: 'approved' | 'rejected',
      editedArgs?: Record<string, unknown>
    ) => {
      if (!tenantId) return { success: false, error: 'No tenant' };

      const toastId = toast.loading(status === 'approved' ? 'Approving action…' : 'Cancelling action…');
      try {
        if (editedArgs && status === 'approved') {
          const patchRes = await fetch('/api/bonnie/approvals', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, approvalId, args: editedArgs }),
          });
          if (!patchRes.ok) {
            const patchData = await patchRes.json();
            throw new Error(patchData.error || 'Failed to save edits');
          }
        }

        const res = await fetch('/api/autonomous/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, approvalId, status }),
        });
        const data = await res.json();
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
  };
}
