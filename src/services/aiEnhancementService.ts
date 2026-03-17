import { generateText } from './unifiedAIService';
import { Project, ChatMessage } from '../types';

export interface AISuggestion {
    type: 'project_name' | 'description' | 'tag' | 'reply' | 'action';
    content: string;
    confidence: number;
    context?: string;
}

export interface ContentGeneration {
    type: 'email' | 'message' | 'proposal' | 'documentation' | 'summary';
    prompt: string;
    context?: Record<string, any>;
}

export const aiEnhancementService = {
    /**
     * Generate smart suggestions for project names
     */
    async suggestProjectName(description: string): Promise<{ suggestions: string[]; error: string | null }> {
        try {
            const prompt = `Based on this project description: "${description}", suggest 5 professional, concise project names. Return only a JSON array of strings, no markdown formatting.`;
            
            const { text, error } = await generateText(prompt, 2048);
            if (error || !text) {
                return { suggestions: [], error: 'Failed to generate suggestions' };
            }

            try {
                const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const suggestions = JSON.parse(cleaned);
                return { suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 5) : [], error: null };
            } catch {
                // Fallback: extract suggestions from text
                const lines = text.split('\n').filter(line => line.trim());
                return { suggestions: lines.slice(0, 5), error: null };
            }
        } catch (error) {
            return {
                suggestions: [],
                error: error instanceof Error ? error.message : 'Suggestion generation failed',
            };
        }
    },

    /**
     * Generate project description from brief
     */
    async generateProjectDescription(brief: string, projectType: string): Promise<{ description: string; error: string | null }> {
        try {
            const prompt = `Generate a professional, detailed project description for a ${projectType} project based on this brief: "${brief}". Make it comprehensive, clear, and suitable for client presentation.`;
            
            const { text, error } = await generateText(prompt, 2048);
            if (error || !text) {
                return { description: '', error: 'Failed to generate description' };
            }

            return { description: text, error: null };
        } catch (error) {
            return {
                description: '',
                error: error instanceof Error ? error.message : 'Description generation failed',
            };
        }
    },

    /**
     * Generate smart reply suggestions for messages
     */
    async suggestMessageReply(message: ChatMessage, conversationHistory: ChatMessage[]): Promise<{ suggestions: string[]; error: string | null }> {
        try {
            const history = conversationHistory
                .slice(-5)
                .map(m => `${m.senderName}: ${m.text}`)
                .join('\n');

            const prompt = `Based on this conversation history:\n${history}\n\nAnd this latest message: "${message.text}"\n\nGenerate 3 professional, helpful reply suggestions. Return only a JSON array of strings.`;
            
            const { text, error } = await generateText(prompt, 2048);
            if (error || !text) {
                return { suggestions: [], error: 'Failed to generate suggestions' };
            }

            try {
                const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const suggestions = JSON.parse(cleaned);
                return { suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 3) : [], error: null };
            } catch {
                return { suggestions: [], error: 'Failed to parse suggestions' };
            }
        } catch (error) {
            return {
                suggestions: [],
                error: error instanceof Error ? error.message : 'Reply suggestion failed',
            };
        }
    },

    /**
     * Generate content based on type and context
     */
    async generateContent(config: ContentGeneration): Promise<{ content: string; error: string | null }> {
        try {
            let prompt = '';

            switch (config.type) {
                case 'email':
                    prompt = `Write a professional email${config.context?.subject ? ` with subject: ${config.context.subject}` : ''}. ${config.prompt}`;
                    break;
                case 'message':
                    prompt = `Write a professional message. ${config.prompt}`;
                    break;
                case 'proposal':
                    prompt = `Write a professional project proposal. ${config.prompt}`;
                    break;
                case 'documentation':
                    prompt = `Write technical documentation. ${config.prompt}`;
                    break;
                case 'summary':
                    prompt = `Create a concise summary. ${config.prompt}`;
                    break;
                default:
                    prompt = config.prompt;
            }

            if (config.context) {
                prompt += `\n\nContext: ${JSON.stringify(config.context, null, 2)}`;
            }

            const { text, error } = await generateText(prompt, 2048);
            if (error || !text) {
                return { content: '', error: 'Failed to generate content' };
            }

            return { content: text, error: null };
        } catch (error) {
            return {
                content: '',
                error: error instanceof Error ? error.message : 'Content generation failed',
            };
        }
    },

    /**
     * Analyze project and suggest improvements
     */
    async analyzeProject(project: Project): Promise<{ suggestions: AISuggestion[]; error: string | null }> {
        try {
            const prompt = `Analyze this project and provide actionable suggestions:\n\nName: ${project.name}\nDescription: ${project.description || 'N/A'}\nStatus: ${project.status}\nProgress: ${project.progress || 0}%\nCategory: ${project.category}\n\nProvide 3-5 specific, actionable suggestions to improve this project. Return JSON array with objects: {type: string, content: string, confidence: number}`;
            
            const { text, error } = await generateText(prompt, 2048);
            if (error || !text) {
                return { suggestions: [], error: 'Failed to analyze project' };
            }

            try {
                const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const suggestions = JSON.parse(cleaned);
                return {
                    suggestions: Array.isArray(suggestions) ? suggestions : [],
                    error: null,
                };
            } catch {
                return { suggestions: [], error: 'Failed to parse suggestions' };
            }
        } catch (error) {
            return {
                suggestions: [],
                error: error instanceof Error ? error.message : 'Project analysis failed',
            };
        }
    },

    /**
     * Generate tags for content
     */
    async generateTags(content: string, maxTags: number = 5): Promise<{ tags: string[]; error: string | null }> {
        try {
            const prompt = `Generate ${maxTags} relevant tags for this content: "${content.substring(0, 500)}". Return only a JSON array of tag strings, no markdown formatting.`;
            
            const { text, error } = await generateText(prompt, 2048);
            if (error || !text) {
                return { tags: [], error: 'Failed to generate tags' };
            }

            try {
                const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const tags = JSON.parse(cleaned);
                return {
                    tags: Array.isArray(tags) ? tags.slice(0, maxTags) : [],
                    error: null,
                };
            } catch {
                return { tags: [], error: 'Failed to parse tags' };
            }
        } catch (error) {
            return {
                tags: [],
                error: error instanceof Error ? error.message : 'Tag generation failed',
            };
        }
    },

    /**
     * Summarize conversation or document
     */
    async summarize(content: string, maxLength: number = 200): Promise<{ summary: string; error: string | null }> {
        try {
            const prompt = `Summarize the following content in ${maxLength} words or less:\n\n${content}`;
            
            const { text, error } = await generateText(prompt, 2048);
            if (error || !text) {
                return { summary: '', error: 'Failed to generate summary' };
            }

            return { summary: text.substring(0, maxLength * 2), error: null };
        } catch (error) {
            return {
                summary: '',
                error: error instanceof Error ? error.message : 'Summary generation failed',
            };
        }
    },

    /**
     * Extract key insights from data
     */
    async extractInsights(data: Record<string, any>): Promise<{ insights: string[]; error: string | null }> {
        try {
            const prompt = `Analyze this data and extract 5 key insights:\n\n${JSON.stringify(data, null, 2)}\n\nReturn only a JSON array of insight strings.`;
            
            const { text, error } = await generateText(prompt, 2048);
            if (error || !text) {
                return { insights: [], error: 'Failed to extract insights' };
            }

            try {
                const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const insights = JSON.parse(cleaned);
                return {
                    insights: Array.isArray(insights) ? insights : [],
                    error: null,
                };
            } catch {
                return { insights: [], error: 'Failed to parse insights' };
            }
        } catch (error) {
            return {
                insights: [],
                error: error instanceof Error ? error.message : 'Insight extraction failed',
            };
        }
    },
};

