import { useCallback, useEffect, useState } from 'react';
import { microsoftGraphService } from '@/services/microsoftGraphService';
import { microsoftAuthService } from '@/services/microsoftAuthService';

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

export function useMicrosoftEmails(limit = 25) {
  const [emails, setEmails] = useState<MicrosoftEmailMessage[]>([]);
  const [folder, setFolder] = useState<'inbox' | 'sent' | 'drafts' | 'trash'>('inbox');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isConnected = await microsoftAuthService.isConnected();
      setConnected(isConnected);
      if (!isConnected) {
        setEmails([]);
        return;
      }

      const messages = await microsoftGraphService.getFolderMessages(folder, limit);
      setEmails(messages);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : `Failed to load Outlook ${folder} messages`);
    } finally {
      setLoading(false);
    }
  }, [limit, folder]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
