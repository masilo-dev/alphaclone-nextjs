/**
 * PostgreSQL notification_type enum values (notifications.type column).
 * Business event types (dot notation) are mapped to these categories at insert time.
 */
export const NOTIFICATION_TYPES = [
  'contact',
  'project',
  'message',
  'system',
  'invoice',
  'security',
  'contract',
  'mcp.action_failed',
  'mcp.action_completed',
  'social.post_published',
  'social.post_failed',
  'email.sent',
  'email.failed',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const EVENT_PREFIX_TO_NOTIFICATION_TYPE: Array<[RegExp, NotificationType]> = [
  [/^security\./, 'security'],
  [/^mcp\./, 'system'],
  [/^social\./, 'system'],
  [/^lead\./, 'contact'],
  [/^email\./, 'message'],
  [/^invoice\.|^payment\./, 'invoice'],
  [/^contract\./, 'contract'],
  [/^meeting\.|^campaign\./, 'project'],
  [/^digest\.|^retention\./, 'system'],
  [/^auth\./, 'security'],
  [/^operational_alert_/, 'system'],
];

/**
 * Maps a business event type (e.g. mcp.action_failed) to a valid notification_type enum value.
 * The original event type should be preserved in notification metadata.event_type.
 */
export function mapEventTypeToNotificationType(eventType: string): NotificationType {
  const normalized = eventType.trim().toLowerCase();
  if ((NOTIFICATION_TYPES as readonly string[]).includes(normalized)) {
    return normalized as NotificationType;
  }
  for (const [pattern, notificationType] of EVENT_PREFIX_TO_NOTIFICATION_TYPE) {
    if (pattern.test(normalized)) return notificationType;
  }
  return 'system';
}

export function isKnownNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}
