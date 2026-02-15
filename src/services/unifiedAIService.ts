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
export const chatWithGrowthAgent = async (
    history: { role: string; text: string }[],
    message: string
): Promise<{ text: string; grounding: any }> => {
    const systemPrompt = `You are the AlphaClone Growth Agent. Your goal is to help users find high-quality leads and grow their business.
    
    INTENT DETECTION:
    If a user asks to "find", "search", "get", or "discover" leads/businesses for a specific service/industry in a specific location, you MUST respond with a specialized command at the end of your text.
    
    COMMAND FORMAT: [SEARCH_COMMAND: {"industry": "precise service name", "location": "city or country"}]
    
    EXAMPLES:
    - User: "Find me plumbers in London" 
      AI: "Certainly! I'll search for plumbers in London for you right now. [SEARCH_COMMAND: {"industry": "Plumbing Services", "location": "London"}]"
    - User: "I need graphic designers in NY"
      AI: "Great choice. Searching for graphic designers in New York... [SEARCH_COMMAND: {"industry": "Graphic Design", "location": "New York"}]"
    
    If information is missing (like location), ask the user for it first.
    Be proactive, premium, and concise.`;

    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                history,
                message,
                systemPrompt
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get response from Growth Agent');
        }

        return await response.json();
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
export const generateLeads = async (industry: string, location: string, googleApiKey?: string, mode: 'admin' | 'tenant' = 'tenant') => {
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
                mode
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate leads');
        }

        const { leads } = await response.json();

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
        return enrichedLeads;
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
