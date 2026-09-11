import type { NotificationCategory } from '@/lib/events/businessEventTaxonomy';
import { NOTIFICATION_CATEGORIES, eventCategory, eventUrgency } from '@/lib/events/businessEventTaxonomy';

export type CategoryChannelPolicy = {
  in_app: boolean;
  email_owner: boolean;
  email_assignee: boolean;
  email_client: boolean;
  daily_digest: boolean;
  urgent_only: boolean;
  disabled: boolean;
};

export type TenantNotificationPolicy = Record<NotificationCategory, CategoryChannelPolicy>;

const QUIET_DEFAULT: CategoryChannelPolicy = {
  in_app: true,
  email_owner: false,
  email_assignee: false,
  email_client: false,
  daily_digest: true,
  urgent_only: true,
  disabled: false,
};

const ALERT_DEFAULT: CategoryChannelPolicy = {
  ...QUIET_DEFAULT,
  email_owner: true,
  urgent_only: false,
};

const EMAIL_OWNER_CATEGORIES = new Set<NotificationCategory>([
  'security',
  'system_health',
  'integrations',
  'invoices',
  'contracts',
  'bookings',
]);

export function defaultTenantNotificationPolicy(): TenantNotificationPolicy {
  const policy = {} as TenantNotificationPolicy;
  for (const category of NOTIFICATION_CATEGORIES) {
    policy[category] = EMAIL_OWNER_CATEGORIES.has(category) ? { ...ALERT_DEFAULT } : { ...QUIET_DEFAULT };
  }
  return policy;
}

export function mergeTenantNotificationPolicy(
  stored?: Partial<Record<string, Partial<CategoryChannelPolicy>>> | null,
): TenantNotificationPolicy {
  const base = defaultTenantNotificationPolicy();
  if (!stored || typeof stored !== 'object') return base;
  for (const category of NOTIFICATION_CATEGORIES) {
    const patch = stored[category];
    if (!patch || typeof patch !== 'object') continue;
    base[category] = { ...base[category], ...patch };
  }
  return base;
}

export type ChannelDecision = {
  drop: boolean;
  inApp: boolean;
  emailOwner: boolean;
  emailAssignee: boolean;
  emailClient: boolean;
  digest: boolean;
  category: NotificationCategory;
};

export function resolveNotificationChannels(params: {
  eventType: string;
  status?: string;
  policy?: TenantNotificationPolicy;
  /** Explicit business send (invoice sent, contract sent). Internal updates must stay false. */
  communicationIntent?: 'internal' | 'send';
}): ChannelDecision {
  const category = eventCategory(params.eventType);
  const policy = (params.policy || defaultTenantNotificationPolicy())[category];
  const urgency = eventUrgency(params.eventType, params.status);

  if (policy.disabled) {
    return { drop: true, inApp: false, emailOwner: false, emailAssignee: false, emailClient: false, digest: false, category };
  }

  const inApp = policy.in_app && urgency !== 'digest';
  const digest = policy.daily_digest && (urgency === 'digest' || !inApp);
  const emailEligible = urgency === 'immediate' || (!policy.urgent_only && urgency === 'in_app');
  const emailOwner = policy.email_owner && emailEligible;
  const emailAssignee = policy.email_assignee && emailEligible;
  const emailClient =
    policy.email_client &&
    params.communicationIntent === 'send' &&
    urgency !== 'digest';

  return {
    drop: !inApp && !emailOwner && !emailAssignee && !emailClient && !digest,
    inApp: inApp || emailOwner || emailAssignee,
    emailOwner,
    emailAssignee,
    emailClient,
    digest,
    category,
  };
}
