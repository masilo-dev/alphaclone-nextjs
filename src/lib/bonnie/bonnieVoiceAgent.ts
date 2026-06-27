import { routeAIRequest } from '@/services/aiRouter';
import { chooseBonnieModel } from '@/lib/bonnie/bonnieModelRouter';
import { runBonnieAgent } from '@/lib/bonnie/bonnieAgent';
import type { BonnieModuleId } from '@/lib/bonnie/bonnieToolCatalog';

export type BonnieVoiceResult = {
  transcript: string;
  intent: string;
  response: string;
  toolResults: Array<{ tool: string; success: boolean; summary: string }>;
  provider: string;
};

/**
 * Grok-powered voice command pipeline:
 * 1. Parse spoken intent (Grok)
 * 2. Execute via full Bonnie agent (tools + memory + policy)
 * 3. Return speakable summary
 */
export async function runBonnieVoiceAgent(params: {
  tenantId: string;
  userId: string;
  transcript: string;
  pathname?: string;
  moduleContext?: BonnieModuleId;
}): Promise<BonnieVoiceResult> {
  const transcript = params.transcript.trim();
  if (!transcript) {
    return {
      transcript: '',
      intent: 'empty',
      response: 'I did not catch that. Please try again.',
      toolResults: [],
      provider: 'none',
    };
  }

  const voiceModel = chooseBonnieModel('voice_command');
  let normalizedInstruction = transcript;

  if (voiceModel.provider === 'grok') {
    try {
      const parsed = await routeAIRequest({
        prompt: `Normalize this voice command into a clear business instruction for Bonnie AI (one sentence, actionable):\n"${transcript}"`,
        systemPrompt:
          'You are a voice command normalizer. Output only the normalized instruction — no quotes, no preamble.',
        model: voiceModel.model,
        maxTokens: 200,
        temperature: 0.2,
      });
      if (parsed.content?.trim()) normalizedInstruction = parsed.content.trim();
    } catch {
      // use raw transcript
    }
  }

  const agentResult = await runBonnieAgent({
    tenantId: params.tenantId,
    userId: params.userId,
    instruction: normalizedInstruction,
    pathname: params.pathname,
    moduleContext: params.moduleContext,
  });

  let speakable = agentResult.response;
  if (voiceModel.provider === 'grok' && agentResult.toolResults.length > 0) {
    try {
      const shortened = await routeAIRequest({
        prompt: `Summarize for text-to-speech (max 2 sentences, plain language):\n${agentResult.response}`,
        model: voiceModel.model,
        maxTokens: 150,
        temperature: 0.3,
      });
      if (shortened.content?.trim()) speakable = shortened.content.trim();
    } catch {
      // keep full response
    }
  }

  return {
    transcript,
    intent: normalizedInstruction,
    response: speakable,
    toolResults: agentResult.toolResults.map((r) => ({
      tool: r.tool,
      success: r.success,
      summary: r.summary,
    })),
    provider: agentResult.provider,
  };
}
