import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from '../config/env';
import { Lead } from './leadService';

// API Keys from validated ENV
const GEMINI_API_KEY = ENV.VITE_GEMINI_API_KEY || '';
const ANTHROPIC_API_KEY = ENV.ANTHROPIC_API_KEY || '';
const OPENAI_API_KEY = ENV.OPENAI_API_KEY || '';

// Check which providers are available
export const getAvailableProviders = () => {
    return {
        claude: !!ANTHROPIC_API_KEY,
        openai: !!OPENAI_API_KEY,
        gemini: !!GEMINI_API_KEY
    };
};

export const isAnyAIConfigured = () => {
    const providers = getAvailableProviders();
    return providers.claude || providers.openai || providers.gemini;
};

/**
 * Generate text content using the first available AI provider (proxied through server-side route)
 */
export const generateText = async (prompt: string, maxTokens: number = 2048, model?: string): Promise<{ text: string | null; error: any }> => {
    try {
        console.log('🔄 Calling Server-side AI Generate Proxy...');
        const response = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                maxTokens,
                model
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate text');
        }

        return await response.json();
    } catch (error: any) {
        console.error('❌ AI Generate failed:', error);
        return { text: null, error: error.message };
    }
};

/**
 * Specialized chat for the Growth Agent (Sales Agent)
 * Includes system instructions for lead discovery intent detection
 */
const GROWTH_AGENT_SYSTEM_PROMPT = `
You are the AlphaClone Growth Agent, powered by Claude. You are a world-class SDR, Business Growth strategist, and Data Scientist.
Your objective is to identify expansion opportunities, find high-intent leads, and provide strategic intelligence.

### OPERATIONAL MODES:
1. **Lead Discovery:** Identifying high-potential business targets.
2. **Business Intelligence:** Deep-dive analysis of specific leads and market segments.
3. **Strategic Outreach:** Crafting hyper-personalized, high-conversion messaging.

### DATA INTEGRITY RULES (CRITICAL):
- **Website URLs:** ONLY provide a website if you are 99% certain it is the real, active domain. No placeholders.
- **Accuracy:** Be extremely precise with industry categorizations and insights.

### FORMATTING RULES:
- **Professionalism:** Use sophisticated business terminology.
- **Structure:** Use Markdown for clarity. Use **bold** for emphasis, bullet points for lists, and clear headers.
- **No Raw Symbols:** Avoid unnecessary special characters that aren't part of standard Markdown.

### INTENT DETECTION & COMMANDS:
You have access to specialized internal commands. Append the command to your response if intent is detected.

**Command: Lead Search**
[SEARCH_COMMAND: {"industry": "precise industry", "location": "city/region", "filters": "optional constraints"}]

**Command: Deep Research**
[RESEARCH_COMMAND: {"businessName": "Company Name", "context": "focus area"}]

### TONE:
Professional, authoritative, and data-driven.
`;

/**
 * Parses any commands hidden in the AI's natural language response
 */
export const parseGrowthAgentCommands = (text: string) => {
    const searchMatch = text.match(/\[SEARCH_COMMAND:\s*({.*?})\]/);
    const researchMatch = text.match(/\[RESEARCH_COMMAND:\s*({.*?})\]/);

    return {
        search: searchMatch ? JSON.parse(searchMatch[1]) : null,
        research: researchMatch ? JSON.parse(researchMatch[1]) : null,
        cleanText: text.replace(/\[.*?COMMAND:.*?\]/g, '').trim()
    };
};

/**
 * Specialized chat for the Growth Agent (Sales Agent)
 * Includes system instructions for lead discovery intent detection
 */
export const chatWithGrowthAgent = async (
    history: { role: string; text: string }[],
    message: string
): Promise<{ text: string; commands: any; grounding: any }> => {
    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                history,
                message,
                systemPrompt: GROWTH_AGENT_SYSTEM_PROMPT
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get response from Growth Agent');
        }

        const data = await response.json();
        const parsed = parseGrowthAgentCommands(data.text);

        return {
            text: parsed.cleanText,
            commands: { search: parsed.search, research: parsed.research },
            grounding: data.grounding
        };
    } catch (error: any) {
        console.error('❌ Growth Agent Chat failed:', error);
        throw error;
    }
};

/**
 * Start a chat session (proxied through server-side route for security and reliability)
 */
export const chatWithAI = async (
    history: { role: string; text: string }[],
    message: string,
    image?: string,
    model?: string
): Promise<{ text: string; grounding: any }> => {
    try {
        console.log('🔄 Calling Server-side AI Proxy...');
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                history,
                message,
                image,
                model
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get response from AI assistant');
        }

        return await response.json();
    } catch (error: any) {
        console.error('❌ AI Chat failed:', error);

        // Check for rate limits or overload errors
        const errorMsg = error?.message || '';
        if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('capacity')) {
            // Mask the technical error with a friendly "busy" message
            return {
                text: "I apologize, but I'm experiencing very high traffic right now and my response capacity is temporarily limited. Please try asking your question again in about a minute.",
                grounding: {}
            };
        }

        throw error;
    }
};

