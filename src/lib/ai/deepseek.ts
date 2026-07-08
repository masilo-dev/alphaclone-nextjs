/**
 * DeepSeek API client — used for cost-sensitive / high-volume AI tasks.
 * Docs: https://platform.deepseek.com/api-docs
 */
import { DEFAULT_OPENROUTER_MODEL } from '@/config/aiModels';

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

    const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`DeepSeek API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('DeepSeek returned empty response');
    }
    return content as string;
}

async function openRouterCompletion(
    messages: DeepSeekMessage[],
    options: DeepSeekOptions = {}
): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const completionModel = DEFAULT_OPENROUTER_MODEL;
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://alphaclonesystems.com',
            'X-Title': 'AlphaClone Systems',
        },
        body: JSON.stringify({
            model: completionModel,
            messages,
            max_tokens: options.maxTokens ?? 2000,
            temperature: options.temperature ?? 0.7,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('OpenRouter returned empty response');
    }

    return content as string;
}

export async function callDeepSeek(
    prompt: string,
    options: DeepSeekOptions = {}
): Promise<string> {
    const messages: DeepSeekMessage[] = [];
    if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    try {
        return await deepSeekCompletion(messages, options);
    } catch (err) {
        // DeepSeek is optional; fall back to OpenRouter so AI doesn't go dark.
        return await openRouterCompletion(messages, options);
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
        return await deepSeekCompletion(messages, options);
    } catch (err) {
        // If DeepSeek errors, transparently fail over to OpenRouter.
        return await openRouterCompletion(messages, options);
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
        const res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: options.model || 'deepseek-chat',
                messages,
                max_tokens: options.maxTokens ?? 2000,
                temperature: options.temperature ?? 0.5,
                stream: true,
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`DeepSeek stream error ${res.status}: ${err}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('DeepSeek stream unavailable');

        const decoder = new TextDecoder();
        let full = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const block = decoder.decode(value, { stream: true });
            for (const line of block.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (payload === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(payload);
                    const delta = parsed?.choices?.[0]?.delta?.content;
                    if (delta) {
                        full += delta;
                        onToken(delta);
                    }
                } catch {
                    // ignore malformed SSE chunks
                }
            }
        }

        return full;
    } catch (err) {
        // If DeepSeek streaming fails mid-flight, still provide output via OpenRouter.
        return await openRouterStream(messages, options, onToken);
    }
}

async function openRouterStream(
    messages: DeepSeekMessage[],
    options: DeepSeekOptions,
    onToken: (chunk: string) => void
): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const completionModel = DEFAULT_OPENROUTER_MODEL;
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://alphaclonesystems.com',
            'X-Title': 'AlphaClone Systems',
        },
        body: JSON.stringify({
            model: completionModel,
            messages,
            max_tokens: options.maxTokens ?? 2000,
            temperature: options.temperature ?? 0.5,
            stream: true,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter stream error ${res.status}: ${err}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('OpenRouter stream unavailable');

    const decoder = new TextDecoder();
    let full = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const block = decoder.decode(value, { stream: true });
        for (const line of block.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;

            try {
                const parsed = JSON.parse(payload);
                const delta = parsed?.choices?.[0]?.delta?.content;
                if (typeof delta === 'string' && delta.length > 0) {
                    full += delta;
                    onToken(delta);
                }
            } catch {
                // Ignore malformed SSE chunks.
            }
        }
    }

    return full;
}
