/**
 * Unified AI Service
 * Supports multiple AI providers: Claude (Anthropic), Gemini (Google), OpenAI
 * Automatically uses whichever API key is configured
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { googlePlacesService } from './googlePlacesService';

// API Keys
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || '';
const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';

// Initialize providers
const geminiAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Check which providers are available
export const getAvailableProviders = () => {
    return {
        gemini: !!GEMINI_API_KEY,
        claude: !!ANTHROPIC_API_KEY,
        openai: !!OPENAI_API_KEY
    };
};

export const isAnyAIConfigured = () => {
    const providers = getAvailableProviders();
    return providers.gemini || providers.claude || providers.openai;
};

/**
 * Generate text content using the first available AI provider
 */
export const generateText = async (prompt: string, maxTokens: number = 2048): Promise<{ text: string | null; error: any }> => {
    const providers = getAvailableProviders();

    // Try Gemini first (free tier available)
    if (providers.gemini && geminiAI) {
        try {
            console.log('🔵 Using Gemini AI');
            const model = geminiAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return { text: response.text(), error: null };
        } catch (error) {
            console.error('❌ Gemini failed:', error);
            // Fall through to try next provider
        }
    }

    // Try Claude if Gemini failed or not available
    if (providers.claude) {
        try {
            console.log('🟣 Using Claude AI');
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: maxTokens,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }]
                })
            });

            if (!response.ok) {
                throw new Error('Claude API error');
            }

            const data = await response.json();
            return { text: data.content[0].text, error: null };
        } catch (error) {
            console.error('❌ Claude failed:', error);
            // Fall through to try next provider
        }
    }

    // Try OpenAI if both Gemini and Claude failed
    if (providers.openai) {
        try {
            console.log('🟢 Using OpenAI');
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4-turbo-preview',
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    max_tokens: maxTokens
                })
            });

            if (!response.ok) {
                throw new Error('OpenAI API error');
            }

            const data = await response.json();
            return { text: data.choices[0].message.content, error: null };
        } catch (error) {
            console.error('❌ OpenAI failed:', error);
        }
    }

    // No providers available or all failed
    return {
        text: null,
        error: 'No AI provider is configured or all providers failed. Please set VITE_GEMINI_API_KEY, VITE_ANTHROPIC_API_KEY, or VITE_OPENAI_API_KEY.'
    };
};

/**
 * Start a chat session (uses Gemini if available, falls back to Claude)
 */
export const chatWithAI = async (
    history: { role: string; text: string }[],
    message: string,
    image?: string
): Promise<{ text: string; grounding: any }> => {
    const providers = getAvailableProviders();

    // Try Gemini with chat for multi-turn conversations
    if (providers.gemini && geminiAI) {
        try {
            console.log('🔵 Using Gemini Chat');
            const model = geminiAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

            const systemPrompt = {
                role: 'user',
                parts: [{
                    text: `You are a professional business assistant for AlphaClone Systems.
CRITICAL INSTRUCTIONS:
- Only provide accurate, factual information based on context provided
- If you don't know something, say "I don't have that information"
- Never make up or fabricate data, numbers, or details
- Stay professional and concise
- Focus on the user's actual query`
                }]
            };

            const modelResponse = {
                role: 'model',
                parts: [{ text: 'Understood. I will provide only accurate, factual responses.' }]
            };

            const chatHistory = [
                systemPrompt,
                modelResponse,
                ...history.map(h => ({
                    role: h.role === 'model' ? 'model' : 'user',
                    parts: [{ text: h.text }]
                }))
            ];

            const chat = model.startChat({
                history: chatHistory,
                generationConfig: {
                    maxOutputTokens: 2048,
                    temperature: 0.7,
                    topP: 0.9,
                    topK: 40
                },
            });

            let result;
            if (image) {
                const base64Data = image.split(',')[1];
                const mimeType = image.split(';')[0]?.split(':')[1] || 'image/png';
                const imagePart = {
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                };
                result = await chat.sendMessage([message, imagePart]);
            } else {
                result = await chat.sendMessage(message);
            }

            const response = await result.response;
            return {
                text: response.text(),
                grounding: null
            };
        } catch (error) {
            console.error('❌ Gemini chat failed:', error);
            // Fall through to Claude
        }
    }

    // Fall back to Claude for chat
    if (providers.claude) {
        try {
            console.log('🟣 Using Claude Chat');

            // Build messages array from history + new message
            const messages = [
                ...history.map(h => ({
                    role: h.role === 'model' ? 'assistant' : 'user',
                    content: h.text
                })),
                {
                    role: 'user',
                    content: message
                }
            ];

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 2048,
                    system: 'You are a professional business assistant for AlphaClone Systems.',
                    messages: messages
                })
            });

            if (!response.ok) {
                throw new Error('Claude API error');
            }

            const data = await response.json();
            return {
                text: data.content[0].text,
                grounding: null
            };
        } catch (error) {
            console.error('❌ Claude chat failed:', error);
        }
    }

    throw new Error('No AI provider available for chat');
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
 * Generate leads using AI or Google Places
 */
