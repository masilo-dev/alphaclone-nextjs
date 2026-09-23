/**
 * Outbound Email Verification Abstraction
 * Provider-independent email verification with DB caching.
 * Statuses: valid | invalid | risky | catch_all | unknown
 *
 * Current providers:
 *  - dns_mx: Built-in DNS/MX check (no external API needed)
 *  - manual: Human override
 *  - external: Future — ZeroBounce, NeverBounce, Reoon etc.
 */

import { resolveMx, resolveTxt } from 'dns/promises';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type VerificationStatus = 'valid' | 'invalid' | 'risky' | 'catch_all' | 'unknown';

export interface VerificationResult {
  email: string;
  status: VerificationStatus;
  provider: string;
  mx_check: boolean;
  disposable_check: boolean;
  role_based_check: boolean;
  metadata: Record<string, unknown>;
  verified_at: string;
}

// Known disposable email domains (representative subset — not exhaustive)
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'throwaway.email', 'tempmail.com',
  'temp-mail.org', 'fakeinbox.com', 'yopmail.com', 'sharklasers.com',
  'guerrillamailblock.com', 'grr.la', 'guerrillamail.info', 'spam4.me',
  '10minutemail.com', 'trashmail.com', 'maildrop.cc', 'dispostable.com',
]);

// Role-based local parts that are not decision-maker inboxes
const ROLE_BASED_LOCALS = new Set([
  'admin', 'administrator', 'postmaster', 'webmaster', 'hostmaster',
  'abuse', 'noc', 'security', 'info', 'support', 'help', 'contact',
  'sales', 'billing', 'accounts', 'office', 'mail', 'email', 'hello',
  'no-reply', 'noreply', 'donotreply', 'notifications', 'newsletter',
]);

export async function verifyEmail(
  tenantId: string,
  email: string,
  options: {
    provider?: 'dns_mx' | 'manual';
    forceRefresh?: boolean;
    manualStatus?: VerificationStatus;
  } = {}
): Promise<VerificationResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes('@') || normalizedEmail.length < 5) {
    return buildResult(normalizedEmail, 'invalid', 'dns_mx', false, false, false, {
      error: 'malformed_email',
    });
  }

  const admin = createSupabaseAdminClient();

  // Return cached result unless forced refresh or expired
  if (!options.forceRefresh) {
    const { data: cached } = await admin
      .from('outbound_email_verifications')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('normalized_email', normalizedEmail)
      .maybeSingle();

    if (cached) {
      const expiry = cached.expires_at ? new Date(cached.expires_at) : null;
      if (!expiry || expiry > new Date()) {
        return buildResult(
          normalizedEmail,
          cached.verification_status as VerificationStatus,
          cached.verification_provider || 'cached',
          cached.mx_check ?? false,
          cached.disposable_check ?? false,
          cached.role_based_check ?? false,
          cached.verification_metadata || {}
        );
      }
    }
  }

  // Manual override
  if (options.provider === 'manual' && options.manualStatus) {
    const result = buildResult(normalizedEmail, options.manualStatus, 'manual', true, false, false, {
      manually_set: true,
    });
    await persistVerification(admin, tenantId, normalizedEmail, result, null);
    return result;
  }

  // DNS/MX-based verification (built-in, no external API key required)
  const result = await runDnsMxCheck(normalizedEmail);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day cache
  await persistVerification(admin, tenantId, normalizedEmail, result, expiresAt);
  return result;
}

