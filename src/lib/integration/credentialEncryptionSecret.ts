/** Ordered env vars for MCP/integration credential encryption (first valid wins). */
export const CREDENTIAL_ENCRYPTION_ENV_CANDIDATES = [
  'INTEGRATION_TOKEN_ENCRYPTION_SECRET',
  'ENCRYPTION_SECRET',
  'ZOHO_ENCRYPTION_SECRET',
  'TOKEN_ENCRYPTION_SECRET',
  'MCP_ENCRYPTION_KEY',
  'CREDENTIAL_ENCRYPTION_KEY',
] as const;

/** Matches `src/lib/encryption.ts` — secrets shorter than this cannot encrypt. */
export const MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH = 32;

export type CredentialEncryptionResolution = {
  secret: string;
  source: string;
};

function readEnvCandidate(name: string): string | undefined {
  return process.env[name]?.trim();
}

/**
 * Resolve the canonical MCP/integration encryption secret.
 * Skips candidates that are set but too short so a valid fallback (e.g. ZOHO) can be used.
 */
export function resolveCredentialEncryptionSecret(): CredentialEncryptionResolution | null {
  for (const name of CREDENTIAL_ENCRYPTION_ENV_CANDIDATES) {
    const raw = readEnvCandidate(name);
    if (raw && raw.length >= MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH) {
      return { secret: raw, source: name };
    }
  }
  return null;
}

/**
 * Every usable secret, canonical first, de-duplicated. Decryption should try
 * all of them: tokens written before a key was added/reordered (e.g. Aug 2026,
 * when ENCRYPTION_SECRET started winning over ZOHO_ENCRYPTION_SECRET) are
 * otherwise unreadable and every integration reports "reconnect required".
 */
export function resolveAllCredentialEncryptionSecrets(): CredentialEncryptionResolution[] {
  const seen = new Set<string>();
  const out: CredentialEncryptionResolution[] = [];
  for (const name of CREDENTIAL_ENCRYPTION_ENV_CANDIDATES) {
    const raw = readEnvCandidate(name);
    if (!raw || raw.length < MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH || seen.has(raw)) continue;
    seen.add(raw);
    out.push({ secret: raw, source: name });
  }
  return out;
}

export function requireCredentialEncryptionSecret(): CredentialEncryptionResolution {
  const resolved = resolveCredentialEncryptionSecret();
  if (!resolved) {
    throw new Error(
      `MCP credential encryption requires a secret of at least ${MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH} characters. ` +
        `Set one of: ${CREDENTIAL_ENCRYPTION_ENV_CANDIDATES.join(', ')}`
    );
  }
  return resolved;
}

export type CredentialEncryptionValidation =
  | { ok: true; source: string }
  | { ok: false; message: string; invalidVars: string[] };

/** Pre-flight check for OAuth token issuance — never log secret values. */
export function validateCredentialEncryptionForOAuth(): CredentialEncryptionValidation {
  const invalidVars: string[] = [];
  for (const name of CREDENTIAL_ENCRYPTION_ENV_CANDIDATES) {
    const raw = readEnvCandidate(name);
    if (raw && raw.length < MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH) {
      invalidVars.push(name);
    }
  }

  const resolved = resolveCredentialEncryptionSecret();
  if (resolved) {
    return { ok: true, source: resolved.source };
  }

  return {
    ok: false,
    invalidVars,
    message:
      invalidVars.length > 0
        ? `Credential encryption is misconfigured (${invalidVars.join(', ')} too short). ` +
          `Configure a valid ${MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH}+ character secret via ` +
          `${CREDENTIAL_ENCRYPTION_ENV_CANDIDATES.join(' or ')}.`
        : `Credential encryption secret is missing. Set ${CREDENTIAL_ENCRYPTION_ENV_CANDIDATES.join(' or ')} ` +
          `(${MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH}+ characters).`,
  };
}

/** Production startup validation messages (no secret values). */
export function describeCredentialEncryptionEnvErrors(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string[] {
  const errors: string[] = [];
  let hasValid = false;

  for (const name of CREDENTIAL_ENCRYPTION_ENV_CANDIDATES) {
    const raw = env[name]?.trim();
    if (!raw) continue;
    if (raw.length >= MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH) {
      hasValid = true;
    } else {
      errors.push(
        `${name} is set but must be at least ${MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH} characters for MCP credential encryption`,
      );
    }
  }

  if (!hasValid) {
    errors.push(
      `credential encryption secret is missing or invalid (${CREDENTIAL_ENCRYPTION_ENV_CANDIDATES.join(' or ')}, ${MIN_CREDENTIAL_ENCRYPTION_SECRET_LENGTH}+ chars)`,
    );
  }

  return errors;
}
