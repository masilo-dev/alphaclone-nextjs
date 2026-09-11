import { humanEventLabel, notificationGroupKey } from '@/lib/events/businessEventTaxonomy';

export type GroupableNotification = {
  id: string;
  title: string;
  message?: string | null;
  type?: string;
  created_at: string;
  read?: boolean;
  link?: string | null;
  action_url?: string | null;
  metadata?: Record<string, unknown> | null;
  event_type?: string | null;
  severity?: string | null;
};

export type NotificationGroup = {
  key: string;
  title: string;
  message: string;
  count: number;
  unreadCount: number;
  latestAt: string;
  link?: string;
  ids: string[];
  severity?: string;
  items: GroupableNotification[];
};

function eventTypeOf(n: GroupableNotification): string {
  return String(n.event_type || n.metadata?.event_type || n.type || 'system');
}

function hourBucket(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return d.toISOString().slice(0, 13);
}

function groupedTitle(eventType: string, count: number, sample: GroupableNotification): string {
  if (eventType === 'lead.qualified' && count > 1) return `${count} leads were qualified`;
  if (eventType === 'lead.created' && count > 1) return `${count} new leads`;
  if (eventType.startsWith('campaign.') && count === 1) return sample.title;
  if (count === 1) return sample.title;
  return `${count} ${humanEventLabel(eventType).toLowerCase()} updates`;
}

/**
 * Collapse noisy bursts (same event class + hour) into one row.
 * Campaign completion stays a single summary even when counts are high.
 */
export function groupNotifications(notifications: GroupableNotification[]): NotificationGroup[] {
  const buckets = new Map<string, GroupableNotification[]>();
  for (const n of notifications) {
    const eventType = eventTypeOf(n);
    const group = notificationGroupKey(eventType);
    const key = `${group}|${hourBucket(n.created_at)}`;
    const list = buckets.get(key) || [];
    list.push(n);
    buckets.set(key, list);
  }

  const groups: NotificationGroup[] = [];
  for (const [key, items] of buckets) {
    const sorted = [...items].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const latest = sorted[0];
    const eventType = eventTypeOf(latest);
    const unreadCount = sorted.filter((n) => !n.read).length;
    groups.push({
      key,
      title: groupedTitle(eventType, sorted.length, latest),
      message: sorted.length === 1 ? String(latest.message || '') : `${sorted.length} related updates`,
      count: sorted.length,
      unreadCount,
      latestAt: latest.created_at,
      link: latest.link || latest.action_url || undefined,
      ids: sorted.map((n) => n.id),
      severity: latest.severity || undefined,
      items: sorted,
    });
  }

  return groups.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
}
