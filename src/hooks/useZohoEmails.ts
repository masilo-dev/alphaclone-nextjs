import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InboxFolder, UnifiedInboxMessage } from '@/types/unifiedInbox';
import { isAuthErrorMessage, refreshZohoTokenIfNeeded } from '@/lib/email/tokenRefresh';
import { formatMailFrom } from '@/lib/email/parseEmailHeader';

interface ZohoFolderRow {
  folderId: string;
  folderName: string;
}

function resolveFolderId(folders: ZohoFolderRow[], kind: InboxFolder): string {
  const pick = (pred: (name: string) => boolean) =>
    folders.find((f) => pred(String(f.folderName || '').toLowerCase()))?.folderId;

  const id =
    kind === 'inbox'
      ? pick((n) => n.includes('inbox'))
      : kind === 'sent'
        ? pick((n) => n.includes('sent'))
        : kind === 'drafts'
          ? pick((n) => n.includes('draft'))
          : pick((n) => n.includes('trash') || n.includes('deleted'));

  return id || folders[0]?.folderId || '1';
}

function parseZohoTime(raw: string): string {
  if (!raw) return new Date().toISOString();
  const asNum = Number(raw);
  const d = new Date(Number.isFinite(asNum) && asNum > 1e11 ? asNum : raw);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function mapZohoMessage(row: Record<string, unknown>, folderId: string): UnifiedInboxMessage {
  return {
    id: String(row.messageId || row.id || ''),
    provider: 'zoho',
    subject: String(row.subject || ''),
    from: formatMailFrom({
      name: String(row.sender || ''),
      address: String(row.fromAddress || row.from || ''),
      raw: String(row.sender || row.fromAddress || row.from || ''),
    }),
    snippet: String(row.snippet || row.summary || ''),
    receivedAt: parseZohoTime(String(row.receivedTime || row.sentDateInGMT || '')),
    zohoFolderId: folderId,
  };
}

export function useZohoEmails(limit = 40, enabled = true) {
  const [emails, setEmails] = useState<UnifiedInboxMessage[]>([]);
  const [folder, setFolder] = useState<InboxFolder>('inbox');
  const [folders, setFolders] = useState<ZohoFolderRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyCache = useRef<Map<string, string>>(new Map());

  const activeFolderId = useMemo(
    () => resolveFolderId(folders, folder),
    [folders, folder]
  );

  const checkConnected = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/zoho/status', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      return res.ok && data.isConnected === true;
    } catch {
      return false;
    }
  }, []);

  const fetchZoho = useCallback(
    async (url: string, retried = false): Promise<Response> => {
      const res = await fetch(url, { credentials: 'include' });
      if ((res.status === 401 || res.status === 403) && !retried) {
        const refreshed = await refreshZohoTokenIfNeeded(true);
        if (refreshed) return fetchZoho(url, true);
      }
      return res;
    },
    []
  );

  const refresh = useCallback(
    async (retried = false) => {
      if (!enabled) return;
      setLoading(true);
      setError(null);
      try {
        if (!retried) {
          await refreshZohoTokenIfNeeded(false);
        }

        const isConnected = await checkConnected();
        setConnected(isConnected);
        if (!isConnected) {
          setEmails([]);
          setFolders([]);
          return;
        }

        const foldersRes = await fetchZoho('/api/zoho/mail?action=folders');
        const foldersData = await foldersRes.json().catch(() => []);
        if (!foldersRes.ok) {
          throw new Error(foldersData.error || 'Failed to load Zoho folders');
        }

        const folderRows = Array.isArray(foldersData) ? (foldersData as ZohoFolderRow[]) : [];
        setFolders(folderRows);

        const folderId = resolveFolderId(folderRows, folder);
        const msgRes = await fetchZoho(
          `/api/zoho/mail?action=messages&folderId=${encodeURIComponent(folderId)}&limit=${limit}`
        );
        const msgData = await msgRes.json().catch(() => []);
        if (!msgRes.ok) {
          throw new Error(msgData.error || 'Failed to load Zoho messages');
        }

        const rows = Array.isArray(msgData) ? msgData : [];
        setEmails(rows.map((row) => mapZohoMessage(row as Record<string, unknown>, folderId)));
      } catch (refreshError) {
        const raw =
          refreshError instanceof Error ? refreshError.message : 'Failed to load Zoho mail';

        if (!retried && isAuthErrorMessage(raw)) {
          const refreshed = await refreshZohoTokenIfNeeded(true);
          if (refreshed) {
            await refresh(true);
            return;
          }
        }

        setError(
          isAuthErrorMessage(raw)
            ? 'Zoho session expired. Reconnect Zoho if refresh did not work.'
            : raw
        );
        setEmails([]);
      } finally {
        setLoading(false);
      }
    },
    [checkConnected, folder, limit, enabled, fetchZoho]
  );

  useEffect(() => {
    if (enabled) void refresh();
  }, [refresh, enabled]);

  useEffect(() => {
    if (enabled) return;
    let cancelled = false;
    checkConnected().then((ok) => {
      if (!cancelled) setConnected(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, checkConnected]);

  const loadMessageBody = useCallback(
    async (message: UnifiedInboxMessage): Promise<string> => {
      if (message.body) return message.body;
      const cached = bodyCache.current.get(message.id);
      if (cached) return cached;

      const folderId = message.zohoFolderId || activeFolderId;
      let res = await fetch(
        `/api/zoho/mail?action=content&messageId=${encodeURIComponent(message.id)}&folderId=${encodeURIComponent(folderId)}`,
        { credentials: 'include' }
      );
      if (res.status === 401 || res.status === 403) {
        const refreshed = await refreshZohoTokenIfNeeded(true);
        if (refreshed) {
          res = await fetch(
            `/api/zoho/mail?action=content&messageId=${encodeURIComponent(message.id)}&folderId=${encodeURIComponent(folderId)}`,
            { credentials: 'include' }
          );
        }
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load message');
      }
      const content = String(data.content || data.snippet || '');
      bodyCache.current.set(message.id, content);
      setEmails((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, body: content } : m))
      );
      return content;
    },
    [activeFolderId]
  );

  return {
    emails,
    loading,
    connected,
    error,
    refresh,
    folder,
    setFolder,
    loadMessageBody,
  };
}
