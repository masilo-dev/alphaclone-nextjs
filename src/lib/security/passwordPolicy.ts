import { createHash } from 'node:crypto';

/**
 * Have I Been Pwned — k-anonymity password check (range API).
 * Never sends the full password; only the first 5 chars of SHA-1.
 */
export async function isPasswordCompromised(password: string): Promise<boolean> {
  const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: {
      'Add-Padding': 'true',
      'User-Agent': 'Alphaclone-Systems-Compliance',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    // Fail open on HIBP outage so signup is not blocked; log for ops.
    console.warn('[hibp] range API failed:', res.status);
    return false;
  }

  const body = await res.text();
  return body.split('\n').some((line) => {
    const [hashSuffix, count] = line.trim().split(':');
    return hashSuffix === suffix && Number(count) > 0;
  });
}

export type PasswordPolicyResult = { ok: true } | { ok: false; error: string };

/** ISO/NIST-aligned password policy: 12+ chars, mixed case, digit, special. */
export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  if (password.length < 12) {
    return { ok: false, error: 'Password must be at least 12 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, error: 'Password must contain at least one number' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, error: 'Password must contain at least one special character' };
  }
  return { ok: true };
}

export async function assertPasswordAllowed(password: string): Promise<PasswordPolicyResult> {
  const policy = validatePasswordPolicy(password);
  if (!policy.ok) return policy;
  try {
    if (await isPasswordCompromised(password)) {
      return {
        ok: false,
        error: 'This password appears in known data breaches. Choose a different password.',
      };
    }
  } catch (err) {
    console.warn('[hibp] check failed:', err);
  }
  return { ok: true };
}
