import { GoogleGenerativeAI } from '@google/generative-ai';
import { googlePlacesService } from './googlePlacesService';
import { ENV } from '@/config/env';

// API Keys from validated ENV
const GEMINI_API_KEY = ENV.VITE_GEMINI_API_KEY || '';
const ANTHROPIC_API_KEY = ENV.ANTHROPIC_API_KEY || '';
const OPENAI_API_KEY = ENV.OPENAI_API_KEY || '';
const MANUS_API_KEY = process.env.NEXT_PUBLIC_MANUS_API_KEY || process.env.MANUS_API_KEY || ''; // Not in ENV schema yet

// Check which providers are available
export const getAvailableProviders = () => {
    return {
        claude: !!ANTHROPIC_API_KEY,
        openai: !!OPENAI_API_KEY,
        gemini: !!GEMINI_API_KEY,
        manus: !!MANUS_API_KEY
    };
};

export const isAnyAIConfigured = () => {
    const providers = getAvailableProviders();
    return providers.claude || providers.openai || providers.gemini || providers.manus;
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
Elite, professional, authoritative, and data-driven.
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
 * Generate a personalized outreach message
 */
export const generateOutreachMessage = async (lead: any) => {
    const prompt = `Write a short, professional cold email to "${lead.businessName}" (Industry: ${lead.industry}, Location: ${lead.location}).
    
    Sender: AlphaClone Systems (AI & Automation Agency).
    Goal: Offer to automate their workflow or improve their digital presence.
    Tone: Premium, concise, helpful.
    
    Format:
    Subject: [Subject Here]
    
    [Body Here]`;

    const { text } = await generateText(prompt, 500);
    return text || "Draft generation failed.";
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
 * Generate leads using Manus AI (premium lead enrichment)
 */
export const generateLeadsWithManus = async (industry: string, location: string) => {
    if (!MANUS_API_KEY) {
        throw new Error('Manus AI API key is not configured');
    }

    console.log('🟡 Using Manus AI for lead generation...');

    try {
        // Manus AI API call for lead enrichment
        const response = await fetch('https://api.manus.ai/v1/leads/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MANUS_API_KEY}`
            },
            body: JSON.stringify({
                industry: industry,
                location: location,
                limit: 10,
                enrichment: true // Request full business data enrichment
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Manus AI API error:', response.status, errorText);
            throw new Error(`Manus AI API error: ${response.status}`);
        }

        const data = await response.json();

        // Transform Manus response to our lead format
        const leads = (data.leads || data.results || []).map((lead: any) => ({
            id: lead.id || crypto.randomUUID(),
            businessName: lead.business_name || lead.name || lead.company,
            industry: lead.industry || industry,
            location: lead.location || lead.city || location,
            phone: lead.phone || lead.phone_number || '',
            email: lead.email || lead.contact_email || '',
            fb: lead.facebook || lead.social?.facebook || '',
            status: 'New',
            source: 'Manus AI'
        }));

        console.log(`✅ Manus AI returned ${leads.length} leads`);
        return leads;
    } catch (error: any) {
        console.error('❌ Manus AI failed:', error);
        throw error;
    }
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
