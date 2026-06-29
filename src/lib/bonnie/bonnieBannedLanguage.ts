/**
 * Bonnie v3.0 language constitution — banned phrases, campaign quality gates, social sanitizer.
 * @see docs/BONNIE_MASTER_TRAINING_v3.md
 */

export const BONNIE_BANNED_LANGUAGE = [
  'leverage',
  'synergy',
  'utilize',
  'solution',
  'streamline',
  'scalable',
  'best-in-class',
  'cutting-edge',
  'innovative',
  'revolutionary',
  'robust',
  'seamless',
  'holistic',
  'ecosystem',
  'value-add',
  'pain points',
  'game-changer',
  'thought leader',
  'disruptive',
  'paradigm',
  'actionable insights',
  'deep dive',
  'circle back',
  'touch base',
  'move the needle',
  'low-hanging fruit',
  'bandwidth',
  'ideate',
  'learnings',
  'going forward',
  'moving forward',
  'at the end of the day',
  'it is what it is',
  'best practices',
  'world-class',
  'end-to-end',
  'next-generation',
  'state-of-the-art',
  'Certainly',
  'Of course',
  'Great question',
  'Happy to help',
  'Absolutely',
  'Sure thing',
  'No problem',
  'I would be happy to',
  'I hope this finds you well',
  'I wanted to reach out',
  'I am writing to',
  'I hope you are doing well',
  'Please do not hesitate to',
  'Feel free to',
  'As per my last email',
  'As mentioned previously',
  'I am pleased to inform you',
  'Thank you for your patience',
  'I trust this email finds you',
  'Touching base',
  'kind of',
  'sort of',
  'I think',
  'I believe',
  'I feel like',
  'maybe',
  'perhaps',
  'it seems',
  'it appears',
  'somewhat',
] as const;

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27FF}]/gu;

export function findBannedPhrases(text: string): string[] {
  const lower = String(text || '').toLowerCase();
  return BONNIE_BANNED_LANGUAGE.filter((phrase) => lower.includes(phrase.toLowerCase()));
}

export function stripBonnieEmoji(text: string): string {
  return String(text || '').replace(EMOJI_RE, '');
}

export interface CampaignQualityResult {
  passed: boolean;
  warnings: string[];
  score: number;
}

export function campaignQualityCheck(body: string): CampaignQualityResult {
  const raw = String(body || '');
  const violations = findBannedPhrases(raw);
  const hasPersonalization = raw.includes('{{');
  const startsWithI = raw.trim().startsWith('I ');
  const hasEmoji = EMOJI_RE.test(raw);
  const ctaCount = (raw.match(/https?:\/\//g) || []).length;

  const warnings = [
    ...violations.map((v) => `Banned phrase: "${v}"`),
    !hasPersonalization ? 'No personalization variables' : null,
    startsWithI ? 'Starts with I — rewrite opening' : null,
    hasEmoji ? 'Emoji detected — strip before send' : null,
    ctaCount > 2 ? 'Multiple CTAs — reduce to one' : null,
  ].filter((w): w is string => Boolean(w));

  const score = Math.max(0, 100 - warnings.length * 20);
  return { passed: score >= 80, warnings, score };
}

/** Block send when score is below 60 — Bonnie must rewrite first. */
export function blocksBonnieSend(score: number): boolean {
  return score < 60;
}

export interface SanitizePostResult {
  clean: string;
  warnings: string[];
}

/** Strip emoji, non-ASCII decoration, and flag banned phrases + missing CTA. */
export function sanitizePost(content: string): SanitizePostResult {
  const warnings: string[] = [];
  let clean = stripBonnieEmoji(String(content || ''));
  clean = clean.replace(/[^\x00-\x7F\n]/g, '');

  for (const phrase of findBannedPhrases(clean)) {
    warnings.push(`Banned phrase: "${phrase}"`);
  }

  clean = clean.trim().replace(/\n{3,}/g, '\n\n');

  if (!content.includes('http') && !content.includes('www')) {
    warnings.push('No CTA or link detected');
  }

  return { clean, warnings };
}

export function sanitizeBonnieOutboundText(
  text: string,
  options?: { allowEmoji?: boolean }
): { clean: string; warnings: string[] } {
  let clean = options?.allowEmoji ? String(text || '') : stripBonnieEmoji(String(text || ''));
  const banned = findBannedPhrases(clean);
  for (const phrase of banned) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    clean = clean.replace(re, '');
  }
  clean = clean.replace(/\s{2,}/g, ' ').trim();
  return {
    clean,
    warnings: banned.map((b) => `Banned phrase removed: "${b}"`),
  };
}

/** Backward-compatible warning list for campaign tools. */
export function checkCampaignLanguage(body: string): string[] {
  return campaignQualityCheck(body).warnings;
}
