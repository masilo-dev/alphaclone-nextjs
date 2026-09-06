/**
 * The contract owner's reusable signer profile: the "Service Provider (You)"
 * details, the default governing law, and the adopted signature image.
 *
 * Stored per user in `profiles.custom_fields.contract_signer_profile` so the
 * owner fills these in once and every new contract is pre-filled and can be
 * signed with one click instead of redrawing the signature each time.
 */

export const SIGNER_PROFILE_CUSTOM_FIELD = 'contract_signer_profile';

/** PNG data URL cap. A drawn signature is typically 10–60 KB; 400 KB leaves headroom. */
export const MAX_SIGNATURE_DATA_URL_LENGTH = 400_000;

export interface SavedSignature {
  /** Clean PNG data URL of the drawn signature — no date/name stamp baked in. */
  dataUrl: string;
  /** Legal full name typed when the signature was adopted. */
  fullName: string;
  savedAt: string;
}

export interface ContractSignerProfile {
  providerName: string;
  providerAddress: string;
  providerEmail: string;
  providerPhone: string;
  providerRegistration: string;
  jurisdiction: string;
  governingLaw: string;
  signature: SavedSignature | null;
  updatedAt: string | null;
}

export const EMPTY_SIGNER_PROFILE: ContractSignerProfile = {
  providerName: '',
  providerAddress: '',
  providerEmail: '',
  providerPhone: '',
  providerRegistration: '',
  jurisdiction: '',
  governingLaw: '',
  signature: null,
  updatedAt: null,
};

const TEXT_FIELDS = [
  'providerName',
  'providerAddress',
  'providerEmail',
  'providerPhone',
  'providerRegistration',
  'jurisdiction',
  'governingLaw',
] as const;

export type SignerProfileTextField = (typeof TEXT_FIELDS)[number];

export function isSignatureDataUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value) &&
    value.length > 'data:image/png;base64,'.length + 16 &&
    value.length <= MAX_SIGNATURE_DATA_URL_LENGTH
  );
}

function cleanText(value: unknown, max = 300): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Coerce whatever is stored in custom_fields into a well-formed profile. */
export function normalizeSignerProfile(raw: unknown): ContractSignerProfile {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const profile: ContractSignerProfile = { ...EMPTY_SIGNER_PROFILE };
  for (const field of TEXT_FIELDS) profile[field] = cleanText(source[field]);

  const sig = source.signature && typeof source.signature === 'object' ? (source.signature as Record<string, unknown>) : null;
  if (sig && isSignatureDataUrl(sig.dataUrl) && cleanText(sig.fullName, 200)) {
    profile.signature = {
      dataUrl: sig.dataUrl,
      fullName: cleanText(sig.fullName, 200),
      savedAt: cleanText(sig.savedAt, 40) || new Date(0).toISOString(),
    };
  }
  profile.updatedAt = cleanText(source.updatedAt, 40) || null;
  return profile;
}

export type SignerProfilePatch = Partial<Pick<ContractSignerProfile, SignerProfileTextField>> & {
  /** `null` clears the saved signature; omit to leave it untouched. */
  signature?: Pick<SavedSignature, 'dataUrl' | 'fullName'> | null;
};

/** Merge a partial update into an existing profile. Empty strings are kept (they clear a field). */
export function mergeSignerProfile(
  existing: ContractSignerProfile,
  patch: SignerProfilePatch,
  now: Date = new Date(),
): ContractSignerProfile {
  const next: ContractSignerProfile = { ...existing };
  for (const field of TEXT_FIELDS) {
    if (patch[field] !== undefined) next[field] = cleanText(patch[field]);
  }
  if (patch.signature === null) {
    next.signature = null;
  } else if (patch.signature) {
    if (!isSignatureDataUrl(patch.signature.dataUrl)) {
      throw new Error('Signature must be a PNG data URL under 400 KB');
    }
    const fullName = cleanText(patch.signature.fullName, 200);
    if (!fullName) throw new Error('Signature needs the signer\'s legal full name');
    next.signature = { dataUrl: patch.signature.dataUrl, fullName, savedAt: now.toISOString() };
  }
  next.updatedAt = now.toISOString();
  return next;
}

/**
 * Apply the saved profile to a fresh contract form: only fills fields the
 * user has not typed into yet, so it never overwrites in-progress edits.
 */
export function applySignerProfileDefaults<T extends Record<SignerProfileTextField, string>>(
  form: T,
  profile: ContractSignerProfile,
  options: { tenantFallbackName?: string } = {},
): T {
  const next = { ...form };
  for (const field of TEXT_FIELDS) {
    const saved = profile[field];
    if (!saved) continue;
    const current = form[field];
    // providerName defaults to the tenant name before the profile loads;
    // a saved legal name should win over that auto-generated placeholder.
    const isPlaceholder =
      field === 'providerName' && Boolean(options.tenantFallbackName) && current === options.tenantFallbackName;
    if (!current.trim() || isPlaceholder) next[field] = saved;
  }
  return next;
}
