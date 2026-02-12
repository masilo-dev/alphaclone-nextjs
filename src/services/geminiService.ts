import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from '@/config/env';

const API_KEY = ENV.VITE_GEMINI_API_KEY || '';

// Helper to check if API is configured
export const isGeminiConfigured = () => {
    return API_KEY && API_KEY.trim() !== '';
};

const genAI = isGeminiConfigured() && API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Helper to get model safely
const getModel = (modelName: string) => {
    if (!genAI || !isGeminiConfigured()) {
        throw new Error('Gemini API key is not configured. Please set NEXT_PUBLIC_GEMINI_API_KEY environment variable.');
    }
    return genAI.getGenerativeModel({ model: modelName });
};

export const geminiService = {
    async generateContent(prompt: string) {
        try {
            const model = getModel('gemini-1.5-flash-latest');
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return { text: response.text(), error: null };
        } catch (error) {
            console.error('Gemini API Error:', error);
            return { text: null, error };
        }
    },

    async generateContentWithImage(prompt: string, imageParts: any[]) {
        try {
            const model = getModel('gemini-1.5-flash-latest');
            const result = await model.generateContent([prompt, ...imageParts]);
            const response = await result.response;
            return { text: response.text(), error: null };
        } catch (error) {
            console.error('Gemini API Error:', error);
            return { text: null, error };
        }
    }
};

// Start a chat session
export const chatWithGemini = async (
    history: { role: string; text: string }[],
    message: string,
    image?: string,
    systemPromptText?: string
) => {
    if (!genAI) {
        throw new Error('Gemini AI is not initialized. Check your API key.');
    }
    try {
        // Use custom system prompt if provided, otherwise default to the professional assistant one
        const finalSystemPrompt = systemPromptText || `You are a professional business assistant for AlphaClone Systems.
CRITICAL INSTRUCTIONS:
- Only provide accurate, factual information based on context provided
- If you don't know something, say "I don't have that information"
- Never make up or fabricate data, numbers, or details
- Stay professional and concise
- Focus on the user's actual query
- Do not hallucinate features, capabilities, or information that wasn't explicitly provided`;

        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-pro',
            systemInstruction: finalSystemPrompt
        });

        // Transform history to parts format if needed,
        // but simple SDK chat history expects { role, parts: [{ text }] }
        const chatHistory = history.map((h: any) => ({
            role: h.role === 'model' ? 'model' : 'user',
            parts: [{ text: h.text || h.content || '' }]
        }));

        const chat = model.startChat({
            history: chatHistory,
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: 0.7, // Lower temperature for more consistent outputs
                topP: 0.9,
                topK: 40
            },
        });

        let result;
        if (image) {
            // If image is present, we might need to use generateContent instead of chat for this turn
            // or use a multimodal model. For simplicity, we'll try to use the model's chat capability if supported,
            // but often single-turn with image is safer effectively.
            // Converting base64 image to part
            const base64Data = image.includes(',') ? image.split(',')[1] : image;
            const mimeType = image.includes(';') ? (image.split(';')[0]?.split(':')[1] || 'image/png') : 'image/png';
            const imagePart = {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            } as any;
            // Note: chat.sendMessage can take multiple parts
            result = await chat.sendMessage([message, imagePart]);
        } else {
            result = await chat.sendMessage(message);
        }

        const response = await result.response;
        // Mocking grounding for now as it's specific to Vertex AI usually, but keeping structure
        return {
            text: response.text(),
            grounding: null
        };
    } catch (error) {
        console.error("Chat Error", error);
        throw error;
    }
};

export const editImage = async (image: string, prompt: string) => {
    try {
        const model = getModel('gemini-1.5-flash-latest');
        const base64Data = image.split(',')[1];
        const mimeType = image.split(';')[0]?.split(':')[1] || 'image/png';
        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: mimeType
            }
        } as any;
        await model.generateContent([
            `Task: Edit this image based on the following instruction: ${prompt}. 
             Since you cannot directly output an image file, please describe in great detail what the edited image looks like.`,
            imagePart
        ]);
        // For a real app, this would need an image generation model like Imagen. 
        // Gemini returns text. We will return the text description or a placeholder URL if we had a generator.
        // Returning original image for now as "mock" edit result or a placeholder.
        return image;
    } catch (error) {
        console.error("Edit Image Error", error);
        return null;
    }
};

