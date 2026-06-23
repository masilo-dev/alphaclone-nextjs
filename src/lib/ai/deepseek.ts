/**
 * DeepSeek API client — used for cost-sensitive / high-volume AI tasks.
 * Docs: https://platform.deepseek.com/api-docs
 */

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

export async function callDeepSeek(
    prompt: string,
    options: DeepSeekOptions = {}
): Promise<string> {
    const messages: DeepSeekMessage[] = [];
    if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    return deepSeekCompletion(messages, options);
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
    return deepSeekCompletion(messages, options);
}
