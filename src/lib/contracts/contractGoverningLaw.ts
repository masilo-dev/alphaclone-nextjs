import { extractContractLegalFields } from '@/lib/contracts/extractContractLegalFields';

/**
 * Phrases the contract templates emit when the owner left the jurisdiction
 * blank. They read like a value but bind nothing, so the pre-send legal check
 * must treat them as missing rather than letting the contract go out.
 */
const PLACEHOLDER_LAW_PATTERN =
  /applicable jurisdiction|applicable law|agreed (?:upon )?by the parties|parties'? agreed jurisdiction|to be determined|\btbd\b|undefined|\[\s*[^\]]*\s*\]/i;

export function isPlaceholderGoverningLaw(value: string | null | undefined): boolean {
  const text = String(value || '').trim();
  return !text || PLACEHOLDER_LAW_PATTERN.test(text);
}

function clean(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return text && !isPlaceholderGoverningLaw(text) ? text.slice(0, 200) : null;
}

export interface ResolvedGoverningLaw {
  governingLaw: string | null;
  jurisdiction: string | null;
  /** Where the values came from — used to decide whether to persist them. */
  source: 'row' | 'provided' | 'content' | 'none';
}

/**
 * Resolve the governing law + jurisdiction for a contract, in priority order:
 * 1. values already stored on the contract row,
 * 2. values explicitly provided by the owner (create form / send modal),
 * 3. values extracted from the contract text itself (older contracts saved
 *    before the columns were written).
 * Placeholder phrases never count as a value.
 */
export function resolveContractGoverningLaw(input: {
  row?: { governing_law?: unknown; jurisdiction?: unknown } | null;
  provided?: { governingLaw?: unknown; jurisdiction?: unknown } | null;
  content?: string | null;
}): ResolvedGoverningLaw {
  const rowLaw = clean(input.row?.governing_law);
  const rowJurisdiction = clean(input.row?.jurisdiction);
  if (rowLaw || rowJurisdiction) {
    return { governingLaw: rowLaw ?? rowJurisdiction, jurisdiction: rowJurisdiction ?? rowLaw, source: 'row' };
  }

  const providedLaw = clean(input.provided?.governingLaw);
  const providedJurisdiction = clean(input.provided?.jurisdiction);
  if (providedLaw || providedJurisdiction) {
    return {
      governingLaw: providedLaw ?? providedJurisdiction,
      jurisdiction: providedJurisdiction ?? providedLaw,
      source: 'provided',
    };
  }

  if (input.content) {
    const extracted = extractContractLegalFields(input.content);
    const law = clean(extracted.governing_law);
    const jurisdiction = clean(extracted.jurisdiction);
    if (law || jurisdiction) {
      return { governingLaw: law ?? jurisdiction, jurisdiction: jurisdiction ?? law, source: 'content' };
    }
  }

  return { governingLaw: null, jurisdiction: null, source: 'none' };
}