export const generateVideo = async () => {
    try {
        // Veo is not public via this SDK yet usually. 
        // We will simulate a delay and return a mock video URL.
        await new Promise(resolve => setTimeout(resolve, 2000));
        return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
    } catch (error) {
        console.error("Video Gen Error", error);
        return null;
    }
};

export const generateContract = async (clientName: string, projectName: string, amount: number) => {
    const prompt = `Generate a professional freelance contract for Client: ${clientName}, Project: ${projectName}, Amount: $${amount}. Include standard clauses.`;
    const res = await geminiService.generateContent(prompt);
    return res.text || "Contract generation failed.";
};

export const generateArchitectSpecs = async (description: string, type: string) => {
    const prompt = `Generate technical architecture specs for a ${type} project described as: "${description}". Return JSON with keys: techStack (string), developmentPrompt (string), architectureDiagram (string description).`;
    const res = await geminiService.generateContent(prompt);
    try {
        // clean code blocks
        const text = res.text?.replace(/```json/g, '').replace(/```/g, '') || "{}";
        return JSON.parse(text);
    } catch (e) {
        return {
            techStack: "React, Node.js, Supabase",
            developmentPrompt: "Build a scalable app...",
            architectureDiagram: "Client -> CDN -> Server -> DB"
        };
    }
};

export const generateLeads = async (industry: string, location: string) => {
    // Check API key first
    if (!isGeminiConfigured()) {
        console.error('❌ Cannot generate leads: VITE_GEMINI_API_KEY not configured');
        throw new Error('AI API key is not configured. Please contact administrator.');
    }

    if (!industry || !location) {
        throw new Error('Industry and location are required to generate leads.');
    }

    console.log(`🔍 Generating leads for: ${industry} in ${location}`);

    const prompt = `Generate EXACTLY 5 realistic and professional business leads for the "${industry}" industry in "${location}".

CRITICAL REQUIREMENTS:
- All data must be plausible and realistic for ${location}
- Business names must be appropriate for ${industry} industry
- Phone numbers must follow standard ${location} format
- Email addresses must be professional and realistic
- Facebook handles should be lowercase, no spaces
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

    try {
        const res = await geminiService.generateContent(prompt);

        if (res.error) {
            console.error('❌ Gemini API Error:', res.error);
            throw new Error('AI service returned an error. Please check your API key and try again.');
        }

        if (!res.text) {
            console.error('❌ No response from Gemini API');
            throw new Error('AI service returned no data. Please try again.');
        }

        console.log('📥 Raw AI response:', res.text.substring(0, 200) + '...');

        const text = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const leads = JSON.parse(text);

        // Validate the leads structure
        if (!Array.isArray(leads) || leads.length === 0) {
            console.error("❌ Invalid leads format: not an array or empty");
            throw new Error('AI generated invalid data format. Please try again.');
        }

        // Validate each lead has required fields
        const validLeads = leads.filter(lead =>
            lead.id && lead.businessName && lead.industry && lead.location &&
            lead.phone && lead.email && lead.status
        );

        if (validLeads.length < leads.length) {
            console.warn(`⚠️ Filtered out ${leads.length - validLeads.length} invalid leads`);
        }

        if (validLeads.length === 0) {
            throw new Error('No valid leads were generated. Please try again with different criteria.');
        }

        console.log(`✅ Successfully generated ${validLeads.length} valid leads`);
        return validLeads.slice(0, 5); // Ensure max 5 leads
    } catch (e: any) {
        console.error("❌ Failed to generate leads:", e);
        if (e.message && e.message.includes('API key')) {
            throw new Error('Invalid API key. Please check your Gemini API key configuration.');
        }
        throw new Error(e.message || 'Failed to generate leads. Please try again.');
    }
};

export const generateAutoReply = async (incomingMessage: string, senderName: string, businessContext: string = "a professional digital agency") => {
    const prompt = `You are an AI assistant for ${businessContext}.
    A client named ${senderName} sent this message: "${incomingMessage}".
    Draft a polite, professional, and concise reply.
    If the message is a greeting, reply warmly.
    If it's a specific question, acknowledge it and say the team will review it.
    Keep it under 3 sentences.`;

    const res = await geminiService.generateContent(prompt);
    return res.text || "Thank you for your message. Our team will review it shortly.";
};
