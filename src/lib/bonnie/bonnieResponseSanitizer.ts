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

export function sanitizeBonnieResponse(text: string): string {
  let out = text.trim();
  for (const [pattern, replacement] of HEDGE_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  return out || text.trim();
}

export const BONNIE_ANTI_HEDGE_INSTRUCTION = `
Never ask yes/no before reading workspace data. Never say "would you like me to check", "should I look that up", "let me know if you want me to", or "please confirm". You already have tenant access — state facts from tools or snapshot directly.`;
