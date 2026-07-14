import { callDeepSeek, type DeepSeekModel } from './deepseek';

export type AITask = 'summarize' | 'draft' | 'reason' | 'enrich' | 'generate';

/** DeepSeek-only task router. */
export async function callAI(task: AITask, prompt: string, systemPrompt?: string): Promise<string> {
  const model: DeepSeekModel =
    task === 'reason' || task === 'generate' ? 'deepseek-reasoner' : 'deepseek-chat';
  return callDeepSeek(prompt, { model, systemPrompt });
}
