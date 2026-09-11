import { callDeepSeek } from '@/lib/ai/deepseek';

export type BonnieDreamSynthesis = {
  patterns_extracted: Array<{
    type: string;
    description: string;
    frequency: number;
    severity: string;
  }>;
  memory_updates: Array<{
    category: string;
    insight: string;
    action_recommendation: string;
  }>;
  summary?: string;
};

function fallbackFromSessions(sessions: Array<{ success?: boolean; tool_name?: string }>): BonnieDreamSynthesis {
  const failedTools = (sessions || []).filter((s) => !s.success).map((s) => String(s.tool_name || 'unknown'));
  const uniqueFailed = Array.from(new Set(failedTools));
  return {
    patterns_extracted: uniqueFailed.map((tool) => ({
      type: 'failure_pattern',
      description: `Tool "${tool}" has recurring failures`,
      frequency: failedTools.filter((t) => t === tool).length,
      severity: 'medium',
    })),
    memory_updates: [
      {
        category: 'reliability',
        insight: 'Some tools have recurring failures',
        action_recommendation: 'Review tool implementations',
      },
    ],
    summary: 'Fallback synthesis from session failure counts',
  };
}

export async function synthesizeBonnieDreamFromSessions(
  sessions: Array<{ success?: boolean; tool_name?: string }>
): Promise<BonnieDreamSynthesis> {
  const dreamPrompt = `You are reviewing past AI agent session logs for a SaaS business platform.
Analyze the following session data and extract:
1. Common failure patterns (tools that often fail, error themes)
2. Performance insights (slow tools, high success rate tools)
3. Behavioral patterns (most used tools, usage trends)
4. Memory improvements (what the agent should do better next time)

Session data (last ${sessions?.length || 0} sessions):
${JSON.stringify(sessions || [], null, 2)}

Return ONLY valid JSON with:
- "patterns_extracted": array of { type, description, frequency, severity }
- "memory_updates": array of { category, insight, action_recommendation }
- "summary": one-sentence summary`;

  try {
    const rawText = await callDeepSeek(dreamPrompt, {
      model: 'deepseek-reasoner',
      maxTokens: 2048,
      temperature: 0.2,
    });
    const cleanText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleanText) as BonnieDreamSynthesis;
    return {
      patterns_extracted: parsed.patterns_extracted || [],
      memory_updates: parsed.memory_updates || [],
      summary: parsed.summary,
    };
  } catch (e) {
    console.warn('[bonnieDreamSynthesis] DeepSeek failed, using fallback:', e);
    return fallbackFromSessions(sessions);
  }
}

export async function runBonnieSubagentDeepSeek(input: {
  name: string;
  role: string;
  task: string;
  instructions: string;
}): Promise<string> {
  const prompt = `Main task: ${input.task}

Your instructions: ${input.instructions}

Return JSON with keys: outcome, details, next_steps.`;

  return callDeepSeek(prompt, {
    model: 'deepseek-chat',
    maxTokens: 512,
    temperature: 0.35,
    systemPrompt: `You are ${input.name}, role: ${input.role}. Respond with valid JSON only.`,
  });
}