async function runDnsMxCheck(normalizedEmail: string): Promise<VerificationResult> {
  const [local, domain] = normalizedEmail.split('@');
  const metadata: Record<string, unknown> = { domain };

  // Disposable domain check
  const isDisposable = DISPOSABLE_DOMAINS.has(domain);
  if (isDisposable) {
    return buildResult(normalizedEmail, 'invalid', 'dns_mx', false, true, false, {
      ...metadata,
      reason: 'disposable_domain',
    });
  }

  // Role-based check
  const isRoleBased = ROLE_BASED_LOCALS.has(local.toLowerCase());

  // MX record check
  let hasMx = false;
  let mxRecords: string[] = [];
  try {
    const records = await resolveMx(domain);
    hasMx = records.length > 0;
    mxRecords = records.map((r) => r.exchange).slice(0, 3);
    metadata.mx_records = mxRecords;
  } catch {
    hasMx = false;
    metadata.mx_error = 'no_mx_records';
  }

  if (!hasMx) {
    return buildResult(normalizedEmail, 'invalid', 'dns_mx', false, isDisposable, isRoleBased, {
      ...metadata,
      reason: 'no_mx_records',
    });
  }

  // Catch-all detection heuristic: common catch-all providers
  const catchAllIndicators = ['catch-all', 'wildcard'];
  const mxStr = mxRecords.join(' ').toLowerCase();
  const likelyCatchAll = catchAllIndicators.some((c) => mxStr.includes(c));

  // Determine status
  let status: VerificationStatus;
  if (isRoleBased || likelyCatchAll) {
    status = isRoleBased ? 'risky' : 'catch_all';
  } else {
    // MX exists and not obviously problematic → valid (DNS-level only)
    status = 'valid';
  }

  return buildResult(normalizedEmail, status, 'dns_mx', hasMx, isDisposable, isRoleBased, metadata);
}

function buildResult(
  email: string,
  status: VerificationStatus,
  provider: string,
  mxCheck: boolean,
  disposableCheck: boolean,
  roleBasedCheck: boolean,
  metadata: Record<string, unknown>
): VerificationResult {
  return {
    email,
    status,
    provider,
    mx_check: mxCheck,
    disposable_check: disposableCheck,
    role_based_check: roleBasedCheck,
    metadata,
    verified_at: new Date().toISOString(),
  };
}

async function persistVerification(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  normalizedEmail: string,
  result: VerificationResult,
  expiresAt: Date | null
): Promise<void> {
  await admin.from('outbound_email_verifications').upsert(
    {
      tenant_id: tenantId,
      email: normalizedEmail,
      normalized_email: normalizedEmail,
      verification_status: result.status,
      verification_provider: result.provider,
      verified_at: result.verified_at,
      expires_at: expiresAt?.toISOString() || null,
      mx_check: result.mx_check,
      disposable_check: result.disposable_check,
      role_based_check: result.role_based_check,
      verification_metadata: result.metadata,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,normalized_email' }
  );
}

/**
 * Batch verify a list of emails. Safe to call with up to ~50 at a time.
 * Returns results in the same order as input.
 */
export async function batchVerifyEmails(
  tenantId: string,
  emails: string[]
): Promise<VerificationResult[]> {
  const results = await Promise.allSettled(
    emails.map((e) => verifyEmail(tenantId, e))
  );
  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : buildResult(emails[i], 'unknown', 'dns_mx', false, false, false, {
          error: r.reason?.message || 'unknown',
        })
  );
}

/**
 * Policy: should we send to this verification status?
 * Tenant policy can be passed in — defaults to safe behavior.
 */
export function canSendToVerificationStatus(
  status: VerificationStatus,
  policy: {
    allow_risky?: boolean;
    allow_catch_all?: boolean;
    allow_unknown?: boolean;
  } = {}
): { allowed: boolean; reason: string } {
  switch (status) {
    case 'valid':
      return { allowed: true, reason: 'verified_valid' };
    case 'invalid':
      return { allowed: false, reason: 'EMAIL_NOT_VERIFIED_INVALID' };
    case 'risky':
      return policy.allow_risky
        ? { allowed: true, reason: 'risky_allowed_by_policy' }
        : { allowed: false, reason: 'EMAIL_RISKY' };
    case 'catch_all':
      return policy.allow_catch_all
        ? { allowed: true, reason: 'catch_all_allowed_by_policy' }
        : { allowed: false, reason: 'EMAIL_CATCH_ALL' };
    case 'unknown':
      return policy.allow_unknown
        ? { allowed: true, reason: 'unknown_allowed_by_policy' }
        : { allowed: false, reason: 'EMAIL_NOT_VERIFIED' };
    default:
      return { allowed: false, reason: 'EMAIL_UNKNOWN_STATUS' };
  }
}
