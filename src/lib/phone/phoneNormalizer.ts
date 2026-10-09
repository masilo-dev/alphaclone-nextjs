import { parsePhoneNumber, type CountryCode } from 'libphonenumber-js/core';
import metadata from 'libphonenumber-js/metadata.min.json';

export interface PhoneContext {
  country?: string | null;
  countryCode?: string | null;
  location?: string | null;
  website?: string | null;
  source?: string | null;
  tenantCountry?: string | null;
}

export interface PhoneNormalizationResult {
  phone: string | null;
  e164: string | null;
  national: string | null;
  country: string | null;
  isValid: boolean;
  raw: string | null;
  inferredCountry: string | null;
}

const COUNTRY_NAME_MAP: Record<string, CountryCode> = {
  zimbabwe: 'ZW',
  harare: 'ZW',
  bulawayo: 'ZW',
  mutare: 'ZW',
  gweru: 'ZW',
  kwekwe: 'ZW',
  masvingo: 'ZW',
  chitungwiza: 'ZW',
  'south africa': 'ZA',
  johannesburg: 'ZA',
  'cape town': 'ZA',
  durban: 'ZA',
  pretoria: 'ZA',
  sandton: 'ZA',
  soweto: 'ZA',
  boksburg: 'ZA',
  queensburgh: 'ZA',
  mdantsane: 'ZA',
  'port alfred': 'ZA',
  "gordon's bay": 'ZA',
  gordonsbay: 'ZA',
  kenya: 'KE',
  nairobi: 'KE',
  mombasa: 'KE',
  nigeria: 'NG',
  lagos: 'NG',
  abuja: 'NG',
  ghana: 'GH',
  accra: 'GH',
  rwanda: 'RW',
  kigali: 'RW',
  zambia: 'ZM',
  lusaka: 'ZM',
  ndola: 'ZM',
  kitwe: 'ZM',
  uganda: 'UG',
  kampala: 'UG',
  botswana: 'BW',
  gaborone: 'BW',
  namibia: 'NA',
  windhoek: 'NA',
  'walvis bay': 'NA',
  walvisbay: 'NA',
  ethiopia: 'ET',
  'addis ababa': 'ET',
  addisababa: 'ET',
  ireland: 'IE',
  dublin: 'IE',
  cork: 'IE',
  galway: 'IE',
  limerick: 'IE',
  waterford: 'IE',
  leinster: 'IE',
  navan: 'IE',
  cavan: 'IE',
  macroom: 'IE',
  kilkenny: 'IE',
  monasterevin: 'IE',
  ringsend: 'IE',
  ballinrobe: 'IE',
  'carrick-on-shannon': 'IE',
  malaysia: 'MY',
  kuching: 'MY',
  sarawak: 'MY',
  'kuala lumpur': 'MY',
  'united kingdom': 'GB',
  uk: 'GB',
  london: 'GB',
  england: 'GB',
  scotland: 'GB',
  'united states': 'US',
  usa: 'US',
  us: 'US',
  canada: 'CA',
  australia: 'AU',
  germany: 'DE',
  france: 'FR',
  india: 'IN',
};

const TLD_COUNTRY_MAP: Record<string, CountryCode> = {
  '.co.zw': 'ZW',
  '.org.zw': 'ZW',
  '.ac.zw': 'ZW',
  '.zw': 'ZW',
  '.co.za': 'ZA',
  '.za': 'ZA',
  '.co.ke': 'KE',
  '.ke': 'KE',
  '.com.ng': 'NG',
  '.ng': 'NG',
  '.com.gh': 'GH',
  '.co.uk': 'GB',
  '.uk': 'GB',
  '.ca': 'CA',
  '.au': 'AU',
  '.de': 'DE',
  '.fr': 'FR',
};

/**
 * Infer ISO country code from explicit context, location strings, or source URLs.
 */
export function inferCountryCode(context?: PhoneContext | null): CountryCode | null {
  if (!context) return null;

  // 1. Explicit country or countryCode
  const explicit = String(context.countryCode || context.country || '').trim().toUpperCase();
  if (explicit && /^[A-Z]{2}$/.test(explicit)) {
    return explicit as CountryCode;
  }
  if (explicit && COUNTRY_NAME_MAP[explicit.toLowerCase()]) {
    return COUNTRY_NAME_MAP[explicit.toLowerCase()];
  }

  // 2. Location string matching
  if (context.location) {
    const locLower = String(context.location).toLowerCase();
    for (const [key, code] of Object.entries(COUNTRY_NAME_MAP)) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(locLower)) {
        return code;
      }
    }
  }

  // 3. Source or website domain inspection
  const sourceStr = `${context.website || ''} ${context.source || ''}`.toLowerCase();
  if (sourceStr) {
    if (sourceStr.includes('/zw/') || sourceStr.includes('africabizinfo.com/zw') || sourceStr.includes('africa2trust.com')) {
      return 'ZW';
    }
    for (const [tld, code] of Object.entries(TLD_COUNTRY_MAP)) {
      if (sourceStr.includes(tld)) {
        return code;
      }
    }
  }

  // 4. Tenant fallback country
  if (context.tenantCountry) {
    const tenantUpper = String(context.tenantCountry).trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(tenantUpper)) {
      return tenantUpper as CountryCode;
    }
    if (COUNTRY_NAME_MAP[tenantUpper.toLowerCase()]) {
      return COUNTRY_NAME_MAP[tenantUpper.toLowerCase()];
    }
  }

  return null;
}

