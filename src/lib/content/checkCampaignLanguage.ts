/**
 * Campaign language quality check — delegates to Bonnie v2.0 constitution.
 * @see src/lib/bonnie/bonnieBannedLanguage.ts
 */

export {
  BONNIE_BANNED_LANGUAGE,
  campaignQualityCheck,
  checkCampaignLanguage,
  blocksBonnieSend,
} from '@/lib/bonnie/bonnieBannedLanguage';

/** @deprecated Use BONNIE_BANNED_LANGUAGE */
export const BANNED_PHRASES = [
  'leverage',
  'synergy',
  'utilize',
  'solution',
  'I hope this finds you',
  'I wanted to reach out',
  'touch base',
  'circle back',
  'moving forward',
  'going forward',
  'at the end of the day',
  'value-add',
  'pain points',
  'streamline',
  'scalable',
  'best-in-class',
  'cutting-edge',
] as const;

import { checkCampaignLanguage as runCampaignLanguageCheck } from '@/lib/bonnie/bonnieBannedLanguage';

export function withLanguageWarnings<T extends Record<string, unknown>>(
  payload: T,
  body: string
): T & { language_warnings?: string[] } {
  const violations = runCampaignLanguageCheck(body);
  if (violations.length === 0) return payload;
  return { ...payload, language_warnings: violations };
}
