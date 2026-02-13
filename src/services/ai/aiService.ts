import {
    routeAIRequest,
    getAvailableProviders,
    getRecommendedModel,
    estimateCost,
    AIRequestOptions,
    AIResponse as RouterResponse
} from '../aiRouter';

export type AIProvider = 'openai' | 'anthropic' | 'auto';

export type AIModel = string;

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
    provider: 'openai' | 'anthropic' | 'gemini';
    model: string;
    tokens: {
        prompt: number;
        completion: number;
        total: number;
    };
    cost: number;
}

class AIService {
    async complete(request: AIRequest): Promise<AIResponse> {
        const response = await routeAIRequest({
            prompt: request.prompt,
            systemPrompt: request.systemPrompt,
            maxTokens: request.maxTokens,
            temperature: request.temperature
        });

        return {
            content: response.content,
            provider: response.provider as any,
            model: response.model,
            tokens: { prompt: 0, completion: 0, total: 0 },
            cost: estimateCost(request.prompt, response.model)
        };
    }

    async *stream(request: AIRequest): AsyncGenerator<string> {
        // Fallback to complete for now if stream is not implemented in router
        const response = await this.complete(request);
        yield response.content;
    }

    getRecommendedModel(taskType: string) {
        return getRecommendedModel(taskType);
    }

    estimateCost(prompt: string, model: string) {
        return estimateCost(prompt, model);
    }
}

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
            model: 'claude-opus-4-6',
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
            model: 'claude-sonnet-4-5-20250929',
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
            model: 'claude-sonnet-4-5-20250929',
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
            model: 'claude-sonnet-4-5-20250929',
        });

        return response.content;
    },
};
