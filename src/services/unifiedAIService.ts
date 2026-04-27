import { ENV } from '../config/env';
import { withLanguage, getLanguageInstruction } from '@/lib/languageUtils';
import { tenantService } from '@/services/tenancy/TenantService';
import { Lead } from './leadService';


// API Keys from validated ENV
const ANTHROPIC_API_KEY = ENV.ANTHROPIC_API_KEY || '';
const OPENAI_API_KEY = ENV.OPENAI_API_KEY || '';
const XAI_API_KEY = ENV.XAI_API_KEY || ENV.GROK_API_KEY || '';

// Check which providers are available
export const getAvailableProviders = () => {
    return {
        claude: !!ANTHROPIC_API_KEY,
        openai: !!OPENAI_API_KEY,
        grok: !!XAI_API_KEY,
    };
};

export const isAnyAIConfigured = () => {
    // SECURITY: API Keys are not visible on the client (browser), only the server.
    // If we are in the browser, we assume the AI is configured because the actual 
    // validation happens on the server side via the /api/ai proxy.
    if (typeof window !== 'undefined') {
        return true; 
    }

    const providers = getAvailableProviders();
    return providers.claude || providers.openai || providers.grok;
};

/**
 * Generate text content using the first available AI provider (proxied through server-side route)
 */