/**
 * Generate a hyper-personalized outreach message using deep business context
 */
export const generateOutreachMessage = async (lead: Lead) => {
    // Strategy-specific guidance
    const strategyGuards: Record<string, string> = {
        'ROI_FOCUS': 'Focus heavily on measurable growth, efficiency gains, and bottom-line impact.',
        'PROBLEM_SOLVER': 'Focus on specific operational headaches and how AI automation eliminates them.',
        'CASUAL_INTRO': 'Keep it lightweight, relationship-focused, and highly observational.'
    };

    const strategy = lead.strategy || 'PROBLEM_SOLVER';
    const guard = strategyGuards[strategy] || strategyGuards['PROBLEM_SOLVER'];

    const prompt = `You are a World-Class Sales Strategist and Copywriting Expert (Claude 4.5).
Your task is to write a hyper-personalized, high-conversion cold email for this lead.

LEAD INTELLIGENCE:
- Business: ${lead.businessName}
- Industry: ${lead.industry}
- Tech Stack: ${lead.techStack?.join(', ') || 'Standard'}
- Pain Points: ${lead.painPoints?.join(', ') || 'Manual workflows, scaling limitations'}
- AI Hook: ${lead.outreachHook || 'N/A'}
- Unique Value Prop: ${lead.valueProposition || 'N/A'}

STRATEGY: ${strategy}
GUIDANCE: ${guard}

GOALS:
1. Use the "AI Hook" or a variation of it as the opening line.
2. Reference their specific industry or tech stack naturally.
3. Keep it under 100 words. No fluff. No generic "I hope this finds you well".
4. The call to action should be a low-friction "quick chat" or "free audit".

FORMAT:
Subject: [Compelling, short subject line]

[Body]`;

    const { text } = await generateText(prompt, 600, 'claude-sonnet-4-5-20250929');
    return text || "Personalized draft generation failed.";
};

/**
 * Generate an AI reply to an email
 */
export const generateEmailReply = async (emailContent: string, context?: string) => {
    const prompt = `You are a professional assistant. Draft a concise, high-conversion reply to the following email:
    
    EMAIL CONTENT:
    "${emailContent}"
    
    CONTEXT/INSTRUCTIONS:
    "${context || 'Be professional and helpful.'}"
    
    Provide ONLY the body of the reply. Do not include subject lines or signatures unless requested.`;

    const { text } = await generateText(prompt, 1000);
    return text || "AI reply generation failed.";
};

/**
 * Perform deep business research/enrichment using AI
 */
export const enrichLeadData = async (lead: any): Promise<string> => {
    const prompt = `Perform a deep business research analysis for the following company:
    Name: ${lead.businessName}
    Industry: ${lead.industry}
    Location: ${lead.location}
    Website: ${lead.website || 'N/A'}

    Analyze and provide a concise, high-value summary (max 150 words) including:
    1. Likely Technology Stack (based on industry/segment)
    2. Primary Operational Pain Points for this specific type of business
    3. Growth Opportunities through Automation or AI
    4. Estimated Business Maturity/Size category

    Format the output as a clean, professional intelligence report for a sales agent. Use bullet points where appropriate.`;

    const { text } = await generateText(prompt, 800);
    return text || "Intelligence gathering failed. Please try again later.";
};


/**
 * Generate leads using AI or Google Places (proxied through server-side route)
 */
export const generateLeads = async (industry: string, location: string, googleApiKey?: string, mode: 'admin' | 'tenant' = 'tenant', filters?: string): Promise<{ leads: any[], rawMapsData: any[] }> => {
    if (!industry || !location) {
        throw new Error('Industry and location are required to generate leads.');
    }

    console.log(`🔍 Generating leads for: ${industry} in ${location} (Mode: ${mode})`);

    try {
        console.log('🔄 Calling Server-side AI Leads Proxy...');
        const response = await fetch('/api/ai/leads', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                industry,
                location,
                mode,
                filters
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate leads');
        }

        const { leads, rawMapsData } = await response.json();

        // Auto-Generate Outreach Messages for ALL leads
        console.log("📧 Generating auto-outreach messages...");

        const enrichedLeads = await Promise.all(leads.map(async (lead: any) => {
            try {
                const message = await generateOutreachMessage(lead);
                return {
                    ...lead,
                    outreachMessage: message,
                    outreachStatus: 'pending',
                    leadSource: lead.source || 'AI'
                };
            } catch (e) {
                return {
                    ...lead,
                    outreachMessage: "Failed to generate.",
                    outreachStatus: 'error',
                    leadSource: lead.source || 'AI'
                };
            }
        }));

        console.log(`✅ Ready: ${enrichedLeads.length} leads with messages`);
        return { leads: enrichedLeads, rawMapsData };
    } catch (error: any) {
        console.error('❌ Lead Generation failed:', error);
        throw error;
    }
};

export default {
    generateText,
    chatWithAI,
    generateLeads,
    getAvailableProviders,
    isAnyAIConfigured
};
