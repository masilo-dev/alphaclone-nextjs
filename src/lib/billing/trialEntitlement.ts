/**
 * Authoritative trial status and entitlement resolver (Single Source of Truth).
 * Prevents contradictory signals (e.g. "Trial expired" toast appearing alongside "Premium trial active").
 */

export interface TrialEntitlement {
  status: 'paid' | 'active' | 'expired' | 'inactive';
  isTrial: boolean;
  isExpired: boolean;
  daysRemaining: number;
  trialEndsAt: Date | null;
  statusLabel: string;
  description: string;
}

export function getTrialEntitlement(tenant: {
  subscription_status?: string | null;
  trial_ends_at?: string | Date | null;
  trial_end?: string | Date | null;
  trial_start?: string | Date | null;
  subscription_plan?: string | null;
  created_at?: string | Date | null;
} | null | undefined): TrialEntitlement {
  if (!tenant) {
    return {
      status: 'inactive',
      isTrial: false,
      isExpired: false,
      daysRemaining: 0,
      trialEndsAt: null,
      statusLabel: 'Inactive',
      description: 'No active workspace detected.',
    };
  }

  const rawStatus = (tenant.subscription_status || '').toLowerCase().trim();
  const isPaid = rawStatus === 'active';

  if (isPaid) {
    return {
      status: 'paid',
      isTrial: false,
      isExpired: false,
      daysRemaining: 0,
      trialEndsAt: null,
      statusLabel: 'Active',
      description: 'Subscription active.',
    };
  }

  const isTrial = rawStatus === 'trial' || rawStatus === 'trialing' || (!rawStatus && Boolean(tenant.created_at));

  // Determine trial end date
  let trialEndsAt: Date | null = null;
  if (tenant.trial_ends_at) {
    trialEndsAt = new Date(tenant.trial_ends_at);
  } else if (tenant.trial_end) {
    trialEndsAt = new Date(tenant.trial_end);
  } else if (tenant.trial_start) {
    trialEndsAt = new Date(new Date(tenant.trial_start).getTime() + 45 * 24 * 60 * 60 * 1000);
  } else if (tenant.created_at && isTrial) {
    trialEndsAt = new Date(new Date(tenant.created_at).getTime() + 45 * 24 * 60 * 60 * 1000);
  }

  const now = new Date();
  const isExpired = isTrial && (!trialEndsAt || trialEndsAt.getTime() <= now.getTime());
  const msRemaining = trialEndsAt ? trialEndsAt.getTime() - now.getTime() : 0;
  const daysRemaining = isTrial && !isExpired ? Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24))) : 0;

  if (isTrial && isExpired) {
    return {
      status: 'expired',
      isTrial: true,
      isExpired: true,
      daysRemaining: 0,
      trialEndsAt,
      statusLabel: 'Trial Expired',
      description: 'Your free trial has expired. Upgrade your workspace to continue executing business workflows.',
    };
  }

  if (isTrial) {
    return {
      status: 'active',
      isTrial: true,
      isExpired: false,
      daysRemaining,
      trialEndsAt,
      statusLabel: 'Trial Active',
      description: `Trial active · ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining · no credit card charged until ${trialEndsAt?.toLocaleDateString() || 'trial end'}.`,
    };
  }

  return {
    status: 'inactive',
    isTrial: false,
    isExpired: false,
    daysRemaining: 0,
    trialEndsAt: null,
    statusLabel: tenant.subscription_status || 'Inactive',
    description: 'Subscription inactive.',
  };
}
