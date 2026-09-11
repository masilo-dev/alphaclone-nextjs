/**
 * Integration tiers for platform health scoring.
 * Optional integrations are reported but never reduce audit score or readiness %.
 */

export const CORE_INTEGRATIONS_FOR_HEALTH = [
  'supabase',
  'openai',
  'railway',
  'deepseek',
  'stripe',
  'zoho',
] as const;

/** Reported in integrations_status; missing does NOT penalize health score. */
export const OPTIONAL_INTEGRATIONS_FOR_HEALTH = [
  'gmail',
  'github',
  'calcom',
  'calendly',
  'google_calendar',
] as const;

export type CoreIntegrationKey = (typeof CORE_INTEGRATIONS_FOR_HEALTH)[number];
export type OptionalIntegrationKey = (typeof OPTIONAL_INTEGRATIONS_FOR_HEALTH)[number];

export function isOptionalIntegrationForHealth(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[.-]/g, '_');
  return OPTIONAL_INTEGRATIONS_FOR_HEALTH.some(
    (name) => name === normalized || name.replace(/_/g, '') === normalized.replace(/_/g, '')
  );
}

export function isCoreIntegrationForHealth(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[.-]/g, '_');
  return CORE_INTEGRATIONS_FOR_HEALTH.some((name) => name === normalized);
}

/** Booking is satisfied by Cal.com OR Calendly — neither is required alone. */
export function hasBookingIntegration(connectedTypes: Set<string>): boolean {
  return (
    connectedTypes.has('calcom') ||
    connectedTypes.has('cal.com') ||
    connectedTypes.has('calendly')
  );
}

export function normalizeIntegrationType(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[.-]/g, '_');
}
