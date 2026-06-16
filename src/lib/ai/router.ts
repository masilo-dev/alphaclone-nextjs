import { callDeepSeek, DeepSeekModel } from './deepseek';
import { routeAIRequest } from '@/services/aiRouter';

export type AITask = 'summarize' | 'draft' | 'reason' | 'enrich' | 'generate';

/**
 * Call a Claude model via the existing AI routing system.
 */
export async function callClaude(prompt: string, model: string, systemPrompt?: string): Promise<string> {
    const res = await routeAIRequest({
        prompt,
        model,
        systemPrompt,
    });
    if (!res.success) {
        throw new Error(res.error || 'Claude request failed');
    }
    return res.content;
}

/**
 * Unified AI Router to select the appropriate provider/model depending on the task type.
 * Uses DeepSeek for cost-sensitive tasks and Claude for complex/creative tasks.
 */
export async function callAI(task: AITask, prompt: string, systemPrompt?: string): Promise<string> {
    if (process.env.DEEPSEEK_API_KEY) {
        try {
            const model: DeepSeekModel = task === 'reason' || task === 'generate' ? 'deepseek-reasoner' : 'deepseek-chat';
            return await callDeepSeek(prompt, { model, systemPrompt });
        } catch (err) {
            console.warn('[AI Router] DeepSeek call failed, falling back to Claude:', err);
        }
    }

    switch (task) {
        case 'summarize':
        case 'enrich':
            // DeepSeek is cheap and fast — ideal for high-volume tasks
            return callDeepSeek(prompt, { systemPrompt });

        case 'draft':
            // Claude Sonnet is balanced for general drafting
            return callClaude(prompt, 'claude-sonnet-4-20250514', systemPrompt);

        case 'reason':
        case 'generate':
            // Claude Sonnet 4.6 (Thinking enabled or higher tier) is best for complex orchestrator/strategic tasks
            return callClaude(prompt, 'claude-sonnet-4-6-20260217', systemPrompt);

        default:
            return callClaude(prompt, 'claude-sonnet-4-20250514', systemPrompt);
    }
}

