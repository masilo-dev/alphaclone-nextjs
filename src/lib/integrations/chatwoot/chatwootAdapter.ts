/**
 * Chatwoot Omnichannel Conversations Adapter (Isolated).
 * Synchronizes customer conversations from live chat/WhatsApp/social into AlphaClone CRM contact timeline.
 * Disabled by default unless CHATWOOT_API_URL and CHATWOOT_API_TOKEN are configured.
 */

export interface ChatwootConfig {
  apiUrl?: string;
  apiToken?: string;
  accountId?: string;
  enabled: boolean;
}

export function getChatwootConfig(): ChatwootConfig {
  const apiUrl = process.env.CHATWOOT_API_URL?.trim();
  const apiToken = process.env.CHATWOOT_API_TOKEN?.trim();
  const accountId = process.env.CHATWOOT_ACCOUNT_ID?.trim();
  return {
    apiUrl,
    apiToken,
    accountId,
    enabled: Boolean(apiUrl && apiToken && accountId),
  };
}

export interface ChatwootConversation {
  id: number;
  inboxId: number;
  status: string;
  contactEmail?: string;
  unreadCount: number;
}

export async function fetchContactConversations(
  tenantId: string,
  contactEmail: string
): Promise<{ conversations: ChatwootConversation[]; error?: string }> {
  const config = getChatwootConfig();
  if (!config.enabled || !config.apiUrl || !config.apiToken || !config.accountId) {
    return { conversations: [], error: 'Chatwoot integration is not enabled or configured' };
  }

  try {
    const res = await fetch(
      `${config.apiUrl.replace(/\/$/, '')}/api/v1/accounts/${config.accountId}/contacts/search?q=${encodeURIComponent(contactEmail)}`,
      {
        headers: {
          api_access_token: config.apiToken,
          Accept: 'application/json',
          'X-Tenant-ID': tenantId,
        },
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!res.ok) {
      return { conversations: [], error: `Chatwoot returned HTTP ${res.status}` };
    }

    const json = await res.json();
    const payload = json.payload || [];
    return {
      conversations: payload.map((c: any) => ({
        id: c.id,
        inboxId: c.inbox_id,
        status: c.status || 'open',
        contactEmail: c.email || contactEmail,
        unreadCount: c.unread_count || 0,
      })),
    };
  } catch (err: any) {
    return { conversations: [], error: err.message || 'Chatwoot search failed' };
  }
}
