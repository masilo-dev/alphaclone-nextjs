/** Runtime tuning for Bonnie's agent loop — power-agent defaults. */
export const BONNIE_MAX_AGENT_ROUNDS = Math.min(
  12,
  Math.max(4, Number(process.env.BONNIE_MAX_AGENT_ROUNDS || 8))
);

export const BONNIE_MAX_TOOLS_PER_ROUND = Math.min(
  16,
  Math.max(4, Number(process.env.BONNIE_MAX_TOOLS_PER_ROUND || 12))
);

/** Multi-module missions benefit from orchestrate_task instead of many chat rounds. */
export function looksLikeComplexMission(text: string): boolean {
  const t = text.toLowerCase();
  const actionVerbs =
    (t.match(/\b(create|send|update|schedule|publish|draft|move|enroll|invoice|contact|campaign|deal)\b/g) || [])
      .length;
  return (
    actionVerbs >= 3 ||
    /\b(end to end|end-to-end|full workflow|everything|all of the following|and then|after that)\b/.test(t) ||
    (t.includes(',') && actionVerbs >= 2 && t.length > 80)
  );
}
