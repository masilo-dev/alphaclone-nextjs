import {
  findBannedPhrases,
  stripBonnieEmoji,
} from '@/lib/bonnie/bonnieBannedLanguage';

/** Strip Bonnie hedging phrases — tenant data is already loaded. */
const HEDGE_PATTERNS: Array<[RegExp, string]> = [
  [/would you like me to (check|look|search|fetch|verify)[^.?!]*[.?!]?/gi, ''],
  [/should i (check|look|search|fetch|verify)[^.?!]*[.?!]?/gi, ''],
  [/do you want me to (check|look|search|fetch|verify)[^.?!]*[.?!]?/gi, ''],
  [/let me know if you('d| would) like me to[^.?!]*[.?!]?/gi, ''],
  [/i can (check|look|search|fetch) (that|this|your)[^.?!]*if you[^.?!]*[.?!]?/gi, ''],
  [/please confirm (if|whether)[^.?!]*[.?!]?/gi, ''],
  [/would you like me to proceed[^.?!]*[.?!]?/gi, ''],
];

const FILLER_OPENERS: Array<[RegExp, string]> = [
  [/^(Certainly|Of course|Great question|Happy to help|Absolutely|Sure thing|Touching base)[!.,]?\s*/i, ''],
  [/^(I would be happy to|I am pleased to inform you|I trust this email finds you)\s*/i, ''],
  [/^(I hope this finds you well|I wanted to reach out)\s*/i, ''],
];

export function sanitizeBonnieResponse(text: string): string {
  let out = stripBonnieEmoji(text.trim());

  for (const [pattern, replacement] of HEDGE_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of FILLER_OPENERS) {
    out = out.replace(pattern, replacement);
  }

  for (const phrase of findBannedPhrases(out)) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, '');
  }

  out = out.replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return out || text.trim();
}

export const BONNIE_ANTI_HEDGE_INSTRUCTION = `
Never ask yes/no before reading workspace data. Never say "would you like me to check", "should I look that up", "let me know if you want me to", or "please confirm". You already have tenant access — state facts from tools or snapshot directly.
Never use banned corporate phrases or emoji. Never start a reply with "I" — lead with the outcome or the person. One question at a time only.
Never go silent after sending — always confirm what was done. Every error must include a plain-English fix path.`;
