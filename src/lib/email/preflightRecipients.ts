import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { isEmailSuppressed } from '@/lib/email/suppression';

export type PreflightRecipientInput = {
  email: string;
  id?: string;
  entityType?: string;
  /** When true, skip marketing consent check (transactional sends) */
  skipConsentCheck?: boolean;
  marketingOptIn?: boolean;
};

export type PreflightExcludedRecipient = {
  email: string;
  id?: string;
  entityType?: string;
  reason: PreflightExclusionReason;
};

export type PreflightExclusionReason =
  | 'duplicate'
  | 'invalid_email'
  | 'previously_unsubscribed'
  | 'hard_suppressed'
  | 'complaint_suppressed'
  | 'marketing_consent_not_recorded'
  | 'missing_email';

export type PreflightResult = {
  requested: number;
  eligible: number;
  duplicates_removed: number;
  invalid: number;
  previously_unsubscribed: number;
  hard_suppressed: number;
  complaint_suppressed: number;
  consent_blocked: number;
  eligibleRecipients: Array<{ email: string; id?: string; entityType?: string }>;
  excluded: PreflightExcludedRecipient[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

async function getSuppressionReason(
  tenantId: string,
  email: string,
): Promise<PreflightExclusionReason | null> {
  const admin = createSupabaseAdminClient();
  const normalized = normalizeEmail(email);

  const { data: suppression } = await admin
    .from('email_suppressions')
    .select('reason')
    .eq('tenant_id', tenantId)
    .eq('email', normalized)
    .maybeSingle();

  if (suppression?.reason === 'unsubscribe') return 'previously_unsubscribed';
  if (suppression?.reason === 'bounce') return 'hard_suppressed';
  if (suppression?.reason === 'spam_report') return 'complaint_suppressed';
  if (suppression?.reason === 'manual') return 'hard_suppressed';

  const suppressed = await isEmailSuppressed(tenantId, normalized);
  if (suppressed) return 'hard_suppressed';

  return null;
}

/**
 * Server-side outreach preflight — dedupe, validate, suppression, consent.
 * CSV re-import cannot reset suppression; lookup is always from suppression tables.
 */
export async function preflightOutreachRecipients(
  tenantId: string,
  recipients: PreflightRecipientInput[],
  options?: { requireMarketingConsent?: boolean },
): Promise<PreflightResult> {
  const requireConsent = options?.requireMarketingConsent !== false;
  const seenEmails = new Set<string>();
  const eligibleRecipients: PreflightResult['eligibleRecipients'] = [];
  const excluded: PreflightExcludedRecipient[] = [];

  let duplicatesRemoved = 0;
  let invalid = 0;
  let previouslyUnsubscribed = 0;
  let hardSuppressed = 0;
  let complaintSuppressed = 0;
  let consentBlocked = 0;

  for (const recipient of recipients) {
    const email = normalizeEmail(recipient.email);
    const base = { email, id: recipient.id, entityType: recipient.entityType };

    if (!email) {
      excluded.push({ ...base, email: recipient.email, reason: 'missing_email' });
      invalid += 1;
      continue;
    }

    if (!EMAIL_RE.test(email)) {
      excluded.push({ ...base, reason: 'invalid_email' });
      invalid += 1;
      continue;
    }

    if (seenEmails.has(email)) {
      excluded.push({ ...base, reason: 'duplicate' });
      duplicatesRemoved += 1;
      continue;
    }
    seenEmails.add(email);

    const suppressionReason = await getSuppressionReason(tenantId, email);
    if (suppressionReason) {
      excluded.push({ ...base, reason: suppressionReason });
      switch (suppressionReason) {
        case 'previously_unsubscribed': previouslyUnsubscribed += 1; break;
        case 'complaint_suppressed': complaintSuppressed += 1; break;
        default: hardSuppressed += 1; break;
      }
      continue;
    }

    if (requireConsent && !recipient.skipConsentCheck && recipient.marketingOptIn !== true) {
      excluded.push({ ...base, reason: 'marketing_consent_not_recorded' });
      consentBlocked += 1;
      continue;
    }

    eligibleRecipients.push(base);
  }

  return {
    requested: recipients.length,
    eligible: eligibleRecipients.length,
    duplicates_removed: duplicatesRemoved,
    invalid,
    previously_unsubscribed: previouslyUnsubscribed,
    hard_suppressed: hardSuppressed,
    complaint_suppressed: complaintSuppressed,
    consent_blocked: consentBlocked,
    eligibleRecipients,
    excluded,
  };
}

/** Acceptance-test helper: summarize preflight in human-readable stats */
export function formatPreflightSummary(result: PreflightResult): string {
  return [
    `Requested: ${result.requested}`,
    `Previously unsubscribed: ${result.previously_unsubscribed}`,
    `Hard suppressed: ${result.hard_suppressed + result.complaint_suppressed}`,
    `Duplicates removed: ${result.duplicates_removed}`,
    `Invalid: ${result.invalid}`,
    `Eligible: ${result.eligible}`,
  ].join('\n');
}
