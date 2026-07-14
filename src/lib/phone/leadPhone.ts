export function normalizePhoneForStorage(phone: unknown, defaultCountryCode = '1'): string | null {
  if (phone == null) return null;
  const raw = String(phone).trim();
  if (!raw) return null;
  const plusPrefixed = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (plusPrefixed && /^[1-9]\d{6,14}$/.test(digits)) return `+${digits}`;
  if (digits.startsWith('00') && /^[1-9]\d{6,14}$/.test(digits.slice(2))) return `+${digits.slice(2)}`;
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith(defaultCountryCode)) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return raw;
}

export function hasCountryCode(phone: unknown): boolean {
  if (phone == null) return false;
  const normalized = String(phone).trim();
  return /^\+[1-9]\d{6,14}$/.test(normalized);
}
