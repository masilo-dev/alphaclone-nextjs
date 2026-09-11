export type DigestEventForAggregation = {
  id: string;
  event_type: string;
  event_category: string;
  entity_type: string | null;
  entity_id: string | null;
  source_action: string | null;
  severity: string;
  title: string;
  summary: string;
};

export function aggregateDigestEvents(events: DigestEventForAggregation[]) {
  const groups = new Map<string, { count: number; title: string; summary: string; severity: string }>();
  for (const event of events) {
    const key = [event.event_category, event.event_type, event.entity_type || '', event.source_action || ''].join('|');
    const current = groups.get(key);
    if (current) current.count += 1;
    else groups.set(key, { count: 1, title: event.title, summary: event.summary, severity: event.severity });
  }
  return [...groups.values()].sort((a, b) => {
    const rank: Record<string, number> = { critical: 4, error: 3, warning: 2, info: 1 };
    return (rank[b.severity] || 0) - (rank[a.severity] || 0) || b.count - a.count;
  });
}
