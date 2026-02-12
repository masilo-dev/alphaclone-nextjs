import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ENV } from '@/config/env';
import { geminiService } from '../geminiService';

/**
 * Unified AI Service
 * Integrates OpenAI and Anthropic (Claude) APIs
 * Smart routing based on task type and availability
 */

export type AIProvider = 'openai' | 'anthropic' | 'auto';

export type AIModel =
    // OpenAI models
    | 'gpt-4-turbo'
    | 'gpt-4'
    | 'gpt-3.5-turbo'
    // Anthropic models
    | 'claude-opus-4'
    | 'claude-sonnet-3.5'
    | 'claude-haiku-3';

export interface AIRequest {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    provider?: AIProvider;
    model?: AIModel;
}

export interface AIResponse {
    content: string;
    provider: 'openai' | 'anthropic';
    model: string;
    tokens: {
        prompt: number;
        completion: number;
        total: number;
    };
    cost: number; // in dollars
}

// Model pricing (per 1M tokens)
const MODEL_PRICING = {
    // OpenAI (per 1M tokens)
    'gpt-4-turbo': { input: 10, output: 30 },
    'gpt-4': { input: 30, output: 60 },
    'gpt-3.5-turbo': { input: 0.5, output: 1.5 },

    // Anthropic (per 1M tokens)
    'claude-opus-4': { input: 15, output: 75 },
    'claude-sonnet-3.5': { input: 3, output: 15 },
    'claude-haiku-3': { input: 0.25, output: 1.25 },
};

class AIService {
    private openai: OpenAI;
    private anthropic: Anthropic;
    private defaultProvider: AIProvider = 'auto';

    constructor() {
        // Initialize OpenAI
        this.openai = new OpenAI({
            apiKey: ENV.OPENAI_API_KEY || '',
        });

        // Initialize Anthropic
        this.anthropic = new Anthropic({
            apiKey: ENV.ANTHROPIC_API_KEY || '',
        });
    }

    /**
     * Main completion method - automatically routes to best provider
     */
    async complete(request: AIRequest): Promise<AIResponse> {
        const provider = this.selectProvider(request);

        try {
            if (provider === 'openai') {
                return await this.completeWithOpenAI(request);
            } else {
                return await this.completeWithAnthropic(request);
            }
        } catch (error) {
            // Fallback chain: OpenAI -> Anthropic -> Gemini OR Anthropic -> OpenAI -> Gemini
            console.error(`${provider} failed, trying secondary provider...`, error);

            try {
                if (provider === 'openai') {
                    if (ENV.ANTHROPIC_API_KEY) return await this.completeWithAnthropic(request);
                } else {
                    if (ENV.OPENAI_API_KEY) return await this.completeWithOpenAI(request);
                }
            } catch (secondaryError) {
                console.error(`Secondary provider also failed, falling back to Gemini...`, secondaryError);
            }

            // Tertiary fallback: Gemini
            if (ENV.VITE_GEMINI_API_KEY) {
                return await this.completeWithGemini(request);
            }

            throw error;
        }
    }

    /**
     * Gemini completion (tertiary fallback)
     */
    private async completeWithGemini(request: AIRequest): Promise<AIResponse> {
        const result = await geminiService.generateContent(request.prompt);

        if (result.error || !result.text) {
            throw new Error((result.error as any)?.message || 'Gemini generation failed');
        }

        return {
            content: result.text,
            provider: 'openai', // Mapping it to openai for compatibility with shared types, but specifically labeled in metadata
            model: 'gemini-1.5-flash',
            tokens: { prompt: 0, completion: 0, total: 0 },
            cost: 0
        } as any;
    }

    /**
     * OpenAI completion
     */
    private async completeWithOpenAI(request: AIRequest): Promise<AIResponse> {
        const model = request.model?.startsWith('gpt-')
            ? request.model
            : 'gpt-4-turbo';

        const messages: any[] = [];

        if (request.systemPrompt) {
            messages.push({
                role: 'system',
                content: request.systemPrompt,
            });
        }

        messages.push({
            role: 'user',
            content: request.prompt,
        });

        const response = await this.openai.chat.completions.create({
            model,
            messages,
            max_tokens: request.maxTokens || 2000,
            temperature: request.temperature || 0.7,
        });

        const usage = response.usage!;
        const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING] || MODEL_PRICING['gpt-4-turbo'];
        const cost = (usage.prompt_tokens * pricing.input + usage.completion_tokens * pricing.output) / 1_000_000;

