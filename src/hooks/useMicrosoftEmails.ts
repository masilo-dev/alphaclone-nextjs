import { useCallback, useEffect, useState } from 'react';
import { microsoftGraphService } from '@/services/microsoftGraphService';
import { microsoftAuthService } from '@/services/microsoftAuthService';
import { isAuthErrorMessage, refreshMicrosoftTokenIfNeeded } from '@/lib/email/tokenRefresh';

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
  const [folder, setFolder] = useState<'inbox' | 'sent' | 'drafts' | 'trash'>('inbox');
  const [loading, setLoading] = useState(enabled);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (retried = false) => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const isConnected = await microsoftAuthService.isConnected();
      setConnected(isConnected);
      if (!isConnected) {
        setEmails([]);
        return;
      }

      if (!retried) {
        await refreshMicrosoftTokenIfNeeded(false);
      }

      const messages = await microsoftGraphService.getFolderMessages(folder, limit);
      setEmails(messages);
    } catch (refreshError) {
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
      setLoading(false);
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
    await refresh();
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
