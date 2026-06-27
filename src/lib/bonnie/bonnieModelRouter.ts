/**
 * Multi-model routing for Bonnie — model-agnostic moat layer.
 * DeepSeek: agent planning & tool loops (cost-efficient).
 * Grok (xAI): voice, social, realtime-style replies.
 * Claude/OpenAI: fallback via aiRouter when configured.
 */
export type BonnieTaskKind =
  | 'agent_plan'
  | 'agent_synthesis'
  | 'voice_command'
  | 'social_content'
  | 'lead_qualification'
  | 'customer_brief';

export type BonnieModelChoice = {
  provider: 'deepseek' | 'grok' | 'auto';
  model: string;
  reason: string;
};

export function chooseBonnieModel(task: BonnieTaskKind): BonnieModelChoice {
  const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY);
  const hasGrok = Boolean(process.env.XAI_API_KEY || process.env.GROK_API_KEY);

  switch (task) {
    case 'voice_command':
    case 'social_content':
      if (hasGrok) {
        return { provider: 'grok', model: 'grok-4.3', reason: 'Grok excels at conversational voice and social tone.' };
      }
      break;
    case 'lead_qualification':
    case 'customer_brief':
      if (hasGrok) {
        return { provider: 'grok', model: 'grok-4.3', reason: 'Grok for nuanced qualification summaries.' };
      }
      break;
    case 'agent_plan':
    case 'agent_synthesis':
    default:
      if (hasDeepSeek) {
        return { provider: 'deepseek', model: 'deepseek-chat', reason: 'DeepSeek for cost-efficient agent loops.' };
      }
      if (hasGrok) {
        return { provider: 'grok', model: 'grok-4.3', reason: 'Grok fallback for agent when DeepSeek unavailable.' };
      }
      break;
  }

  return { provider: 'auto', model: 'auto', reason: 'aiRouter auto-selects from configured providers.' };
}