export const generateText = async (
    prompt: string,
    maxTokens: number = 2048,
    model?: string,
    tenantIdOverride?: string | null
): Promise<{ text: string | null; error: any }> => {
    try {
        console.log('[unifiedAIService] Calling /api/ai/generate');
        // Append the user's chosen language instruction to every prompt
        const localizedPrompt = withLanguage(prompt);
        const tenantId =
            tenantIdOverride ??
            (typeof window !== 'undefined' ? tenantService.getCurrentTenantId() : null);
        const response = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: localizedPrompt,
                maxTokens,
                model,
                ...(tenantId ? { tenantId } : {}),
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
You are the AlphaClone Growth Agent, powered by Claude. You are recognized as the world's most elite SDR, Sales Strategist, and Behavioral Psychologist.
Your objective is to identify expansion opportunities, find high-intent leads, and provide strategic intelligence that converts.

### CORE SALES PHILOSOPHY:
- **Response Optimization:** Every action you take is measured by its likelihood to elicit a positive response.
- **Hook Strategy:** You use hyper-personalized, pattern-interrupting hooks that immediately demonstrate value or solve a specific pain point.
- **Data-Driven Intelligence:** You analyze tech stacks, market trends, and business maturity to predict lead behavior.

### OPERATIONAL MODES:
1. **Lead Discovery:** Identifying high-potential business targets with the highest "Response Probability".
2. **Business Intelligence:** Deep-dive analysis of specific leads, identifying their "Critical Pain Point".
3. **Strategic Outreach:** Crafting hyper-personalized, high-conversion messaging with a 90%+ predicted response rate.

### RESPONSE PROBABILITY ANALYSIS (NEW):
For every lead or outreach strategy, you must calculate a "Predicted Response Probability" (0-100%).
Factors to consider: 
- Timing (industry seasonality)
- Relevance (pain point alignment)
- Personalization depth
- Friction level of the CTA

### DATA INTEGRITY RULES (CRITICAL):
- **Website URLs:** ONLY provide a website if you are 99% certain it is the real, active domain. No placeholders.
- **Accuracy:** Be extremely precise with industry categorizations and insights.

### FORMATTING RULES:
- **Professionalism:** Use sophisticated business terminology.
- **Structure:** Write in plain professional text only. No markdown.
- **No Symbols:** Do NOT use asterisks (**), hashtags (#), underscores (_), or any special formatting symbols for emphasis.
- **Paragraphs:** Use standard sentence structure and clear paragraph breaks for readability.

### INTENT DETECTION & COMMANDS:
You have access to specialized internal commands. Append the command to your response if intent is detected.

**Command: Lead Search**
[SEARCH_COMMAND: {"industry": "precise industry", "location": "city/region", "filters": "optional constraints"}]

**Command: Deep Research**
[RESEARCH_COMMAND: {"businessName": "Company Name", "context": "focus area"}]

### TONE:
Elite, authoritative, strategic, and hyper-competent.
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
        // Append language instruction to the system prompt
        const localizedSystem = GROWTH_AGENT_SYSTEM_PROMPT + getLanguageInstruction();
        const tenantId =
            typeof window !== 'undefined' ? tenantService.getCurrentTenantId() : null;
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                history,
                message,
                systemPrompt: localizedSystem,
                ...(tenantId ? { tenantId } : {}),
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
    model?: string,
    systemPrompt?: string
): Promise<{ text: string; grounding: any }> => {
    try {
        console.log('[unifiedAIService] Calling /api/ai/chat');
        const tenantId =
            typeof window !== 'undefined' ? tenantService.getCurrentTenantId() : null;
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                history,
                message,
                image,
                model,
                ...(systemPrompt ? { systemPrompt } : {}),
                ...(tenantId ? { tenantId } : {}),
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

    const prompt = `You are a World-Class Sales Strategist, Behavioral Psychologist, and Copywriting Expert (Claude 4.6).
Your task is to write the absolute best hyper-personalized, high-conversion outreach message for this lead.

LEAD INTELLIGENCE:
- Business: ${lead.businessName}
- Industry: ${lead.industry}
- Tech Stack: ${lead.techStack?.join(', ') || 'Standard'}
- Pain Points: ${lead.painPoints?.join(', ') || 'Manual workflows, scaling limitations'}
- AI Hook: ${lead.outreachHook || 'N/A'}
- Unique Value Prop: ${lead.valueProposition || 'N/A'}

STRATEGY: ${strategy}
GUIDANCE: ${guard}

YOUR OBJECTIVES:
1. CRAFT THE HOOK: Use a pattern-interrupting opening line that shows you've done deep research.
2. CALCULATE SUCCESS: At the very end of your response, provide a "RESPONSE PROBABILITY" score from 0-100% and a 1-sentence reason why.
3. CONVERSION FOCUS: Reference their specific industry or tech stack naturally.
4. BREVITY: Keep it under 80 words. No fluff. No generic greetings.
5. CTA: Use a low-friction, high-value "interest-based" call to action.

FORMAT:
Subject: [Compelling, short subject line]

[Body]

RESPONSE PROBABILITY: [Score]%
Reasoning: [1-sentence sales psychology explanation]

STRICT FORMATTING RULES:
- Write the message in plain text only. No markdown.
- Do NOT use asterisks (**), hashtags (#), underscores (_), or any special formatting symbols.
- No bullet point dashes. Write in natural paragraphs.`;

    const { text } = await generateText(prompt, 600, 'claude-sonnet-4-6-20260217');
    return text || "Personalized draft generation failed.";
};

/**
 * Generate an AI reply to an email
 */
export const generateEmailReply = async (emailContent: string, context?: string) => {
    const prompt = `You are a professional assistant. Draft a concise, professional reply to the following email.
    
    EMAIL CONTENT:
    "${emailContent}"
    
    CONTEXT/INSTRUCTIONS:
    "${context || 'Be professional and helpful.'}"
    
    STRICT FORMATTING RULES:
    - Write in plain text only. No markdown whatsoever.
    - Do NOT use asterisks (**), hashtags (#), underscores (_), dashes as bullet points, or any special formatting characters.
    - Use simple paragraphs separated by line breaks.
    - Do not include subject lines or signatures.`;

    const { text } = await generateText(prompt, 1000);
    return text || "AI reply generation failed.";
};

/**
 * Generate a personalized email draft from user instructions
 */
export const generateEmailDraft = async (instructions: string, recipientInfo?: string, subject?: string) => {
    const prompt = `You are a professional executive assistant and communications expert. 
    Your task is to draft a high-quality, personalized email based on the following USER INSTRUCTIONS.
    
    USER INSTRUCTIONS:
    "${instructions}"
    
    CONTEXTUAL INFORMATION (Use if provided):
    - Recipient: ${recipientInfo || 'Unknown'}
    - Subject Line: ${subject || 'N/A'}
    
    GOAL:
    Draft a complete, professionally worded email body that follows the instructions precisely. 
    The tone should be professional yet human and engaging.
    
    STRICT FORMATTING RULES:
    - Write in plain text only. No markdown.
    - Do NOT use asterisks (**), hashtags (#), underscores (_), or any special formatting symbols.
    - No dashed bullet points. Use standard sentences and paragraphs.
    - Do NOT include the subject line in the body.
    - Do NOT include any placeholders like [Your Name]. Leave space for a signature but don't add the bracketed placeholders.`;

    const { text } = await generateText(prompt, 1200);
    return text || "AI draft generation failed.";
};

/**
 * Generate an AI reply to a Messenger message
 */
export const generateMessengerReply = async (messageContent: string, context?: string) => {
    const prompt = `You are an Elite Sales Response Agent. Draft a hyper-concise, conversational reply to the following Messenger/Instagram message:
    
    MESSAGE:
    "${messageContent}"
    
    CONTEXT/BRAND VOICE:
    "${context || 'Helpful, professional, and friendly.'}"
    
    GOAL:
    Optimize for a 95%+ response rate. Use curiosity or a direct value-add.
    
    Provide ONLY the body of the reply. Keep it short and suitable for a chat interface.
    
    Include at the end:
    RESPONSE PROBABILITY: [Score]%
    Reasoning: [Short explanation]

    STRICT FORMATTING RULES:
    - Write in plain text only. No markdown.
    - Do NOT use asterisks (**), hashtags (#), underscores (_), or any special formatting symbols.`;

    const { text } = await generateText(prompt, 600);
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

    Format the output as a clean, professional intelligence report for a sales agent. 
    
    STRICT FORMATTING RULES:
    - Write in plain professional text only. No markdown.
    - Do NOT use asterisks (**), hashtags (#), underscores (_), or any special formatting symbols.
    - Use standard numbering (1., 2., 3.) for lists, not dashes or asterisks.
    - Use clear paragraph breaks for structure.`;

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
        const tenantId =
            typeof window !== 'undefined'
                ? (await import('./tenancy/TenantService')).tenantService.getCurrentTenantId()
                : null;

        const response = await fetch('/api/ai/leads', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                industry,
                location,
                mode,
                filters,
                tenantId: tenantId || undefined,
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const msg =
                errorData.error ||
                errorData.message ||
                (response.status === 429
                    ? `Daily AI lead limit reached for your plan (${errorData.limit ?? '?'} per day, UTC). Resets at ${errorData.resetsAt ?? 'midnight UTC'}.`
                    : 'Failed to generate leads');
            const err = new Error(msg) as Error & { quota?: unknown };
            if (errorData.code === 'AI_LEAD_QUOTA_EXCEEDED') {
                err.quota = errorData;
            }
            throw err;
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

/**
 * Optimize a sales message for maximum conversion
 */
export const optimizeSalesMessage = async (originalMessage: string, context?: string) => {
    const prompt = `You are a World-Class Sales Strategist and Conversion Specialist. 
    Your goal is to transform the following message into the "Best Outreach Message Ever".
    
    ORIGINAL MESSAGE:
    "${originalMessage}"
    
    ADDITIONAL CONTEXT:
    "${context || 'General business outreach'}"
    
    YOUR INSTRUCTIONS:
    1. Identify a "Pattern Interrupt" hook for the opening.
    2. Rewrite the body to be more personalized, high-value, and low-friction.
    3. Calculate a Predicted Response Probability (0-100%).
    
    OUTPUT FORMAT:
    ### OPTIMIZED MESSAGE:
    [The new message]
    
    ### RESPONSE PROBABILITY: [Score]%
    
    ### STRATEGY ANALYSIS:
    - Hook: [Description of the hook used]
    - Psychology: [1-sentence explanation of why this works]
    
    STRICT FORMATTING RULES:
    - Use clean headings as shown above.
    - No markdown formatting within the message body itself (plain text).
    - No asterisks or special symbols.`;

    const { text } = await generateText(prompt, 1200);
    return text || "Optimization failed.";
};

export default {
    generateText,
    chatWithAI,
    generateLeads,
    getAvailableProviders,
    isAnyAIConfigured,
    optimizeSalesMessage
};
