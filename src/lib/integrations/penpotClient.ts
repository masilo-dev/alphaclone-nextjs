type PenpotRpcOptions = {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: Record<string, unknown>;
  timeoutMs?: number;
};

function config() {
  const baseUrl = String(process.env.PENPOT_BASE_URL || '').replace(/\/$/, '');
  const token = String(process.env.PENPOT_ACCESS_TOKEN || '').trim();
  if (!baseUrl || !token) throw new Error('Penpot is not configured');
  return { baseUrl, token };
}

export async function penpotRpc<T = unknown>(name: string, options: PenpotRpcOptions = {}): Promise<T> {
  const { baseUrl, token } = config();
  const method = options.method || 'POST';
  const url = new URL(`${baseUrl}/api/rpc/command/${encodeURIComponent(name)}`);
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 10_000);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Token ${token}`,
        Accept: 'application/json',
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: method === 'POST' ? JSON.stringify(options.body || {}) : undefined,
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = (await response.text()).slice(0, 1000);
      throw new Error(`Penpot RPC ${name} failed (${response.status}): ${text}`);
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function penpotHealthCheck() {
  const started = Date.now();
  try {
    const profile = await penpotRpc<Record<string, unknown>>('get-profile', { method: 'GET' });
    return { ok: true, latencyMs: Date.now() - started, profileId: profile?.id || null };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : 'Penpot health check failed' };
  }
}

export async function createPenpotProject(input: { teamId: string; name: string }) {
  return penpotRpc<Record<string, unknown>>('create-project', { body: { 'team-id': input.teamId, name: input.name } });
}

export async function createPenpotFile(input: { projectId: string; name: string }) {
  return penpotRpc<Record<string, unknown>>('create-file', { body: { 'project-id': input.projectId, name: input.name } });
}
