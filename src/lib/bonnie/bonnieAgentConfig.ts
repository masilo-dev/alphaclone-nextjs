/** Runtime tuning for Bonnie's agent loop — power-agent defaults. */
export const BONNIE_MAX_AGENT_ROUNDS = Math.min(
  12,
  Math.max(4, Number(process.env.BONNIE_MAX_AGENT_ROUNDS || 8))
);

export const BONNIE_MAX_TOOLS_PER_ROUND = Math.min(
  16,
  Math.max(4, Number(process.env.BONNIE_MAX_TOOLS_PER_ROUND || 12))
);

/** Identify informational or read-only summary queries that should execute directly in chat. */
export function isReadOnlySummaryIntent(text: string): boolean {
  const t = text.toLowerCase();
  if (
    /\b(do not|don't|no|prohibit|prohibited|never)\s+(make\s+)?(any\s+)?(changes?|updates?|modifications?|edits?|writes?|actions?|mutations?)\b/i.test(t) ||
    /\b(read-?only|read only)\b/i.test(t)
  ) {
    return true;
  }
  if (
    /\b(summarize|summary|overview|breakdown|status of|details of|details for|tell me about|what (is|are|was|were)|show me|list all|give me a summary)\b/i.test(t)
  ) {
    const hasExplicitMutation = /\b(create|deploy|delete|destroy|archive|send\s+email|publish|execute|run)\b/i.test(t);
    if (!hasExplicitMutation) {
      return true;
    }
  }
  return false;
}

/** Multi-module missions benefit from orchestrate_task instead of many chat rounds. */
export function looksLikeComplexMission(text: string): boolean {
  if (isReadOnlySummaryIntent(text)) {
    return false;
  }
  const t = text.toLowerCase();
  // Count genuine mutation action verbs (excluding nouns like invoice, contact, deal, campaign)
  const actionVerbs =
    (t.match(/\b(create|send|update|schedule|publish|draft|move|enroll|delete|dispatch)\b/g) || [])
      .length;
  return (
    actionVerbs >= 3 ||
    /\b(end to end|end-to-end|full workflow|all of the following|and then|after that)\b/.test(t) ||
    (t.includes(',') && actionVerbs >= 2 && t.length > 80)
  );
}