/**
 * Safe parse helper wrapping libphonenumber-js/core.
 */
function safeParsePhoneNumber(candidate: string, country?: CountryCode | null) {
  try {
    return parsePhoneNumber(candidate, { defaultCountry: country || undefined }, metadata);
  } catch {
    return null;
  }
}

/**
 * Centralized, country-aware phone normalizer.
 *
 * Guarantees:
 * 1. Zimbabwean numbers (+263) are never converted to US +1.
 * 2. Unverified international numbers never silently default to US +1.
 * 3. Raw input is always preserved.
 * 4. Corrupted +10... and +0... patterns from prior naive normalization are recovered when context permits.
 */
export function normalizePhoneNumber(
  phone: unknown,
  context?: PhoneContext | null
): PhoneNormalizationResult {
  if (phone == null) {
    return { phone: null, e164: null, national: null, country: null, isValid: false, raw: null, inferredCountry: null };
  }

  const raw = String(phone).trim();
  if (!raw) {
    return { phone: null, e164: null, national: null, country: null, isValid: false, raw: null, inferredCountry: null };
  }

  const inferred = inferCountryCode(context);
  // If string contains multiple phone numbers separated by / or , take the first for canonical normalization
  let candidate = raw.split(/[\/,]|\bor\b/i)[0].trim();

  // 1. Recover numbers corrupted with invalid `+10...` (NANP cannot start with 0 after +1)
  if (candidate.startsWith('+10')) {
    const restored = '0' + candidate.slice(3);
    const targetCountry = inferred || 'ZW';
    let parsedRestored = safeParsePhoneNumber(restored, targetCountry);
    if (!parsedRestored?.isValid() && !inferred) {
      const candidates: CountryCode[] = ['ZW', 'ZA', 'ZM', 'KE', 'NG', 'GH', 'IE', 'RW', 'NA', 'BW'];
      for (const cc of candidates) {
        const testParse = safeParsePhoneNumber(restored, cc);
        if (testParse?.isValid()) {
          parsedRestored = testParse;
          break;
        }
      }
    }
    if (parsedRestored?.isValid()) {
      candidate = restored;
    }
  }

  // 2. Recover numbers corrupted with invalid `+0...`
  if (candidate.startsWith('+0')) {
    const unplused = candidate.slice(1);
    const targetCountry = inferred || 'ZW';
    let parsedUnplus = safeParsePhoneNumber(unplused, targetCountry);
    if (!parsedUnplus?.isValid() && !inferred) {
      const candidates: CountryCode[] = ['ZW', 'ZA', 'ZM', 'KE', 'NG', 'GH', 'IE', 'RW', 'NA', 'BW'];
      for (const cc of candidates) {
        const testParse = safeParsePhoneNumber(unplused, cc);
        if (testParse?.isValid()) {
          parsedUnplus = testParse;
          break;
        }
      }
    }
    if (parsedUnplus?.isValid()) {
      candidate = unplused;
    }
  }

  // 3. Handle international 00 exit code
  if (candidate.startsWith('00') && candidate.length > 4) {
    candidate = '+' + candidate.slice(2);
  }

  // 4. Parse with inferred country (or global dial code if + present)
  let parsed = safeParsePhoneNumber(candidate, inferred);

  // 5. Zimbabwe local format edge-case: 9 digits without leading 0 (e.g. 772713410)
  if ((!parsed || !parsed.isValid()) && inferred === 'ZW') {
    const digitsOnly = candidate.replace(/\D/g, '');
    if (/^[1-9]\d{8}$/.test(digitsOnly)) {
      parsed = safeParsePhoneNumber('0' + digitsOnly, 'ZW');
    }
  }

  if (parsed && parsed.isValid()) {
    const e164 = parsed.format('E.164');
    return {
      phone: e164,
      e164,
      national: parsed.formatNational(),
      country: parsed.country || null,
      isValid: true,
      raw,
      inferredCountry: inferred,
    };
  }

  // If not valid E.164, do NOT silently prepend +1!
  // Return preserved raw input and mark isValid: false.
  return {
    phone: raw,
    e164: null,
    national: null,
    country: null,
    isValid: false,
    raw,
    inferredCountry: inferred,
  };
}

/**
 * Backwards-compatible drop-in for normalizePhoneForStorage.
 * Replaces the legacy naive regex while preserving signature.
 */
export function normalizePhoneForStorage(
  phone: unknown,
  defaultCountryCode?: string | null,
  context?: PhoneContext | null
): string | null {
  if (phone == null) return null;
  const raw = String(phone).trim();
  if (!raw) return null;

  // Build unified context
  const mergedContext: PhoneContext = {
    ...(context || {}),
    countryCode: context?.countryCode || (defaultCountryCode && defaultCountryCode !== '1' ? defaultCountryCode : undefined),
  };

  const result = normalizePhoneNumber(phone, mergedContext);
  return result.e164 || result.phone;
}

export function hasCountryCode(phone: unknown): boolean {
  if (phone == null) return false;
  const normalized = String(phone).trim();
  return /^\+[1-9]\d{6,14}$/.test(normalized);
}
