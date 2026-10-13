import { useCallback, useEffect, useRef, useState } from 'react';
import { microsoftGraphService } from '@/services/microsoftGraphService';
import { microsoftAuthService } from '@/services/microsoftAuthService';
import { isAuthErrorMessage, refreshMicrosoftTokenIfNeeded } from '@/lib/email/tokenRefresh';
import type { InboxFolder } from '@/types/unifiedInbox';

export interface MicrosoftEmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  body: string;
  snippet: string;
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
  webLink?: string;
}

export function useMicrosoftEmails(limit = 25, enabled = true) {
  const [emails, setEmails] = useState<MicrosoftEmailMessage[]>([]);
  const [folder, setFolder] = useState<InboxFolder>('inbox');
  const [loading, setLoading] = useState(enabled);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestVersion = useRef(0);
  const currentScope = useRef(''); currentScope.current = `${enabled}:${folder}`;
  const refresh = useCallback(async (retried = false) => {
    if (!enabled) return;
    const version = ++requestVersion.current;
    const scope = currentScope.current;
    const isCurrent = () => version === requestVersion.current && scope === currentScope.current;
    setLoading(true);
    setError(null);
    try {
      const messages = await microsoftGraphService.getFolderMessages(folder, limit);
      if (!isCurrent()) return;
      setConnected(true);
      setEmails(messages);
    } catch (refreshError) {
      if (!isCurrent()) return;
      const raw =
        refreshError instanceof Error
          ? refreshError.message
          : `Failed to load Outlook ${folder} messages`;

      if (!retried && isAuthErrorMessage(raw)) {
        const refreshed = await refreshMicrosoftTokenIfNeeded(true);
        if (refreshed) {
          await refresh(true);
          return;
        }
      }

      const friendly = isAuthErrorMessage(raw)
        ? 'Outlook session expired. Reconnect Microsoft 365 if refresh did not work.'
        : raw;
      setError(friendly);
      setEmails([]);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [limit, folder, enabled]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [refresh, enabled]);

  useEffect(() => {
    if (enabled) return;
    let cancelled = false;
    microsoftAuthService
      .isConnected()
      .then((ok) => {
        if (!cancelled) setConnected(ok);
      })
      .catch(() => {
        if (!cancelled) setConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const sendEmail = async (input: {
    to: string[];
    subject: string;
    body: string;
    cc?: string[];
    bcc?: string[];
  }) => {
    await microsoftGraphService.sendEmail(input);
    void refresh();
  };

  return {
    emails,
    loading,
    connected,
    error,
    refresh,
    sendEmail,
    folder,
    setFolder,
  };
}
