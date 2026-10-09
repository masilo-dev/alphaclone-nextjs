import {
  normalizePhoneNumber,
  normalizePhoneForStorage as canonicalNormalizePhoneForStorage,
  hasCountryCode as canonicalHasCountryCode,
  type PhoneContext,
  type PhoneNormalizationResult,
} from './phoneNormalizer';

export {
  normalizePhoneNumber,
  canonicalNormalizePhoneForStorage,
  canonicalHasCountryCode,
  type PhoneContext,
  type PhoneNormalizationResult,
};

export function normalizePhoneForStorage(
  phone: unknown,
  defaultCountryCode?: string | null,
  context?: PhoneContext | null
): string | null {
  return canonicalNormalizePhoneForStorage(phone, defaultCountryCode, context);
}

export function hasCountryCode(phone: unknown): boolean {
  return canonicalHasCountryCode(phone);
}
