'use client';

import { useCallback, useEffect, useState } from 'react';

export type BonnieConversationSummary = {
  id: string;
  title: string;
  module?: string | null;
  pinned: boolean;
  archived: boolean;
  archivedAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export function useBonnieConversations(tenantId?: string | null) {
  const [conversations, setConversations] = useState<BonnieConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (opts?: { q?: string; includeArchived?: boolean }) => {
      if (!tenantId) {
        setConversations([]);
        return [];
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          tenantId,
          list: '1',
        });
        if (opts?.q) params.set('q', opts.q);
        if (opts?.includeArchived) params.set('includeArchived', '1');
        const res = await fetch(`/api/bonnie/conversations?${params.toString()}`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load conversations');
        const list = (data.conversations || []) as BonnieConversationSummary[];
        setConversations(list);
        return list;
      } catch (err: any) {
        setError(err?.message || 'Failed to load conversations');
        return [];
      } finally {
        setLoading(false);
      }
    },
    [tenantId]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createConversation = useCallback(
    async (title?: string, module?: string | null) => {
      if (!tenantId) throw new Error('tenant required');
      const res = await fetch('/api/bonnie/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          action: 'create',
          title: title || 'New conversation',
          module: module || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create conversation');
      await refresh();
      return data.conversation as BonnieConversationSummary;
    },
    [tenantId, refresh]
  );

  const patchConversation = useCallback(
    async (
      id: string,
      patch: {
        title?: string;
        pinned?: boolean;
        archive?: boolean;
        module?: string | null;
        metadata?: Record<string, unknown>;
      }
    ) => {
      if (!tenantId) throw new Error('tenant required');
      const res = await fetch(`/api/bonnie/conversations/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to update conversation');
      await refresh({ includeArchived: true });
      return data.conversation as BonnieConversationSummary;
    },
    [tenantId, refresh]
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!tenantId) throw new Error('tenant required');
      const res = await fetch(
        `/api/bonnie/conversations/${id}?tenantId=${encodeURIComponent(tenantId)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete conversation');
      await refresh({ includeArchived: true });
    },
    [tenantId, refresh]
  );

  return {
    conversations,
    loading,
    error,
    refresh,
    createConversation,
    patchConversation,
    deleteConversation,
  };
}
