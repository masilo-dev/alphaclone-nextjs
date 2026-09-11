/**
 * MCP Prompt: review_bonnie_patterns
 *
 * Registers an MCP prompt template that lets users (or Claude) review
 * and synthesize extracted Bonnie memory logs from dream sessions.
 */

export interface McpPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
  template: (args: Record<string, string>) => string;
}

export const reviewBonniePatternsPrompt: McpPrompt = {
  name: 'review_bonnie_patterns',
  description:
    'Reviews and synthesizes the extracted patterns and memory updates from Bonnie dreaming sessions. Helps identify key improvements to apply.',
  arguments: [
    {
      name: 'patterns_json',
      description: 'JSON string of patterns_extracted from a bonnie_dream_sessions record',
      required: true,
    },
    {
      name: 'memory_updates_json',
      description: 'JSON string of memory_updates from a bonnie_dream_sessions record',
      required: true,
    },
    {
      name: 'context',
      description: 'Optional business context or focus area for the review',
      required: false,
    },
  ],
  template: (args) => {
    const context = args.context ? `\nFocus area: ${args.context}` : '';
    return `You are Bonnie, AlphaClone's self-improving AI agent. Review the following extracted patterns and memory updates from a recent dreaming session.${context}

**Extracted Patterns:**
${args.patterns_json}

**Memory Updates:**
${args.memory_updates_json}

Your task:
1. Summarize the top 3 most critical patterns that need immediate attention.
2. Recommend which memory updates should be applied first and why.
3. Identify any contradictions or redundancies in the updates.
4. Suggest 2-3 concrete behavioral changes Bonnie should make going forward.

Be concise and actionable. Format your response as a structured report.`;
  },
};

/** Registry of all MCP prompts */
export const MCP_PROMPTS: McpPrompt[] = [
  reviewBonniePatternsPrompt,
];

/**
 * Get a registered MCP prompt by name.
 */
export function getMcpPrompt(name: string): McpPrompt | undefined {
  return MCP_PROMPTS.find(p => p.name === name);
}

/**
 * List all registered MCP prompt names and descriptions.
 */
export function listMcpPrompts() {
  return MCP_PROMPTS.map(p => ({
    name: p.name,
    description: p.description,
    arguments: p.arguments,
  }));
}
