/** UTC midnight countdown for daily quota reset display. */
export function formatQuotaResetLabel(now = new Date()): string {
  const utcNow = Date.now();
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  const hours = Math.floor((nextMidnight - utcNow) / 3_600_000);
  const minutes = Math.floor(((nextMidnight - utcNow) % 3_600_000) / 60_000);
  if (hours <= 0 && minutes <= 0) return 'Resets at midnight UTC';
  return `Resets in ${hours}h ${minutes}m (midnight UTC)`;
}

export function formatPlanDisplayName(plan: string): string {
  const p = plan.toLowerCase();
  if (p === 'starter' || p === 'pro') return 'Pro';
  if (p === 'enterprise' || p === 'premium' || p === 'custom') return 'Premium';
  if (p === 'free') return 'Free';
  return plan.toUpperCase();
}
