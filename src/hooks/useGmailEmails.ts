'use client';

import { useCallback, useEffect, useState } from 'react';
import { gmailService, type GmailMessage } from '@/services/gmailService';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

const FOLDER_LABELS: Record<'inbox' | 'sent' | 'drafts' | 'trash', string[]> = {
  inbox: ['INBOX'],
  sent: ['SENT'],
  drafts: ['DRAFT'],
  trash: ['TRASH'],
};

export function useGmailEmails(limit = 25, enabled = true) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [folder, setFolder] = useState<'inbox' | 'sent' | 'drafts' | 'trash'>('inbox');
  const [loading, setLoading] = useState(enabled);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !user?.id || !currentTenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const statusRes = await fetch(
        `/api/integrations/email-providers?tenantId=${encodeURIComponent(currentTenant.id)}&provider=gmail`
      );
      const statusData = await statusRes.json().catch(() => ({}));
      const isConnected = Boolean(statusData.connected);
      setConnected(isConnected);
      if (!isConnected) {
        setEmails([]);
        return;
      }

      const { threads } = await gmailService.listThreads(user.id, limit, undefined, FOLDER_LABELS[folder]);
      setEmails(threads);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Gmail messages');
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, user?.id, currentTenant?.id, limit, folder]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    emails,
    folder,
    setFolder,
    loading,
    connected,
    error,
    refresh,
  };
}