        return {
            content: response.choices[0].message.content || '',
            provider: 'openai',
            model,
            tokens: {
                prompt: usage.prompt_tokens,
                completion: usage.completion_tokens,
                total: usage.total_tokens,
            },
            cost,
        };
    }

    /**
     * Anthropic (Claude) completion
     */
    private async completeWithAnthropic(request: AIRequest): Promise<AIResponse> {
        const model = request.model?.startsWith('claude-')
            ? request.model
            : 'claude-sonnet-3.5';

        const response = await this.anthropic.messages.create({
            model,
            max_tokens: request.maxTokens || 2000,
            temperature: request.temperature || 0.7,
            system: request.systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: request.prompt,
                },
            ],
        });

        const usage = response.usage;
        const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING] || MODEL_PRICING['claude-sonnet-3.5'];
        const cost = (usage.input_tokens * pricing.input + usage.output_tokens * pricing.output) / 1_000_000;

        return {
            content: response.content[0].type === 'text' ? response.content[0].text : '',
            provider: 'anthropic',
            model,
            tokens: {
                prompt: usage.input_tokens,
                completion: usage.output_tokens,
                total: usage.input_tokens + usage.output_tokens,
            },
            cost,
        };
    }

    /**
     * Smart provider selection based on task type
     */
    private selectProvider(request: AIRequest): 'openai' | 'anthropic' {
        if (request.provider && request.provider !== 'auto') {
            return request.provider;
        }

        // Task-based routing
        const prompt = request.prompt.toLowerCase();

        // Anthropic (Claude) is better for:
        // - Long context (100k+ tokens)
        // - Complex reasoning
        // - Code analysis
        // - Document analysis
        if (
            request.prompt.length > 10000 || // Long prompts
            prompt.includes('analyze') ||
            prompt.includes('reason') ||
            prompt.includes('explain') ||
            prompt.includes('code') ||
            prompt.includes('legal') ||
            prompt.includes('contract')
        ) {
            return 'anthropic';
        }

        // OpenAI is better for:
        // - Short/quick tasks
        // - Creative writing
        // - JSON output
        // - Function calling
        if (
            prompt.includes('write') ||
            prompt.includes('create') ||
            prompt.includes('generate') ||
            prompt.includes('json') ||
            prompt.includes('summarize')
        ) {
            return 'openai';
        }

        // Default: Use Anthropic (better value)
        return 'anthropic';
    }

    /**
     * Streaming completion (for real-time responses)
     */
    async *stream(request: AIRequest): AsyncGenerator<string> {
        const provider = this.selectProvider(request);

        if (provider === 'openai') {
            yield* this.streamOpenAI(request);
        } else {
            yield* this.streamAnthropic(request);
        }
    }

    private async *streamOpenAI(request: AIRequest): AsyncGenerator<string> {
        const model = request.model?.startsWith('gpt-') ? request.model : 'gpt-4-turbo';

        const messages: any[] = [];
        if (request.systemPrompt) {
            messages.push({ role: 'system', content: request.systemPrompt });
        }
        messages.push({ role: 'user', content: request.prompt });

        const stream = await this.openai.chat.completions.create({
            model,
            messages,
            max_tokens: request.maxTokens || 2000,
            temperature: request.temperature || 0.7,
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                yield content;
            }
        }
    }

    private async *streamAnthropic(request: AIRequest): AsyncGenerator<string> {
        const model = request.model?.startsWith('claude-') ? request.model : 'claude-sonnet-3.5';

        const stream = await this.anthropic.messages.stream({
            model,
            max_tokens: request.maxTokens || 2000,
            temperature: request.temperature || 0.7,
            system: request.systemPrompt,
            messages: [{ role: 'user', content: request.prompt }],
        });

        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                yield chunk.delta.text;
            }
        }
    }

    /**
     * Get model recommendations based on task
     */
    getRecommendedModel(taskType: string): { provider: AIProvider; model: AIModel } {
        const recommendations: Record<string, { provider: AIProvider; model: AIModel }> = {
            'contract_generation': { provider: 'anthropic', model: 'claude-opus-4' },
            'document_analysis': { provider: 'anthropic', model: 'claude-sonnet-3.5' },
            'code_generation': { provider: 'anthropic', model: 'claude-sonnet-3.5' },
            'email_drafting': { provider: 'openai', model: 'gpt-4-turbo' },
            'summarization': { provider: 'openai', model: 'gpt-4-turbo' },
            'chat': { provider: 'anthropic', model: 'claude-sonnet-3.5' },
            'quick_task': { provider: 'anthropic', model: 'claude-haiku-3' },
            'translation': { provider: 'openai', model: 'gpt-4-turbo' },
        };

        return recommendations[taskType] || { provider: 'anthropic', model: 'claude-sonnet-3.5' };
    }

    /**
     * Estimate cost before making request
     */
    estimateCost(prompt: string, model: AIModel): number {
        // Rough token estimation (1 token ≈ 4 characters)
        const promptTokens = Math.ceil(prompt.length / 4);
        const completionTokens = 500; // Assume 500 token response

        const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-sonnet-3.5'];
        return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
    }
}

// Singleton instance
export const aiService = new AIService();

/**
 * High-level AI task helpers
 */
