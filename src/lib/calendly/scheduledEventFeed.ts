/** Read the complete reconciliation window, including cancellations missed by webhooks. */
export async function fetchCalendlyScheduledEvents(accessToken: string, userUri: string, minStartTime: string, fetcher: typeof fetch = fetch): Promise<Array<Record<string, any>>> {
  const events: Array<Record<string, any>> = [];
  let next: string | null = `https://api.calendly.com/scheduled_events?${new URLSearchParams({ user: userUri, min_start_time: minStartTime, count: '100' })}`;
  const seen = new Set<string>();
  while (next) {
    const url = new URL(next);
    if (url.origin !== 'https://api.calendly.com' || url.pathname !== '/scheduled_events') throw new Error('Invalid Calendly pagination URL');
    if (seen.has(next) || seen.size >= 100) throw new Error('Calendly event sync is incomplete; pagination limit reached');
    seen.add(next);
    const response: Response = await fetcher(next, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Calendly event sync failed (${response.status})${response.status === 401 ? ': reconnect Calendly' : ''}`);
    const data: { collection?: Array<Record<string, any>>; pagination?: { next_page?: string } } = await response.json();
    if (!Array.isArray(data.collection)) throw new Error('Invalid Calendly event response');
    events.push(...data.collection);
    next = data.pagination?.next_page || null;
  }
  return events;
}
