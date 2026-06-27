/**
 * Client-safe business event emitter.
 * Browser code must use this — emit-event.ts requires service role (server only).
 */
export async function requestBusinessEvent(
  tenantId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/automation/emit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, eventType, payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to emit event',
    };
  }
}