export const aiHelpers = {
    /**
     * Generate contract from template
     */
    async generateContract(params: {
        type: string;
        clientName: string;
        amount: number;
        terms: string[];
        customClauses?: string[];
    }): Promise<string> {
        const prompt = `Generate a professional ${params.type} contract for ${params.clientName}.

Amount: $${params.amount}
Terms: ${params.terms.join(', ')}
${params.customClauses ? `Custom Clauses: ${params.customClauses.join('\n')}` : ''}

Include all standard legal clauses and make it ready to sign.`;

        const response = await aiService.complete({
            prompt,
            systemPrompt: 'You are a legal contract expert. Generate professional, legally sound contracts.',
            provider: 'anthropic',
            model: 'claude-opus-4',
            maxTokens: 4000,
        });

        return response.content;
    },

    /**
     * Analyze document and extract key information
     */
    async analyzeDocument(content: string): Promise<{
        summary: string;
        keyPoints: string[];
        entities: string[];
        sentiment: string;
    }> {
        const prompt = `Analyze this document and extract:
1. A brief summary
2. Key points (bullet list)
3. Important entities (people, companies, dates)
4. Overall sentiment

Document:
${content}

Return as JSON with keys: summary, keyPoints, entities, sentiment`;

        const response = await aiService.complete({
            prompt,
            systemPrompt: 'You are a document analysis expert. Extract structured information from documents.',
            provider: 'anthropic',
            model: 'claude-sonnet-3.5',
            temperature: 0.3,
        });

        try {
            return JSON.parse(response.content);
        } catch {
            // Fallback if JSON parsing fails
            return {
                summary: response.content,
                keyPoints: [],
                entities: [],
                sentiment: 'neutral',
            };
        }
    },

    /**
     * Draft professional email
     */
    async draftEmail(params: {
        purpose: string;
        recipient: string;
        context: string;
        tone?: 'formal' | 'casual' | 'friendly';
    }): Promise<{ subject: string; body: string }> {
        const prompt = `Draft a ${params.tone || 'professional'} email for:

Purpose: ${params.purpose}
Recipient: ${params.recipient}
Context: ${params.context}

Return as JSON with keys: subject, body`;

        const response = await aiService.complete({
            prompt,
            systemPrompt: 'You are a professional email writer. Draft clear, concise, and effective emails.',
            provider: 'openai',
            model: 'gpt-4-turbo',
            temperature: 0.7,
        });

        try {
            return JSON.parse(response.content);
        } catch {
            return {
                subject: 'Email Subject',
                body: response.content,
            };
        }
    },

    /**
     * Generate project description
     */
    async generateProjectDescription(params: {
        name: string;
        goals: string[];
        stakeholders: string[];
        timeline?: string;
    }): Promise<string> {
        const prompt = `Generate a professional project description for:

Project Name: ${params.name}
Goals: ${params.goals.join(', ')}
Stakeholders: ${params.stakeholders.join(', ')}
${params.timeline ? `Timeline: ${params.timeline}` : ''}

Make it clear, comprehensive, and action-oriented.`;

        const response = await aiService.complete({
            prompt,
            systemPrompt: 'You are a project management expert. Write clear project descriptions.',
            provider: 'openai',
            model: 'gpt-4-turbo',
        });

        return response.content;
    },

    /**
     * Summarize meeting notes
     */
    async summarizeMeeting(notes: string): Promise<{
        summary: string;
        decisions: string[];
        actionItems: string[];
        nextSteps: string[];
    }> {
        const prompt = `Summarize these meeting notes:

${notes}

Extract:
1. Overall summary
2. Key decisions made
3. Action items
4. Next steps

Return as JSON with keys: summary, decisions, actionItems, nextSteps`;

        const response = await aiService.complete({
            prompt,
            systemPrompt: 'You are a meeting facilitator. Extract structured information from meeting notes.',
            provider: 'anthropic',
            model: 'claude-sonnet-3.5',
            temperature: 0.3,
        });

        try {
            return JSON.parse(response.content);
        } catch {
            return {
                summary: response.content,
                decisions: [],
                actionItems: [],
                nextSteps: [],
            };
        }
    },

    /**
     * Extract structured data from text
     */
    async extractData(text: string, fields: string[]): Promise<Record<string, any>> {
        const prompt = `Extract the following information from this text:

Fields to extract: ${fields.join(', ')}

Text:
${text}

Return as JSON with the requested fields.`;

        const response = await aiService.complete({
            prompt,
            systemPrompt: 'You are a data extraction expert. Extract structured data accurately.',
            provider: 'openai',
            model: 'gpt-4-turbo',
            temperature: 0.2,
        });

        try {
            return JSON.parse(response.content);
        } catch {
            return {};
        }
    },

    /**
     * Translate text
     */
    async translate(text: string, targetLanguage: string): Promise<string> {
        const prompt = `Translate this text to ${targetLanguage}:

${text}`;

        const response = await aiService.complete({
            prompt,
            systemPrompt: 'You are a professional translator. Provide accurate translations.',
            provider: 'openai',
            model: 'gpt-4-turbo',
        });

        return response.content;
    },

    /**
     * AI Chat Assistant
     */
    async chat(message: string, context?: string): Promise<string> {
        const prompt = context
            ? `Context: ${context}\n\nUser: ${message}`
            : message;

        const response = await aiService.complete({
            prompt,
            systemPrompt: 'You are a helpful business assistant. Provide clear, actionable advice.',
            provider: 'anthropic',
            model: 'claude-sonnet-3.5',
        });

        return response.content;
    },
};