export const generateLeads = async (industry: string, location: string, googleApiKey?: string) => {
    if (!isAnyAIConfigured()) {
        throw new Error('AI API key is not configured. Please contact administrator.');
    }

    if (!industry || !location) {
        throw new Error('Industry and location are required to generate leads.');
    }

    console.log(`🔍 Generating leads for: ${industry} in ${location}`);
    let leads: any[] = [];

    // 1. Try Google Places if Key Provided
    if (googleApiKey) {
        console.log("🗺️ Using Google Places API for real data...");
        const { places, error } = await googlePlacesService.searchPlaces(`${industry} in ${location}`, googleApiKey);

        if (error) {
            console.warn("⚠️ Google Places failed, falling back to AI:", error);
            // Fallback to AI if Google fails
        } else if (places.length > 0) {
            leads = places.map(p => ({
                id: crypto.randomUUID(), // Temp ID for UI
                ...p,
                status: 'New'
            }));
        }
    }

    // 2. AI Generation (Fallback or Default)
    if (leads.length === 0) {
        console.log("🤖 Using Generative AI for synthetic data...");
        const prompt = `Generate EXACTLY 5 realistic and professional business leads for the "${industry}" industry in "${location}".

CRITICAL REQUIREMENTS:
- All data must be plausible and realistic for ${location}
- Business names must be appropriate for ${industry} industry
- Phone numbers must follow standard ${location} format
- Email addresses must be professional and realistic
- DO NOT fabricate real companies - create plausible fictional ones
- DO NOT use placeholder data like "example.com" or "123-456-7890"

Return ONLY a valid JSON array (no markdown, no explanation) where each object has:
- id: random 8-character alphanumeric string
- businessName: realistic business name (not a real company)
- industry: "${industry}"
- location: "${location}"
- phone: realistic phone number for ${location}
- email: professional email (firstname@businessname.com format)
- fb: lowercase facebook handle (no spaces, hyphens allowed)
- status: "New"

Example format:
[{"id":"abc12345","businessName":"TechFlow Solutions","industry":"${industry}","location":"${location}","phone":"+263-71-234-5678","email":"info@techflow.co.zw","fb":"techflowsolutions","status":"New"}]`;

        const { text, error } = await generateText(prompt, 2048);

        if (error || !text) {
            console.error('❌ AI Error:', error);
            throw new Error(error || 'AI service returned no data. Please try again.');
        }

        try {
            const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanedText);

            if (Array.isArray(parsed)) {
                leads = parsed;
            }
        } catch (e: any) {
            console.error("❌ Failed to parse leads:", e);
            throw new Error('Failed to parse AI response.');
        }
    }

    // 3. Auto-Generate Outreach Messages for ALL leads
    console.log("📧 Generating auto-outreach messages...");

    // We do this in parallel but limit concurrency if needed (for now, Promise.all is fine for 5-10 items)
    const enrichedLeads = await Promise.all(leads.map(async (lead) => {
        try {
            const message = await generateOutreachMessage(lead);
            return {
                ...lead,
                outreachMessage: message,
                outreachStatus: 'pending'
            };
        } catch (e) {
            return { ...lead, outreachMessage: "Failed to generate.", outreachStatus: 'error' };
        }
    }));

    console.log(`✅ Ready: ${enrichedLeads.length} leads with messages.`);
    return enrichedLeads;
};

export default {
    generateText,
    chatWithAI,
    generateLeads,
    getAvailableProviders,
    isAnyAIConfigured
};
