/**
 * DeepSeek API client — used for cost-sensitive / high-volume AI tasks.
 * Docs: https://platform.deepseek.com/api-docs
 */
import { DEFAULT_OPENROUTER_MODEL } from '@/config/aiModels';
import { requestOpenRouterCompletion, streamOpenRouterCompletion } from '@/lib/ai/openRouterRequest';
import {
  createAIProviderUnavailableError,
  clearAIProviderCooldown,
  getAIProviderCooldown,
  noteAIProviderFailure,
} from '@/lib/ai/providerHealth';

export type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';

export interface DeepSeekOptions {
    model?: DeepSeekModel;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
}

export type DeepSeekMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

function isServerRuntime(): boolean {
    return typeof window === 'undefined';
}

async function deepSeekCompletion(
    messages: DeepSeekMessage[],
    options: DeepSeekOptions = {}
): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    const {
        model = 'deepseek-chat',
        maxTokens = 2000,
        temperature = 0.7,
    } = options;

    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
        apiKey,
        baseURL: 'https://api.deepseek.com',
    });

    const response = await client.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('DeepSeek returned empty response');
    }
    return content as string;
}

async function openRouterCompletion(
    messages: DeepSeekMessage[],
    options: DeepSeekOptions = {}
): Promise<string> {
    if (getAIProviderCooldown('openrouter')) {
        throw createAIProviderUnavailableError(['OpenRouter skipped: cooldown active']);
    }
    const { content } = await requestOpenRouterCompletion(messages, {
        model: DEFAULT_OPENROUTER_MODEL,
        maxTokens: options.maxTokens ?? 2000,
        temperature: options.temperature ?? 0.7,
    });
    clearAIProviderCooldown('openrouter');
    return content;
}

export async function callDeepSeek(
    prompt: string,
    options: DeepSeekOptions = {}
): Promise<string> {
    if (!isServerRuntime()) {
        const response = await fetch('/api/ai/deepseek', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                options,
            }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.error || 'DeepSeek request failed');
        }

        if (typeof payload?.content !== 'string' || !payload.content) {
            throw new Error('DeepSeek returned empty response');
        }

        return payload.content;
    }

    const messages: DeepSeekMessage[] = [];
    if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    try {
        if (!getAIProviderCooldown('deepseek')) {
            return await deepSeekCompletion(messages, options);
        }
    } catch (err) {
        noteAIProviderFailure('deepseek', err);
    }
    try {
        // DeepSeek is optional; fall back to OpenRouter so AI doesn't go dark.
        return await openRouterCompletion(messages, options);
    } catch (err) {
        noteAIProviderFailure('openrouter', err);
        throw err;
    }
}

export async function chatDeepSeek(
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    message: string,
    options: DeepSeekOptions = {}
): Promise<string> {
    const messages: DeepSeekMessage[] = [];
    if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
    }
    for (const turn of history) {
        messages.push({ role: turn.role, content: turn.content });
    }
    messages.push({ role: 'user', content: message });
    try {
        if (!getAIProviderCooldown('deepseek')) {
            return await deepSeekCompletion(messages, options);
        }
    } catch (err) {
        noteAIProviderFailure('deepseek', err);
    }
    try {
        // If DeepSeek errors, transparently fail over to OpenRouter.
        return await openRouterCompletion(messages, options);
    } catch (err) {
        noteAIProviderFailure('openrouter', err);
        throw err;
    }
}

/** Stream tokens from DeepSeek — used by Bonnie for DeepChat-style responses. */
export async function streamDeepSeek(
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    message: string,
    options: DeepSeekOptions = {},
    onToken: (chunk: string) => void
): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;

    const messages: DeepSeekMessage[] = [];
    if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
    for (const turn of history) messages.push({ role: turn.role, content: turn.content });
    messages.push({ role: 'user', content: message });

    if (!apiKey) {
        return await openRouterStream(messages, options, onToken);
    }

    try {
        if (getAIProviderCooldown('deepseek')) {
            return await openRouterStream(messages, options, onToken);
        }
        const { default: OpenAI } = await import('openai');
        const client = new OpenAI({
            apiKey,
            baseURL: 'https://api.deepseek.com',
        });
        const stream = await client.chat.completions.create({
            model: options.model || 'deepseek-chat',
            messages,
            max_tokens: options.maxTokens ?? 2000,
            temperature: options.temperature ?? 0.5,
            stream: true,
        });

        let full = '';
        for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
                full += delta;
                onToken(delta);
            }
        }

        return full;
    } catch (err) {
        noteAIProviderFailure('deepseek', err);
        // If DeepSeek streaming fails mid-flight, still provide output via OpenRouter.
        try {
            return await openRouterStream(messages, options, onToken);
        } catch (fallbackErr) {
            noteAIProviderFailure('openrouter', fallbackErr);
            throw fallbackErr;
        }
    }
}

async function openRouterStream(
    messages: DeepSeekMessage[],
    options: DeepSeekOptions,
    onToken: (chunk: string) => void
): Promise<string> {
    if (getAIProviderCooldown('openrouter')) {
        throw createAIProviderUnavailableError(['OpenRouter stream skipped: cooldown active']);
    }
    const { content } = await streamOpenRouterCompletion(messages, {
        model: DEFAULT_OPENROUTER_MODEL,
        maxTokens: options.maxTokens ?? 2000,
        temperature: options.temperature ?? 0.5,
    }, onToken);
    clearAIProviderCooldown('openrouter');
    return content;
}
