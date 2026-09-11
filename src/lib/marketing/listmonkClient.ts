type ListmonkRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
};

export type ListmonkHealth = {
  ok: boolean;
  configured: boolean;
  status?: number;
  error?: string;
};

function getConfig() {
  const baseUrl = process.env.LISTMONK_URL?.trim().replace(/\/$/, '');
  const username = process.env.LISTMONK_API_USER?.trim();
  const token = process.env.LISTMONK_API_TOKEN?.trim();
  return { baseUrl, username, token };
}

function authHeader(username: string, token: string) {
  return `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`;
}

export function isListmonkConfigured(): boolean {
  const { baseUrl, username, token } = getConfig();
  return Boolean(baseUrl && username && token);
}

async function listmonkRequest<T>(path: string, options: ListmonkRequestOptions = {}): Promise<T> {
  const { baseUrl, username, token } = getConfig();
  if (!baseUrl || !username || !token) {
    throw new Error('Listmonk is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: authHeader(username, token),
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Listmonk request failed (${response.status})`);
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getListmonkHealth(): Promise<ListmonkHealth> {
  if (!isListmonkConfigured()) return { ok: false, configured: false, error: 'not_configured' };
  try {
    await listmonkRequest('/api/lists?minimal=true&per_page=1', { timeoutMs: 4000 });
    return { ok: true, configured: true, status: 200 };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: error instanceof Error ? error.message : 'health_check_failed',
    };
  }
}

export async function createListmonkList(input: {
  name: string;
  type?: 'public' | 'private';
  optin?: 'single' | 'double';
  tags?: string[];
}) {
  return listmonkRequest<{ data: { id: number; uuid?: string; name: string } }>('/api/lists', {
    method: 'POST',
    body: {
      name: input.name,
      type: input.type ?? 'private',
      optin: input.optin ?? 'single',
      tags: input.tags ?? ['alphaclone'],
    },
  });
}

export async function createListmonkSubscriber(input: {
  email: string;
  name: string;
  lists: number[];
  attribs?: Record<string, unknown>;
  blocklisted?: boolean;
}) {
  return listmonkRequest<{ data: { id: number; uuid?: string; email: string; status: string } }>('/api/subscribers', {
    method: 'POST',
    body: {
      email: input.email,
      name: input.name,
      status: input.blocklisted ? 'blocklisted' : 'enabled',
      lists: input.lists,
      attribs: input.attribs ?? {},
      preconfirm_subscriptions: true,
    },
  });
}

export async function setListmonkSubscriberBlocklist(subscriberId: number, blocklisted: boolean) {
  return listmonkRequest<{ data: boolean }>(`/api/subscribers/${subscriberId}/blocklist`, {
    method: 'PUT',
    body: { blocklisted },
  });
}

export async function createListmonkCampaign(input: {
  name: string;
  subject: string;
  body: string;
  listIds: number[];
  fromEmail: string;
}) {
  return listmonkRequest<{ data: { id: number; status: string; name: string } }>('/api/campaigns', {
    method: 'POST',
    body: {
      name: input.name,
      subject: input.subject,
      body: input.body,
      lists: input.listIds,
      type: 'regular',
      content_type: 'html',
      from_email: input.fromEmail,
      messenger: 'email',
    },
  });
}

export async function changeListmonkCampaignStatus(campaignId: number, status: 'running' | 'paused' | 'cancelled' | 'scheduled') {
  return listmonkRequest<{ data: unknown }>(`/api/campaigns/${campaignId}/status`, {
    method: 'PUT',
    body: { status },
  });
}
